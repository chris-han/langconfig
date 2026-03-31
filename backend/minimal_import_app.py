"""
Minimal LangConfig backend for `.langconfig` import contract testing.

This app intentionally excludes LangConfig's heavy ML, RAG, and runtime
dependencies so Semantier can validate the import contract quickly.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, Generator, List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.database import SessionLocal, async_init_db, check_db_health
from models.core import ContextDocument, IndexingStatus, Project, ProjectStatus, SearchHistory
import models.core  # register SQLAlchemy tables
import models.workflow
import models.custom_tool
import models.settings
from models.settings import Settings as SettingsModel
from services.workflow_config_service import WorkflowConfigService

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

try:
    from services.llama_config import get_table_name as canonical_get_table_name
except Exception as exc:  # pragma: no cover - depends on optional runtime deps
    canonical_get_table_name = None
    logger.info("Canonical LlamaIndex table-name helper unavailable in minimal backend: %s", exc)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_project_index_table_name(project_id: int) -> str:
    if canonical_get_table_name is not None:
        return canonical_get_table_name(project_id)
    return f"data_project_index_{project_id}"


def measure_project_storage(db: Session, project_id: int) -> Optional[dict]:
    table_name = get_project_index_table_name(project_id)

    table_exists = db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = :table_name
            )
            """
        ),
        {"table_name": table_name},
    ).scalar()

    if not table_exists:
        return None

    row = db.execute(
        text(
            """
            SELECT
                pg_total_relation_size(:table_name) as total_bytes,
                pg_relation_size(:table_name) as table_bytes,
                pg_indexes_size(:table_name) as index_bytes
            """
        ),
        {"table_name": table_name},
    ).fetchone()

    total_bytes = row.total_bytes or 0
    return {
        "exists": True,
        "total_bytes": total_bytes,
        "table_bytes": row.table_bytes or 0,
        "index_bytes": row.index_bytes or 0,
        "total_gb": total_bytes / (1024 ** 3),
    }


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    configuration: Dict[str, Any] = Field(default_factory=lambda: {"default_model": "gpt-4o"})


class WorkflowImportRequest(BaseModel):
    config: dict = Field(..., description="The .langconfig JSON content")
    project_id: int = Field(..., description="Project to import into")
    name_override: Optional[str] = Field(None, description="Optional name override")
    create_custom_tools: bool = Field(True, description="Create custom tools from config")


class APIKeySet(BaseModel):
    openai_api_key: Optional[str] = None
    azure_openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    cohere_api_key: Optional[str] = None
    replicate_api_key: Optional[str] = None


class SettingsUpdateRequest(BaseModel):
    default_model: Optional[str] = None
    default_temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    embedding_model: Optional[str] = None
    azure_openai_endpoint: Optional[str] = None
    azure_openai_api_version: Optional[str] = None
    azure_openai_embedding_deployment: Optional[str] = None
    azure_openai_embedding_dimensions: Optional[int] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    storage_path: Optional[str] = None


class GeneralSettingsRequest(BaseModel):
    app_name: Optional[str] = "LangConfig"
    auto_save: Optional[bool] = True
    auto_save_interval: Optional[int] = 300
    confirm_before_delete: Optional[bool] = True
    show_notifications: Optional[bool] = True
    check_updates: Optional[bool] = True
    telemetry: Optional[bool] = False
    log_level: Optional[str] = "info"


class LocalModelsSettingsRequest(BaseModel):
    provider: Optional[str] = "ollama"
    base_url: Optional[str] = "http://localhost:11434/v1"
    model_name: Optional[str] = "llama3.2:latest"
    api_key: Optional[str] = None


class WorkspaceSettingsRequest(BaseModel):
    workspace_path: Optional[str] = ""
    allow_read: Optional[bool] = True
    allow_write: Optional[bool] = True
    require_approval: Optional[bool] = True
    auto_detect_git: Optional[bool] = True
    backup_before_edit: Optional[bool] = True


class ModelDefaultsSettingsRequest(BaseModel):
    primary_model: Optional[str] = "gpt-4o"
    fallback_models: Optional[list[str]] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 4096
    top_p: Optional[float] = 1.0
    routing_strategy: Optional[str] = "balanced"
    daily_token_limit: Optional[int] = 0
    monthly_token_limit: Optional[int] = 0
    alert_threshold: Optional[int] = 80


def serialize_project(project: Project) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status.value if hasattr(project.status, "value") else str(project.status),
        "configuration": project.configuration,
        "indexed_nodes_count": getattr(project, "indexed_nodes_count", 0),
        "created_at": project.created_at.isoformat() if getattr(project, "created_at", None) else None,
        "updated_at": project.updated_at.isoformat() if getattr(project, "updated_at", None) else None,
    }


def serialize_workflow(workflow: Any) -> dict:
    return {
        "id": workflow.id,
        "name": workflow.name,
        "description": workflow.description,
        "project_id": workflow.project_id,
        "strategy_type": workflow.strategy_type.value if workflow.strategy_type and hasattr(workflow.strategy_type, "value") else workflow.strategy_type,
        "configuration": workflow.configuration or {},
        "blueprint": workflow.blueprint or {},
        "status": "idle",
        "created_at": workflow.created_at.isoformat() if getattr(workflow, "created_at", None) else None,
        "updated_at": workflow.updated_at.isoformat() if getattr(workflow, "updated_at", None) else None,
    }


def serialize_document(document: ContextDocument) -> dict:
    return {
        "id": document.id,
        "project_id": document.project_id,
        "name": document.filename,
        "original_filename": document.original_filename,
        "document_type": document.document_type.value if hasattr(document.document_type, "value") else document.document_type,
        "size": document.file_size,
        "mime_type": document.mime_type,
        "indexing_status": document.indexing_status.value if hasattr(document.indexing_status, "value") else document.indexing_status,
        "chunk_count": document.indexed_chunks_count or 0,
        "created_at": document.created_at.isoformat() if getattr(document, "created_at", None) else None,
        "indexed_at": document.indexed_at.isoformat() if getattr(document, "indexed_at", None) else None,
        "metadata": {
            "description": document.description,
            "tags": document.tags or [],
            "content_preview": document.content_preview,
        },
    }


def get_default_storage_path() -> str:
    return os.path.expanduser("~/.local/share/langconfig/documents")


def get_or_create_settings(db: Session) -> SettingsModel:
    settings = db.query(SettingsModel).filter(SettingsModel.id == 1).first()
    if not settings:
        settings = SettingsModel(
            id=1,
            api_keys={},
            storage_path=get_default_storage_path(),
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def mask_api_key(key: str) -> str:
    if len(key) <= 8:
        return "***"
    return f"{key[:4]}...{key[-4:]}"


def serialize_settings(settings: SettingsModel) -> dict:
    return {
        "default_model": settings.default_model or "gpt-4o",
        "default_temperature": settings.default_temperature if settings.default_temperature is not None else 0.7,
        "max_tokens": settings.max_tokens or 4096,
        "embedding_model": settings.embedding_model or "text-embedding-3-small",
        "azure_openai_endpoint": settings.azure_openai_endpoint,
        "azure_openai_api_version": settings.azure_openai_api_version or "2024-05-01-preview",
        "azure_openai_embedding_deployment": settings.azure_openai_embedding_deployment,
        "azure_openai_embedding_dimensions": settings.azure_openai_embedding_dimensions,
        "chunk_size": settings.chunk_size or 1000,
        "chunk_overlap": settings.chunk_overlap or 200,
        "storage_path": settings.storage_path or get_default_storage_path(),
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    await async_init_db()
    logger.info("Minimal import backend database initialized")
    yield


app = FastAPI(
    title="LangConfig Minimal Import API",
    version="0.1.0",
    description="Minimal backend for `.langconfig` import contract testing",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:19001",
        "http://127.0.0.1:19001",
        "http://localhost:1420",
        "http://127.0.0.1:1420",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    db_health = await check_db_health()
    return {
        "status": "ok" if db_health.get("status") == "healthy" else "degraded",
        "service": "langconfig-minimal-import",
        "database": db_health,
    }


@app.get("/api/projects")
@app.get("/api/projects/")
def list_projects(db: Session = Depends(get_db)) -> List[dict]:
    projects = db.query(Project).order_by(Project.id.asc()).all()
    return [serialize_project(project) for project in projects]


@app.post("/api/projects")
@app.post("/api/projects/")
def create_project(request: ProjectCreateRequest, db: Session = Depends(get_db)) -> dict:
    existing = db.query(Project).filter(Project.name == request.name).first()
    if existing:
        result = serialize_project(existing)
        result["deduplicated"] = True
        return result

    project = Project(
        name=request.name,
        description=request.description,
        configuration=request.configuration,
        status=ProjectStatus.IDLE,
        indexing_status=IndexingStatus.NOT_INDEXED,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    result = serialize_project(project)
    result["deduplicated"] = False
    return result


@app.get("/api/workflows")
@app.get("/api/workflows/")
def list_workflows(db: Session = Depends(get_db)) -> List[dict]:
    from models.workflow import WorkflowProfile

    workflows = db.query(WorkflowProfile).order_by(WorkflowProfile.id.asc()).all()
    return [serialize_workflow(workflow) for workflow in workflows]


@app.post("/api/workflows/import")
async def import_workflow(request: WorkflowImportRequest, db: Session = Depends(get_db)) -> dict:
    try:
        service = WorkflowConfigService(db)
        return await service.import_workflow_config(
            config=request.config,
            project_id=request.project_id,
            owner_id=0,
            name_override=request.name_override,
            create_custom_tools=request.create_custom_tools,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Minimal import backend failed to import workflow")
        raise HTTPException(status_code=500, detail=f"Import failed: {exc}") from exc


@app.get("/api/deepagents")
@app.get("/api/deepagents/")
def list_deepagents() -> List[dict]:
    return []


@app.get("/api/chat/sessions")
def list_chat_sessions() -> List[dict]:
    return []


@app.get("/api/agents/templates")
def list_agent_templates() -> List[dict]:
    return []


@app.get("/api/agents/recipes")
def list_agent_recipes() -> List[dict]:
    return []


@app.get("/api/settings/api-keys")
def get_api_keys(db: Session = Depends(get_db)) -> List[dict]:
    settings = get_or_create_settings(db)
    api_keys = settings.api_keys or {}
    providers = ["openai", "azure_openai", "anthropic", "google", "cohere", "replicate"]
    env_fallbacks = {
        "openai": os.getenv("OPENAI_API_KEY"),
        "azure_openai": None,
        "anthropic": os.getenv("ANTHROPIC_API_KEY"),
        "google": os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"),
        "cohere": os.getenv("COHERE_API_KEY"),
        "replicate": os.getenv("REPLICATE_API_KEY"),
    }
    results = []
    for provider in providers:
        key = api_keys.get(provider) or env_fallbacks.get(provider)
        results.append(
            {
                "provider": provider,
                "is_set": key is not None,
                "masked_key": mask_api_key(key) if key else None,
            }
        )
    return results


@app.post("/api/settings/api-keys")
def set_api_keys(keys: APIKeySet, db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    api_keys = settings.api_keys or {}
    update_data = keys.model_dump(exclude_unset=True)
    mapping = {
        "openai_api_key": "openai",
        "azure_openai_api_key": "azure_openai",
        "anthropic_api_key": "anthropic",
        "google_api_key": "google",
        "cohere_api_key": "cohere",
        "replicate_api_key": "replicate",
    }
    for field_name, provider in mapping.items():
        value = update_data.get(field_name)
        if value:
            api_keys[provider] = value
    settings.api_keys = api_keys
    db.commit()
    return {"message": "API keys saved successfully (minimal backend compatibility mode)"}


@app.get("/api/settings/")
@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    return serialize_settings(settings)


@app.patch("/api/settings/")
@app.patch("/api/settings")
def update_settings(request: SettingsUpdateRequest, db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return serialize_settings(settings)


@app.post("/api/settings/reset")
def reset_settings(db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    settings.default_model = "gpt-4o"
    settings.default_temperature = 0.7
    settings.max_tokens = 4096
    settings.embedding_model = "text-embedding-3-small"
    settings.azure_openai_endpoint = None
    settings.azure_openai_api_version = "2024-05-01-preview"
    settings.azure_openai_embedding_deployment = None
    settings.azure_openai_embedding_dimensions = None
    settings.chunk_size = 1000
    settings.chunk_overlap = 200
    settings.storage_path = get_default_storage_path()
    db.commit()
    return {"message": "Settings reset to defaults"}


@app.get("/api/settings/general")
def get_general_settings(db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    return {
        "app_name": settings.app_name or "LangConfig",
        "auto_save": settings.auto_save if settings.auto_save is not None else True,
        "auto_save_interval": settings.auto_save_interval or 300,
        "confirm_before_delete": settings.confirm_before_delete if settings.confirm_before_delete is not None else True,
        "show_notifications": settings.show_notifications if settings.show_notifications is not None else True,
        "check_updates": settings.check_updates if settings.check_updates is not None else True,
        "telemetry": settings.telemetry if settings.telemetry is not None else False,
        "log_level": settings.log_level or "info",
    }


@app.post("/api/settings/general")
def update_general_settings(request: GeneralSettingsRequest, db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    data = request.model_dump(exclude_unset=True)
    field_map = {
        "app_name": "app_name",
        "auto_save": "auto_save",
        "auto_save_interval": "auto_save_interval",
        "confirm_before_delete": "confirm_before_delete",
        "show_notifications": "show_notifications",
        "check_updates": "check_updates",
        "telemetry": "telemetry",
        "log_level": "log_level",
    }
    for source, target in field_map.items():
        if source in data:
            setattr(settings, target, data[source])
    db.commit()
    db.refresh(settings)
    return get_general_settings(db)


@app.get("/api/settings/local-models")
def get_local_models_settings(db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    return {
        "provider": settings.local_provider or "ollama",
        "base_url": settings.local_base_url or "http://localhost:11434/v1",
        "model_name": settings.local_model_name or "llama3.2:latest",
        "api_key": settings.local_api_key,
    }


@app.post("/api/settings/local-models")
def update_local_models_settings(request: LocalModelsSettingsRequest, db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    data = request.model_dump(exclude_unset=True)
    if "provider" in data:
        settings.local_provider = data["provider"]
    if "base_url" in data:
        settings.local_base_url = data["base_url"]
    if "model_name" in data:
        settings.local_model_name = data["model_name"]
    if "api_key" in data:
        settings.local_api_key = data["api_key"]
    db.commit()
    db.refresh(settings)
    return get_local_models_settings(db)


@app.get("/api/settings/workspace")
def get_workspace_settings(db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    return {
        "workspace_path": settings.workspace_path or "",
        "allow_read": settings.workspace_allow_read if settings.workspace_allow_read is not None else True,
        "allow_write": settings.workspace_allow_write if settings.workspace_allow_write is not None else True,
        "require_approval": settings.workspace_require_approval if settings.workspace_require_approval is not None else True,
        "auto_detect_git": settings.workspace_auto_detect_git if settings.workspace_auto_detect_git is not None else True,
        "backup_before_edit": settings.workspace_backup_before_edit if settings.workspace_backup_before_edit is not None else True,
    }


@app.post("/api/settings/workspace")
def update_workspace_settings(request: WorkspaceSettingsRequest, db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    data = request.model_dump(exclude_unset=True)
    field_map = {
        "workspace_path": "workspace_path",
        "allow_read": "workspace_allow_read",
        "allow_write": "workspace_allow_write",
        "require_approval": "workspace_require_approval",
        "auto_detect_git": "workspace_auto_detect_git",
        "backup_before_edit": "workspace_backup_before_edit",
    }
    for source, target in field_map.items():
        if source in data:
            setattr(settings, target, data[source])
    db.commit()
    db.refresh(settings)
    return get_workspace_settings(db)


@app.get("/api/settings/model-defaults")
def get_model_defaults_settings(db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    return {
        "primary_model": settings.primary_model or "gpt-4o",
        "fallback_models": settings.fallback_models or ["claude-sonnet-4-5"],
        "temperature": settings.temperature if settings.temperature is not None else 0.7,
        "max_tokens": settings.max_tokens_default or 4096,
        "top_p": settings.top_p if settings.top_p is not None else 1.0,
        "routing_strategy": settings.routing_strategy or "balanced",
        "daily_token_limit": settings.daily_token_limit or 0,
        "monthly_token_limit": settings.monthly_token_limit or 0,
        "alert_threshold": settings.alert_threshold or 80,
    }


@app.post("/api/settings/model-defaults")
def update_model_defaults_settings(request: ModelDefaultsSettingsRequest, db: Session = Depends(get_db)) -> dict:
    settings = get_or_create_settings(db)
    data = request.model_dump(exclude_unset=True)
    field_map = {
        "primary_model": "primary_model",
        "fallback_models": "fallback_models",
        "temperature": "temperature",
        "max_tokens": "max_tokens_default",
        "top_p": "top_p",
        "routing_strategy": "routing_strategy",
        "daily_token_limit": "daily_token_limit",
        "monthly_token_limit": "monthly_token_limit",
        "alert_threshold": "alert_threshold",
    }
    for source, target in field_map.items():
        if source in data:
            setattr(settings, target, data[source])
    db.commit()
    db.refresh(settings)
    return get_model_defaults_settings(db)


@app.get("/api/rag/documents")
@app.get("/api/rag/documents/")
def list_documents(
    project_id: int,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[dict]:
    query = db.query(ContextDocument).filter(ContextDocument.project_id == project_id).order_by(ContextDocument.id.asc())
    if status:
        query = query.filter(ContextDocument.indexing_status == status)
    documents = query.offset(skip).limit(limit).all()
    return [serialize_document(document) for document in documents]


@app.get("/api/rag/documents/{document_id}")
def get_document(document_id: int, db: Session = Depends(get_db)) -> dict:
    document = db.query(ContextDocument).filter(ContextDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return serialize_document(document)


@app.delete("/api/rag/documents/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)) -> dict:
    document = db.query(ContextDocument).filter(ContextDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(document)
    db.commit()
    return {"status": "deleted", "document_id": document_id}


@app.get("/api/rag/search-history")
def get_search_history(
    project_id: int,
    limit: int = 20,
    skip: int = 0,
    db: Session = Depends(get_db),
) -> List[dict]:
    history = (
        db.query(SearchHistory)
        .filter(SearchHistory.project_id == project_id)
        .order_by(SearchHistory.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": item.id,
            "project_id": item.project_id,
            "query": item.query,
            "use_hyde": item.use_hyde,
            "hyde_auto_detected": item.hyde_auto_detected,
            "use_toon": item.use_toon,
            "top_k": item.top_k,
            "results_count": item.results_count,
            "retrieval_duration_ms": item.retrieval_duration_ms,
            "query_tokens": item.query_tokens,
            "total_context_tokens": item.total_context_tokens,
            "avg_similarity": item.avg_similarity,
            "max_similarity": item.max_similarity,
            "min_similarity": item.min_similarity,
            "results_data": item.results_data,
            "created_at": item.created_at.isoformat() if getattr(item, "created_at", None) else None,
        }
        for item in history
    ]


@app.get("/api/rag/projects/{project_id}/storage-stats")
def get_project_storage_stats(project_id: int, db: Session = Depends(get_db)) -> dict:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    documents = db.query(ContextDocument).filter(ContextDocument.project_id == project_id).all()
    indexed_nodes_count = sum(document.indexed_chunks_count or 0 for document in documents)
    document_count = len(documents)
    fallback_total_bytes = sum(document.file_size or 0 for document in documents)

    actual_storage = measure_project_storage(db, project_id)
    if actual_storage is None:
        actual_storage = {
            "exists": document_count > 0,
            "total_bytes": fallback_total_bytes,
            "table_bytes": fallback_total_bytes,
            "index_bytes": 0,
            "total_gb": fallback_total_bytes / (1024 ** 3),
        }
        message = "Minimal import backend storage metrics fallback to document bytes because the project vector table does not exist yet."
    else:
        message = "Actual storage measured from PostgreSQL system catalog (minimal import backend)."

    return {
        "project_id": project.id,
        "project_name": project.name,
        "indexing_status": project.indexing_status.value if hasattr(project.indexing_status, "value") else project.indexing_status,
        "last_indexed_at": project.last_indexed_at.isoformat() if getattr(project, "last_indexed_at", None) else None,
        "actual_storage": actual_storage,
        "configuration": {
            "chunk_size": 0,
            "chunk_overlap": 0,
            "embedding_dimensions": getattr(project, "embedding_dimension", 0) or 0,
            "indexed_nodes_count": indexed_nodes_count,
        },
        "storage_per_document_gb": (actual_storage["total_bytes"] / document_count / (1024 ** 3)) if document_count else 0,
        "message": message,
    }
