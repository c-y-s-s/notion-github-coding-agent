import hashlib
import os
import re
import time
from pathlib import Path

from openai import OpenAI

ALLOWED_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".json"}
MAX_INDEX_FILES = 120
MAX_FILE_CHARS = 6_000
CONTEXT_FILES = 12


def lexical_rank(documents: list[dict], query: str, limit: int = CONTEXT_FILES) -> list[str]:
    keywords = {word.lower() for word in re.findall(r"[A-Za-z][A-Za-z0-9_]{2,}", query)}
    ranked = []
    for document in documents:
        haystack = f"{document['path']}\n{document['content']}".lower()
        score = sum(1 for keyword in keywords if keyword in haystack)
        ranked.append((score, document["path"]))
    return [path for _, path in sorted(ranked, key=lambda item: (-item[0], item[1]))[:limit]]


def tracked_documents(root: Path) -> list[dict]:
    from .git_ops import run

    documents = []
    for name in run(["git", "ls-files"], root).stdout.splitlines():
        path = root / name
        if (
            path.suffix not in ALLOWED_SUFFIXES
            or any(part in path.parts for part in ("node_modules", ".next"))
            or "lock" in path.name.lower()
        ):
            continue
        try:
            content = path.read_text(errors="replace")[:MAX_FILE_CHARS]
        except OSError:
            continue
        if content.strip():
            documents.append(
                {
                    "path": name,
                    "content": content,
                    "hash": hashlib.sha256(content.encode()).hexdigest(),
                }
            )
        if len(documents) >= MAX_INDEX_FILES:
            break
    return documents


def hybrid_rank(documents: list[dict], semantic: list[dict], query: str, limit: int = CONTEXT_FILES) -> list[str]:
    keywords = {word.lower() for word in re.findall(r"[A-Za-z][A-Za-z0-9_]{2,}", query)}
    scores: dict[str, float] = {}
    for document in documents:
        haystack = f"{document['path']}\n{document['content']}".lower()
        lexical = sum(1 for keyword in keywords if keyword in haystack)
        if lexical:
            scores[document["path"]] = 2 * lexical / max(1, len(keywords))
    for rank, item in enumerate(semantic):
        scores[item["path"]] = scores.get(item["path"], 0) + 2 / (rank + 1) + max(0, item["similarity"])
    return [path for path, _ in sorted(scores.items(), key=lambda item: (-item[1], item[0]))[:limit]]


def retrieve_context(client, repository_id: str, commit_sha: str, root: Path, task: dict) -> tuple[str, dict]:
    from .worker import repository_context

    query = "\n".join(str(task.get(key) or "") for key in ("title", "description", "acceptance_criteria"))
    documents = tracked_documents(root)
    started = time.monotonic()
    try:
        model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        existing = (
            client.table("repository_embeddings")
            .select("path,content_hash")
            .eq("repository_id", repository_id)
            .eq("commit_sha", commit_sha)
            .execute()
            .data
        )
        known = {row["path"]: row["content_hash"] for row in existing}
        missing = [document for document in documents if known.get(document["path"]) != document["hash"]]
        openai = OpenAI()
        for offset in range(0, len(missing), 32):
            batch = missing[offset : offset + 32]
            response = openai.embeddings.create(
                model=model,
                input=[f"FILE: {item['path']}\n{item['content']}" for item in batch],
                dimensions=1536,
            )
            rows = [
                {
                    "repository_id": repository_id,
                    "commit_sha": commit_sha,
                    "path": item["path"],
                    "content_hash": item["hash"],
                    "embedding": vector.embedding,
                }
                for item, vector in zip(batch, response.data, strict=True)
            ]
            if rows:
                client.table("repository_embeddings").upsert(
                    rows, on_conflict="repository_id,commit_sha,path"
                ).execute()
        query_vector = openai.embeddings.create(model=model, input=query, dimensions=1536).data[0].embedding
        semantic = client.rpc(
            "match_repository_embeddings",
            {
                "repository_uuid": repository_id,
                "repository_commit": commit_sha,
                "query_embedding": query_vector,
                "match_count": 20,
            },
        ).execute().data
        selected = hybrid_rank(documents, semantic, query)
        if not selected:
            raise RuntimeError("Semantic retrieval returned no files")
        context = repository_context(root, task, limit=40_000, preferred_paths=selected, allowed_paths=set(selected))
        actual_files = [line[4:-4] for line in context.splitlines() if line.startswith("--- ") and line.endswith(" ---")]
        return context, {
            "method": "hybrid_embedding",
            "embedding_model": model,
            "indexed_files": len(documents),
            "new_embeddings": len(missing),
            "selected_files": actual_files,
            "duration_ms": round((time.monotonic() - started) * 1000),
            "fallback_reason": None,
        }
    except Exception as error:  # noqa: BLE001 - retrieval must degrade without blocking the Agent
        context = repository_context(root, task)
        return context, {
            "method": "keyword_fallback",
            "embedding_model": None,
            "indexed_files": len(documents),
            "new_embeddings": 0,
            "selected_files": [],
            "duration_ms": round((time.monotonic() - started) * 1000),
            "fallback_reason": str(error)[:500],
        }
