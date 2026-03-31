import sys
from types import SimpleNamespace

import pytest

from models.deep_agent import DeepAgentConfig
from services import deepagent_factory as deepagent_factory_module
from services.deepagent_factory import DeepAgentFactory


def test_load_deepagent_execution_contract_prompt_raises_when_missing(monkeypatch, tmp_path):
    missing_prompt = tmp_path / "missing_execution_contract.md"
    monkeypatch.setattr(
        deepagent_factory_module,
        "DEEPAGENT_EXECUTION_CONTRACT_PROMPT_PATH",
        missing_prompt,
    )

    with pytest.raises(FileNotFoundError, match="Missing prompt asset for deepagent_execution_contract"):
        deepagent_factory_module.load_deepagent_execution_contract_prompt()


@pytest.mark.asyncio
async def test_create_deep_agent_injects_execution_contract_context(monkeypatch):
    captured = {}

    def fake_create_deep_agent(**kwargs):
        captured.update(kwargs)
        return object()

    async def fake_create_llm(*_args, **_kwargs):
        return object()

    async def fake_setup_callbacks(*_args, **_kwargs):
        return []

    async def fake_load_base_tools(*_args, **_kwargs):
        return []

    async def fake_prepare_subagents(*_args, **_kwargs):
        return []

    monkeypatch.setattr(deepagent_factory_module.AgentFactory, "_create_llm", fake_create_llm)
    monkeypatch.setattr(DeepAgentFactory, "_setup_callbacks", fake_setup_callbacks)
    monkeypatch.setattr(DeepAgentFactory, "_load_base_tools", fake_load_base_tools)
    monkeypatch.setattr(DeepAgentFactory, "_prepare_subagents", fake_prepare_subagents)
    monkeypatch.setitem(
        sys.modules,
        "deepagents",
        SimpleNamespace(create_deep_agent=fake_create_deep_agent),
    )
    monkeypatch.setitem(
        sys.modules,
        "services.deepagents_instrumentation",
        SimpleNamespace(
            instrument_deepagents_middleware=lambda middleware, callback_handler=None: middleware,
            create_todo_tracker=lambda *args, **kwargs: None,
        ),
    )
    monkeypatch.setitem(
        sys.modules,
        "core.workflows.checkpointing.manager",
        SimpleNamespace(get_checkpointer=lambda: None),
    )

    config = DeepAgentConfig(
        model="gpt-4o-mini",
        temperature=0.1,
        system_prompt="You are a coding agent.",
        native_tools=[],
        cli_tools=[],
        custom_tools=[],
        middleware=[],
        subagents=[],
    )

    agent, tools, callbacks = await DeepAgentFactory.create_deep_agent(
        config=config,
        project_id=1,
        task_id=2,
        context="Task: create a journal entry workflow",
        mcp_manager=None,
        vector_store=None,
    )

    assert agent is not None
    assert tools == []
    assert callbacks == []
    assert captured["system_prompt"].startswith("You are operating under a bounded execution contract.")
    assert "# Role\nYou are a coding agent." in captured["system_prompt"]
    assert "# Runtime Context\nTask: create a journal entry workflow" in captured["system_prompt"]
    assert "After each material action, evaluate whether the deliverable is already complete." in captured["system_prompt"]
