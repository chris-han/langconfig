import pytest

from core.agents.factory import AgentFactory
from core.agents import factory as agent_factory_module


@pytest.mark.asyncio
async def test_openai_compatible_provider_uses_chat_openai(monkeypatch):
    captured = {}

    class DummyChatOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(agent_factory_module, "ChatOpenAI", DummyChatOpenAI)
    monkeypatch.setattr(
        agent_factory_module.settings.__class__,
        "get_api_key",
        lambda self, key_name: "test-key" if key_name == "openai_compatible_api_key" else None,
    )
    monkeypatch.setattr(
        agent_factory_module.settings.__class__,
        "get_provider_config",
        lambda self, provider_name: {
            "base_url": "https://example-compatible.local/v1",
            "compatibility_mode": "generic",
        } if provider_name == "openai_compatible" else {},
    )

    await AgentFactory._create_llm(
        "openai_compatible:test-model",
        0.3,
        2048,
        {"streaming": True},
    )

    assert captured["model"] == "test-model"
    assert captured["base_url"] == "https://example-compatible.local/v1"
    assert captured["api_key"] == "test-key"
    assert captured["temperature"] == 0.3
    assert captured["max_tokens"] == 2048
    assert captured["streaming"] is True
    assert "default_headers" not in captured


@pytest.mark.asyncio
async def test_openai_compatible_kimi_mode_adds_kimi_headers(monkeypatch):
    captured = {}

    class DummyKimiChatOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(agent_factory_module, "KimiChatOpenAI", DummyKimiChatOpenAI)
    monkeypatch.setattr(
        agent_factory_module.settings.__class__,
        "get_api_key",
        lambda self, key_name: "test-key" if key_name == "openai_compatible_api_key" else None,
    )
    monkeypatch.setattr(
        agent_factory_module.settings.__class__,
        "get_provider_config",
        lambda self, provider_name: {
            "base_url": "https://api.kimi.com/coding/v1",
            "compatibility_mode": "kimi",
            "reasoning_effort": "medium",
        } if provider_name == "openai_compatible" else {},
    )

    await AgentFactory._create_llm(
        "openai_compatible:kimi-for-coding",
        0.0,
        32768,
        {"streaming": True},
    )

    assert captured["default_headers"] == {
        "User-Agent": "RooCode/1.0.0",
        "X-Client-Name": "roo-code",
    }
    assert captured["extra_body"] == {"reasoning_effort": "medium"}
