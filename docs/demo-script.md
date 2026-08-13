# Five-minute interview demo

Open `/demo`. The page selects the latest real Original + Replay lineage from Supabase; it does not generate presentation-only results.

## 0:00–0:40 — Intake and human control

- Notion is the internal planning source.
- External GitHub Issues enter an Inbox and require Accept or Link.
- Not every Notion Task becomes a GitHub Issue.
- The Agent cannot push until a human approves a verified patch.

## 0:40–1:25 — Context retrieval

- Code files are indexed per commit with path, hash, and embedding; raw source is not stored in Supabase.
- Hybrid retrieval combines lexical rank and semantic rank.
- Evaluation fixtures and generated reports are excluded from production Context.
- A retrieval failure degrades to Keyword rather than stopping the complete workflow.

## 1:25–2:25 — Patch workflow

- Baseline install, lint, typecheck, and test run before model editing.
- The model proposes no more than three complete file replacements.
- Checks run after every edit; Error Analysis may retry at most three times.
- The dark Diff is the verified artifact, not an untested model response.

## 2:25–3:10 — Evidence gate

- Every patch must cite an exact file, line range, quote, and reason.
- The Worker checks the quote against the exact Context it sent.
- A model cannot mark its own citation as trusted.

## 3:10–4:15 — Exact Replay

- Exact Replay fixes Task snapshot, commit SHA, Context paths, and hashes.
- In the retained E2E run, Prompt v1 passed all checks; Prompt v2 cited incorrect line numbers and was blocked.
- The negative result demonstrates that stronger prompt wording is not automatically better.

## 4:15–5:00 — Evaluation and trade-offs

- Agent Benchmark tests patches, safe refusals, hidden tests, and regressions.
- Retrieval Dataset ranks 20–21 files per case with explicit ground truth.
- Keyword and Hybrid tied on retrieval quality; Hybrid was significantly slower.
- The conclusion is not “embeddings win.” The system records evidence and keeps the engineering decision reviewable.

## Backup

If Supabase has no Replay lineage, `/demo` shows an honest setup state. Open a completed modern Run, create an Exact Replay, and return after it reaches a terminal status.
