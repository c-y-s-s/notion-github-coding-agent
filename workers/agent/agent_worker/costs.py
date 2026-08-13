PRICE_PER_MILLION = {
    "gpt-5.6-luna": {"input": 1.0, "output": 6.0},
    "gpt-5.6-terra": {"input": 2.5, "output": 15.0},
    "gpt-5.6-sol": {"input": 5.0, "output": 30.0},
}


def estimate_cost_usd(model: str, usage: dict) -> float | None:
    price = PRICE_PER_MILLION.get(model)
    if not price:
        return None
    value = (
        usage.get("input_tokens", 0) * price["input"]
        + usage.get("output_tokens", 0) * price["output"]
    ) / 1_000_000
    return round(value, 8)
