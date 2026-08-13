from agent_worker.costs import estimate_cost_usd


def test_estimates_known_model_cost():
    assert estimate_cost_usd("gpt-5.6-luna", {"input_tokens": 1_000_000, "output_tokens": 1_000_000}) == 7.0


def test_unknown_model_cost_is_not_invented():
    assert estimate_cost_usd("custom-model", {"input_tokens": 100, "output_tokens": 100}) is None
