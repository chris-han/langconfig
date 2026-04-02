# Copyright (c) 2025 Cade Russell (Ghost Peony)
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

"""
LlamaIndex Configuration Service

This module provides centralized configuration for LlamaIndex integration,
including global settings initialization and multi-tenant PGVector store setup.
"""

import logging
import os
from typing import Optional, Union
from urllib.parse import urlparse

from config import settings as app_settings

logger = logging.getLogger(__name__)

# Try to import LlamaIndex - it's optional
try:
    from llama_index.core import Settings
    from llama_index.vector_stores.postgres import PGVectorStore
    LLAMAINDEX_AVAILABLE = True
except ImportError:
    logger.warning("LlamaIndex core/vector store not available. Vector store features will be disabled.")
    LLAMAINDEX_AVAILABLE = False
    Settings = None
    PGVectorStore = None

try:
    from llama_index.embeddings.azure_openai import AzureOpenAIEmbedding
except ImportError:
    AzureOpenAIEmbedding = None

try:
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding
except ImportError:
    HuggingFaceEmbedding = None

try:
    from llama_index.embeddings.openai import OpenAIEmbedding
except ImportError:
    OpenAIEmbedding = None

try:
    from llama_index.llms.openai import OpenAI
except ImportError:
    OpenAI = None

try:
    from llama_index.llms.azure_openai import AzureOpenAI as AzureOpenAILLM
except ImportError:
    AzureOpenAILLM = None

# Global flag to track initialization
_initialized = False
_multimodal_enabled = False
_embedding_dimension = 384


def _resolve_embedding_dimension(model_name: Optional[str], explicit_dimension: Optional[int], default: int) -> int:
    if explicit_dimension:
        return explicit_dimension

    model = (model_name or "").strip()
    model_defaults = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
    }
    return model_defaults.get(model, default)

def initialize_llama_index_settings(
    litellm_proxy_url: Optional[str] = None, 
    litellm_api_key: Optional[str] = None,
    enable_multimodal: bool = True
):
    """
    Initialize the global LlamaIndex Settings object with optional multimodal support.
    
    Args:
        litellm_proxy_url: URL for the LiteLLM proxy service
        litellm_api_key: API key for LiteLLM proxy authentication
        enable_multimodal: Whether to use multimodal embeddings (requires OpenAI API key)
    """
    global _initialized, _multimodal_enabled, _embedding_dimension
    
    if _initialized:
        logger.info("LlamaIndex settings already initialized")
        return
    
    try:
        if not LLAMAINDEX_AVAILABLE or Settings is None:
            raise RuntimeError("LlamaIndex core/vector store dependencies are not installed")

        embedding_model = app_settings.EMBEDDING_MODEL or "text-embedding-3-small"
        openai_api_key = app_settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
        azure_api_key = app_settings.AZURE_OPENAI_API_KEY
        azure_endpoint = app_settings.AZURE_OPENAI_ENDPOINT
        azure_api_version = app_settings.AZURE_OPENAI_API_VERSION or "2024-05-01-preview"
        azure_deployment = app_settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT
        azure_embedding_dimension = app_settings.AZURE_OPENAI_EMBEDDING_DIMENSIONS

        if azure_endpoint and azure_api_key and azure_deployment and AzureOpenAIEmbedding:
            _embedding_dimension = _resolve_embedding_dimension(
                embedding_model,
                azure_embedding_dimension,
                1536,
            )
            logger.info(
                "Initializing Azure OpenAI embedding model",
            )
            Settings.embed_model = AzureOpenAIEmbedding(
                model=embedding_model,
                deployment_name=azure_deployment,
                api_key=azure_api_key,
                azure_endpoint=azure_endpoint,
                api_version=azure_api_version,
            )
            _multimodal_enabled = False
            logger.info(
                "Azure OpenAI embeddings enabled with deployment '%s' and model '%s' (%sD)",
                azure_deployment,
                embedding_model,
                _embedding_dimension,
            )

        elif enable_multimodal and openai_api_key and OpenAIEmbedding:
            _embedding_dimension = _resolve_embedding_dimension(embedding_model, None, 1024)
            logger.info("Initializing OpenAI multimodal embedding model")
            Settings.embed_model = OpenAIEmbedding(
                model=embedding_model,
                dimensions=_embedding_dimension,
                api_key=openai_api_key
            )
            _multimodal_enabled = True
            logger.info(
                "Multimodal embeddings enabled with OpenAI model '%s' (%sD)",
                embedding_model,
                _embedding_dimension,
            )
        else:
            if enable_multimodal:
                logger.warning(
                    "Cloud embeddings requested but Azure/OpenAI config not available, falling back to text-only"
                )
            if HuggingFaceEmbedding is None:
                raise RuntimeError(
                    "HuggingFace embedding fallback is unavailable in this backend profile. "
                    "Install llama-index-embeddings-huggingface or configure Azure/OpenAI embeddings."
                )
            logger.info("Initializing HuggingFace text-only embedding model")
            Settings.embed_model = HuggingFaceEmbedding(
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
            _multimodal_enabled = False
            _embedding_dimension = 384
        
        # Configure LLM for HyDE
        # Priority: explicit rag_llm_provider DB setting → dynamically detected configured providers → litellm proxy
        _llm_configured = False

        # Read rag_llm_provider and all relevant settings in one query
        _rag_llm_provider = "auto"
        _azure_endpoint = None
        _azure_api_version = "2024-05-01-preview"
        _raw_provider_configs: dict = {}
        try:
            from db.database import SessionLocal as _SyncSession
            from sqlalchemy import text as _text
            with _SyncSession() as _db:
                _row = _db.execute(_text(
                    "SELECT rag_llm_provider, azure_openai_endpoint, azure_openai_api_version, provider_configs "
                    "FROM settings WHERE id = 1"
                )).fetchone()
                if _row:
                    _rag_llm_provider = _row[0] or "auto"
                    _azure_endpoint = _row[1]
                    _azure_api_version = _row[2] or "2024-05-01-preview"
                    _raw_provider_configs = dict(_row[3] or {})
        except Exception as _pe:
            logger.debug("Could not read settings from DB for LLM init: %s", _pe)

        def _try_azure() -> bool:
            """Attempt to configure Azure OpenAI as the HyDE LLM. Returns True on success."""
            _az_key = app_settings.AZURE_OPENAI_API_KEY
            if not (_az_key and _azure_endpoint and AzureOpenAILLM is not None):
                return False
            _az_deployment = app_settings.default_model or "gpt-4o"
            Settings.llm = AzureOpenAILLM(
                model=_az_deployment,
                deployment_name=_az_deployment,
                api_key=_az_key,
                azure_endpoint=_azure_endpoint,
                api_version=_azure_api_version,
            )
            logger.info("Configured HyDE LLM via Azure OpenAI (deployment=%s)", _az_deployment)
            return True

        def _try_provider_config(pname: str, cfg: dict) -> bool:
            """Attempt to configure a provider_configs entry as the HyDE LLM. Returns True on success."""
            base_url = cfg.get("base_url") or cfg.get("baseUrl") or ""
            if not base_url or cfg.get("enabled") is False:
                return False
            _api_key = app_settings.get_api_key(f"{pname}_api_key")
            if not (_api_key and OpenAI is not None):
                return False
            models = cfg.get("models") or []
            model_name = models[0] if models else "gpt-4o-mini"
            Settings.llm = OpenAI(model=model_name, api_base=base_url.rstrip("/"), api_key=_api_key)
            logger.info("Configured HyDE LLM via provider '%s' (model=%s, base=%s)", pname, model_name, base_url)
            return True

        if _rag_llm_provider != "auto":
            # Explicit provider selected — try only that one
            try:
                if _rag_llm_provider == "azure_openai":
                    _llm_configured = _try_azure()
                else:
                    _cfg = _raw_provider_configs.get(_rag_llm_provider, {})
                    _llm_configured = _try_provider_config(_rag_llm_provider, _cfg)
            except Exception as _e:
                logger.warning("Could not configure HyDE LLM for selected provider '%s': %s", _rag_llm_provider, _e)
        else:
            # Auto mode — try azure_openai first, then every enabled provider_configs entry in order
            try:
                _llm_configured = _try_azure()
            except Exception as _e:
                logger.warning("Azure OpenAI HyDE init failed: %s", _e)

            if not _llm_configured:
                for _pname, _cfg in _raw_provider_configs.items():
                    try:
                        if _try_provider_config(_pname, _cfg):
                            _llm_configured = True
                            break
                    except Exception as _e:
                        logger.warning("Provider '%s' HyDE init failed: %s", _pname, _e)

        if not _llm_configured:
            if litellm_proxy_url and litellm_api_key:
                logger.info("Configuring LLM with LiteLLM proxy: %s", litellm_proxy_url)
                Settings.llm = OpenAI(
                    model="gpt-4o-mini",
                    api_base=f"{litellm_proxy_url}/v1",
                    api_key=litellm_api_key,
                )
            else:
                logger.warning("No LLM provider configured for HyDE. Set rag_llm_provider in RAG Configuration.")
        
        _initialized = True
        logger.info("LlamaIndex settings initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize LlamaIndex settings: {e}")
        raise


def get_vector_store(project_id: int, embed_dim: Optional[int] = None) -> PGVectorStore:
    """
    Initialize and return a PGVectorStore for the specified project.
    
    This implements multi-tenancy by using project-specific table names,
    ensuring strict data isolation between different projects.
    
    Args:
        project_id: The project identifier for multi-tenant isolation
        embed_dim: Embedding dimension (default: auto-detect based on current model)
        
    Returns:
        PGVectorStore: Configured vector store instance
        
    Raises:
        ValueError: If database URL is invalid or missing
        Exception: If vector store initialization fails
    """
    if not app_settings.database_url:
        raise ValueError("database_url is required but not configured")

    # Auto-detect embedding dimension if not provided
    if embed_dim is None:
        embed_dim = get_embedding_dimension()

    # Parse the database URL to extract connection parameters
    parsed_url = urlparse(app_settings.database_url)
    
    # Ensure we have proper connection details (port defaults to 5432 for PostgreSQL)
    port = parsed_url.port or 5432
    if not all([parsed_url.hostname, parsed_url.username,
                parsed_url.password, parsed_url.path]):
        raise ValueError("Invalid database_url format. Missing required connection parameters.")
    
    # Extract database name (remove leading '/')
    database_name = parsed_url.path.lstrip('/')

    # LlamaIndex's PGVectorStore internally prepends "data_" to the index_name passed here,
    # so the actual PostgreSQL table created will be "data_{index_name}".
    # We pass "project_index_{project_id}" so the actual table becomes
    # "data_project_index_{project_id}" — matching what get_table_name() returns.
    table_name = f"project_index_{project_id}"

    logger.info(f"Initializing PGVectorStore for project {project_id} with table 'data_{table_name}'")
    
    try:
        vector_store = PGVectorStore.from_params(
            database=database_name,
            host=parsed_url.hostname,
            port=port,
            user=parsed_url.username,
            password=parsed_url.password,
            table_name=table_name,
            embed_dim=embed_dim,
            # Additional configuration for robustness
            hnsw_kwargs={
                "hnsw_m": 16,
                "hnsw_ef_construction": 64,
                "hnsw_ef_search": 40,
            }
        )
        
        logger.info(f"PGVectorStore initialized successfully for project {project_id}")
        return vector_store
        
    except Exception as e:
        logger.error(f"Failed to initialize PGVectorStore for project {project_id}: {e}")
        raise


def ensure_initialized():
    """
    Ensure LlamaIndex settings are initialized before use.

    This is a convenience function that can be called to guarantee
    initialization has occurred before using LlamaIndex components.
    """
    if not _initialized:
        logger.info("LlamaIndex not yet initialized, initializing with default settings")
        # Configure LiteLLM proxy for HyDE support
        litellm_url = os.getenv("LITELLM_PROXY_URL", "http://litellm-proxy:4000")
        litellm_key = os.getenv("LITELLM_API_KEY", "sk-proxy-master-key")
        initialize_llama_index_settings(
            litellm_proxy_url=litellm_url,
            litellm_api_key=litellm_key,
            enable_multimodal=True
        )


def reset_initialization():
    """
    Reset the initialization flag so the next call to ensure_initialized()
    will re-run LlamaIndex settings (e.g. after an API key is saved).
    """
    global _initialized
    _initialized = False
    logger.info("LlamaIndex initialization flag reset; will reinitialize on next use")


def get_embedding_dimension() -> int:
    """
    Get the embedding dimension used by the configured embedding model.
    
    Returns:
        int: Embedding dimension (1024 for multimodal, 384 for text-only)
    """
    global _embedding_dimension
    return _embedding_dimension


def is_multimodal_enabled() -> bool:
    """
    Check if multimodal embeddings are currently enabled.
    
    Returns:
        bool: True if multimodal embeddings are active
    """
    global _multimodal_enabled
    return _multimodal_enabled


def get_table_name(project_id: int) -> str:
    """
    Generate the table name for a given project ID.
    
    This follows the multi-tenant naming convention used by the vector store.
    
    Args:
        project_id: The project identifier
        
    Returns:
        str: The table name for the project's vector data
    """
    return f"data_project_index_{project_id}"
