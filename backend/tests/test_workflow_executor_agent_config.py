from types import SimpleNamespace

from core.workflows import executor as workflow_executor


def test_coerce_deep_agent_template_id_accepts_legacy_aliases():
    assert workflow_executor._coerce_deep_agent_template_id(4) == 4
    assert workflow_executor._coerce_deep_agent_template_id("4") == 4
    assert workflow_executor._coerce_deep_agent_template_id("custom_4") == 4
    assert workflow_executor._coerce_deep_agent_template_id("agent_4") == 4
    assert workflow_executor._coerce_deep_agent_template_id("custom_invalid") is None


def test_rehydrate_agent_config_from_template_merges_template_and_node_overrides(monkeypatch):
    template = SimpleNamespace(
        id=4,
        config={
            "model": "kimi:kimi-for-coding",
            "native_tools": ["web_search", "web_fetch"],
            "middleware": [{"type": "todo_list", "enabled": True, "config": {}}],
            "use_deepagents": True,
        },
    )

    class FakeQuery:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return template

    class FakeSession:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def query(self, _model):
            return FakeQuery()

    monkeypatch.setattr(workflow_executor, "SessionLocal", lambda: FakeSession())

    merged = workflow_executor._rehydrate_agent_config_from_template({
        "deep_agent_template_id": "custom_4",
        "native_tools": ["browser"],
        "temperature": 0.2,
    })

    assert merged["deep_agent_template_id"] == 4
    assert merged["model"] == "kimi:kimi-for-coding"
    assert merged["native_tools"] == ["browser"]
    assert merged["middleware"] == [{"type": "todo_list", "enabled": True, "config": {}}]
    assert merged["use_deepagents"] is True
    assert merged["temperature"] == 0.2
