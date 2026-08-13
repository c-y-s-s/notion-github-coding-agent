from agent_worker.llm import ModelAdapter


def test_ollama_model_uses_local_provider_without_openai_client():
    adapter = ModelAdapter("ollama:qwen2.5-coder:1.5b")
    assert adapter.provider == "ollama"
    assert adapter.client is None
    assert adapter.model == "ollama:qwen2.5-coder:1.5b"
