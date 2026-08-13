import subprocess

from agent_worker.retrieval import hybrid_rank, tracked_documents


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


def test_hybrid_rank_does_not_let_semantic_noise_override_strong_lexical_evidence():
    documents = [
        {"path": "calculator.js", "content": "export function calculate() {}"},
        {"path": "calculator-ui.js", "content": "export function calculatorLabel() {}"},
        {"path": "unrelated.js", "content": "export const value = true"},
    ]
    semantic = [
        {"path": "unrelated.js", "similarity": 0.99},
        {"path": "calculator-ui.js", "similarity": 0.8},
        {"path": "calculator.js", "similarity": 0.7},
    ]

    assert hybrid_rank(documents, semantic, "fix calculate function", limit=1) == ["calculator.js"]


def test_production_index_excludes_evaluation_corpus(tmp_path):
    source = tmp_path / "apps/web/status.ts"
    fixture = tmp_path / "workers/agent/evals/fixtures/status.ts"
    report = tmp_path / "workers/agent/eval-results/latest.json"
    for path in (source, fixture, report):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("export const status = 'retrying'\n")
    subprocess.run(["git", "init", "-b", "main"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True, capture_output=True)

    paths = [item["path"] for item in tracked_documents(tmp_path)]

    assert paths == ["apps/web/status.ts"]


def test_hybrid_rank_ignores_stale_vector_paths():
    documents = [{"path": "src/status.ts", "content": "retrying status"}]
    semantic = [
        {"path": "workers/agent/evals/status.ts", "similarity": 0.99},
        {"path": "src/status.ts", "similarity": 0.5},
    ]
    assert hybrid_rank(documents, semantic, "retrying", limit=3) == ["src/status.ts"]
