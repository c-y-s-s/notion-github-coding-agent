from agent_worker.retrieval_eval import evaluate_ranking


def test_retrieval_metrics_reward_early_relevant_files():
    metrics = evaluate_ranking(["noise.js", "target.js", "other.js"], ["target.js"], 3)
    assert metrics["recall_at_k"] == 1
    assert metrics["precision_at_k"] == 1 / 3
    assert metrics["mrr"] == 0.5


def test_retrieval_metrics_detect_missing_ground_truth():
    metrics = evaluate_ranking(["noise.js"], ["target.js"], 1)
    assert metrics["recall_at_k"] == 0
    assert metrics["mrr"] == 0
