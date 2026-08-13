from agent_worker.retrieval import hybrid_rank


def test_hybrid_rank_combines_semantic_and_lexical_signals():
    documents = [
        {"path": "src/payment.ts", "content": "export function chargeCard() {}"},
        {"path": "src/status.ts", "content": "export const cancelled = 'green'"},
        {"path": "src/other.ts", "content": "export const value = 1"},
    ]
    semantic = [
        {"path": "src/payment.ts", "similarity": 0.8},
        {"path": "src/status.ts", "similarity": 0.7},
    ]

    ranked = hybrid_rank(documents, semantic, "cancelled status badge", limit=2)

    assert ranked == ["src/status.ts", "src/payment.ts"]


def test_hybrid_rank_is_deterministic_for_equal_scores():
    documents = [
        {"path": "b.ts", "content": "retrying"},
        {"path": "a.ts", "content": "retrying"},
    ]
    assert hybrid_rank(documents, [], "retrying", limit=2) == ["a.ts", "b.ts"]
