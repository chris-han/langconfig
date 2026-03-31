from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from core.skills.loader import ParsedSkill, SkillDiscoveryResult, SkillLoader
from core.skills.registry import SkillRegistry
from core.skills import registry as registry_module


def test_skill_loader_discovers_workspace_skill_paths(tmp_path: Path):
    builtin_path = tmp_path / "builtin"
    personal_path = tmp_path / "personal"
    workspace_path = tmp_path / ".claude" / "skills"
    skill_dir = workspace_path / "langgraph-design"

    skill_dir.mkdir(parents=True)
    builtin_path.mkdir()
    personal_path.mkdir()
    (skill_dir / "SKILL.md").write_text(
        "---\nname: langgraph-design\ndescription: test\n---\n\n## Instructions\nUse this skill.\n",
        encoding="utf-8",
    )

    loader = SkillLoader(
        builtin_path=str(builtin_path),
        personal_path=str(personal_path),
        project_paths=[],
        workspace_paths=[str(workspace_path)],
    )

    discovered = loader.discover_all()

    assert len(discovered) == 1
    assert discovered[0].source_type == "project"
    assert discovered[0].skill_path == str(skill_dir)


@pytest.mark.asyncio
async def test_skill_registry_falls_back_to_filesystem_when_db_connections_exhausted(monkeypatch):
    parsed_skill = ParsedSkill(
        skill_id="langgraph-design",
        name="Langgraph Design",
        description="Guidance for LangGraph design.",
        version="1.0.0",
        author="Test",
        tags=["langgraph", "workflow"],
        triggers=["when user mentions LangGraph"],
        allowed_tools=None,
        required_context=[],
        instructions="Use the LangGraph design rules.",
        examples=None,
        source_path="/tmp/langgraph-design",
        file_modified_at=datetime.now(timezone.utc),
    )

    registry = SkillRegistry()
    monkeypatch.setattr(
        registry._loader,
        "discover_all",
        lambda: [SkillDiscoveryResult(skill_path="/tmp/langgraph-design", source_type="project", project_path="/tmp")],
    )
    monkeypatch.setattr(registry._loader, "load_skill", lambda _path: parsed_skill)

    class FakeAsyncSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def execute(self, *_args, **_kwargs):
            raise RuntimeError("sorry, too many clients already")

        async def commit(self):
            raise AssertionError("commit should not be called after DB sync degrades")

    monkeypatch.setattr(registry_module, "AsyncSessionLocal", lambda: FakeAsyncSession())

    loaded = await registry.initialize()

    assert loaded == 1
    assert registry.skill_count == 1
    assert registry.degraded_mode is True
    assert registry.list_all()[0].skill_id == "langgraph-design"
    assert any("too many clients already" in warning for warning in registry.warnings)
