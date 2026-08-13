import json
import math
import os
import time
from datetime import UTC, datetime

from dotenv import load_dotenv
from openai import OpenAI

from .eval_runner import EVAL_ROOT, REPO_ROOT, load_dataset, validate_dataset
from .retrieval import hybrid_rank, lexical_rank

OUTPUT = REPO_ROOT / "workers/agent/eval-results/retrieval-latest.json"
DISTRACTOR_ROOT = EVAL_ROOT / "retrieval-distractors"
RETRIEVAL_DATASET_VERSION = "1.0.0"


def evaluate_ranking(ranked: list[str], expected: list[str], k: int) -> dict:
    selected = ranked[:k]
    relevant = set(expected)
    hits = [path for path in selected if path in relevant]
    first = next((index + 1 for index, path in enumerate(ranked) if path in relevant), None)
    return {
        "recall_at_k": len(hits) / len(relevant) if relevant else 1.0,
        "precision_at_k": len(hits) / k if k else 0.0,
        "mrr": 1 / first if first else 0.0,
        "hits": hits,
        "selected": selected,
    }


def cosine(left: list[float], right: list[float]) -> float:
    denominator = math.sqrt(sum(value * value for value in left)) * math.sqrt(sum(value * value for value in right))
    return sum(a * b for a, b in zip(left, right, strict=True)) / denominator if denominator else 0.0


def run_retrieval_evaluation(k: int = 3) -> dict:
    dataset = load_dataset()
    errors = validate_dataset(dataset)
    if errors:
        raise ValueError("\n".join(errors))
    client = OpenAI()
    model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    results = []
    for case in dataset.cases:
        if not case.expected.retrieval_files:
            continue
        fixture = EVAL_ROOT / "fixtures" / case.fixture
        documents = [
            {"path": path.name, "content": path.read_text(errors="replace")}
            for path in sorted(fixture.iterdir())
            if path.is_file() and path.suffix in {".js", ".json"} and "lock" not in path.name
        ]
        documents.extend(
            {"path": f"distractors/{path.name}", "content": path.read_text(errors="replace")}
            for path in sorted(DISTRACTOR_ROOT.iterdir())
            if path.is_file() and path.suffix == ".js"
        )
        query = f"{case.task.title}\n{case.task.description}\n{case.task.acceptance_criteria}"
        started = time.monotonic()
        keyword = lexical_rank(documents, query, len(documents))
        keyword_ms = round((time.monotonic() - started) * 1000, 3)
        started = time.monotonic()
        response = client.embeddings.create(
            model=model,
            input=[query, *[f"FILE: {item['path']}\n{item['content']}" for item in documents]],
            dimensions=1536,
        )
        query_vector = response.data[0].embedding
        semantic = [
            {"path": document["path"], "similarity": cosine(query_vector, vector.embedding)}
            for document, vector in zip(documents, response.data[1:], strict=True)
        ]
        hybrid = hybrid_rank(documents, sorted(semantic, key=lambda item: -item["similarity"]), query, len(documents))
        hybrid_ms = round((time.monotonic() - started) * 1000, 3)
        expected = case.expected.retrieval_files
        content_sizes = {document["path"]: len(document["content"]) for document in documents}
        keyword_metrics = evaluate_ranking(keyword, expected, min(k, len(documents)))
        hybrid_metrics = evaluate_ranking(hybrid, expected, min(k, len(documents)))
        results.append(
            {
                "case_id": case.id,
                "name": case.name,
                "category": case.category,
                "expected_files": expected,
                "document_count": len(documents),
                "keyword": {**keyword_metrics, "duration_ms": keyword_ms, "context_chars": sum(content_sizes[path] for path in keyword_metrics["selected"])},
                "hybrid": {**hybrid_metrics, "duration_ms": hybrid_ms, "context_chars": sum(content_sizes[path] for path in hybrid_metrics["selected"])},
            }
        )
    return {
        "dataset_version": dataset.version,
        "retrieval_dataset_version": RETRIEVAL_DATASET_VERSION,
        "embedding_model": model,
        "k": k,
        "created_at": datetime.now(UTC).isoformat(),
        "summary": {strategy: aggregate(results, strategy) for strategy in ("keyword", "hybrid")},
        "results": results,
        "limitations": [
            "Each measured case ranks 19 to 21 files, including a shared corpus with overlapping names, keywords, and responsibilities.",
            "Patch success is reported separately because model behavior is a confounding variable.",
        ],
    }


def aggregate(results: list[dict], strategy: str) -> dict:
    return {
        metric: round(sum(result[strategy][metric] for result in results) / len(results), 4)
        for metric in ("recall_at_k", "precision_at_k", "mrr", "duration_ms", "context_chars")
    }


def main() -> None:
    load_dotenv(REPO_ROOT / "apps/web/.env.local")
    load_dotenv(REPO_ROOT / ".env", override=False)
    report = run_retrieval_evaluation()
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
