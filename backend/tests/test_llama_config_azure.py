from types import SimpleNamespace

import services.llama_config as llama_config


class _DummySettings:
    embed_model = None
    llm = None


def test_initialize_llama_index_settings_prefers_azure(monkeypatch):
    captured = {}

    class FakeAzureOpenAIEmbedding:
        def __init__(self, **kwargs):
            captured["azure"] = kwargs

    class FakeOpenAIEmbedding:
        def __init__(self, **kwargs):
            captured["openai"] = kwargs

    class FakeHuggingFaceEmbedding:
        def __init__(self, **kwargs):
            captured["hf"] = kwargs

    monkeypatch.setattr(llama_config, "Settings", _DummySettings)
    monkeypatch.setattr(llama_config, "AzureOpenAIEmbedding", FakeAzureOpenAIEmbedding)
    monkeypatch.setattr(llama_config, "OpenAIEmbedding", FakeOpenAIEmbedding)
    monkeypatch.setattr(llama_config, "HuggingFaceEmbedding", FakeHuggingFaceEmbedding)
    monkeypatch.setattr(llama_config, "OpenAI", None)
    monkeypatch.setattr(llama_config, "_initialized", False)
    monkeypatch.setattr(llama_config, "_multimodal_enabled", False)
    monkeypatch.setattr(llama_config, "_embedding_dimension", 384)
    monkeypatch.setattr(
        llama_config,
        "app_settings",
        SimpleNamespace(
            EMBEDDING_MODEL="text-embedding-3-small",
            AZURE_OPENAI_ENDPOINT="https://example.openai.azure.com/",
            AZURE_OPENAI_API_VERSION="2024-05-01-preview",
            AZURE_OPENAI_EMBEDDING_DEPLOYMENT="text-embedding-3-small",
            AZURE_OPENAI_EMBEDDING_DIMENSIONS=None,
            AZURE_OPENAI_API_KEY="test-key",
            OPENAI_API_KEY=None,
            database_url="postgresql://test",
        ),
    )

    llama_config.initialize_llama_index_settings(enable_multimodal=True)

    assert "azure" in captured
    assert "openai" not in captured
    assert "hf" not in captured
    assert captured["azure"]["deployment_name"] == "text-embedding-3-small"
    assert llama_config.get_embedding_dimension() == 1536


def test_initialize_llama_index_settings_falls_back_to_hf(monkeypatch):
    captured = {}

    class FakeHuggingFaceEmbedding:
        def __init__(self, **kwargs):
            captured["hf"] = kwargs

    monkeypatch.setattr(llama_config, "Settings", _DummySettings)
    monkeypatch.setattr(llama_config, "AzureOpenAIEmbedding", None)
    monkeypatch.setattr(llama_config, "OpenAIEmbedding", None)
    monkeypatch.setattr(llama_config, "HuggingFaceEmbedding", FakeHuggingFaceEmbedding)
    monkeypatch.setattr(llama_config, "OpenAI", None)
    monkeypatch.setattr(llama_config, "_initialized", False)
    monkeypatch.setattr(llama_config, "_multimodal_enabled", False)
    monkeypatch.setattr(llama_config, "_embedding_dimension", 1536)
    monkeypatch.setattr(
        llama_config,
        "app_settings",
        SimpleNamespace(
            EMBEDDING_MODEL="text-embedding-3-small",
            AZURE_OPENAI_ENDPOINT=None,
            AZURE_OPENAI_API_VERSION="2024-05-01-preview",
            AZURE_OPENAI_EMBEDDING_DEPLOYMENT=None,
            AZURE_OPENAI_EMBEDDING_DIMENSIONS=None,
            AZURE_OPENAI_API_KEY=None,
            OPENAI_API_KEY=None,
            database_url="postgresql://test",
        ),
    )

    llama_config.initialize_llama_index_settings(enable_multimodal=True)

    assert captured["hf"]["model_name"] == "sentence-transformers/all-MiniLM-L6-v2"
    assert llama_config.get_embedding_dimension() == 384
