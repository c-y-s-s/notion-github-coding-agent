# Agent Replay E2E validation

Validated on 2026-08-13 against commit `a8405392fc51c779d9a8bcb6ae7204fe0b0de2a6` using the isolated Task `[E2E] retrying 狀態需顯示中文與黃色`.

| | Original | Exact Replay |
| --- | --- | --- |
| Run | `caddc399` | `c7a42341` |
| Prompt | v1 | v2 |
| Base commit | `a840539` | `a840539` |
| Context manifest | 6 paths with identical SHA-256 hashes | 6 paths with identical SHA-256 hashes |
| Baseline | lint, typecheck, test passed | lint, typecheck, test passed |
| Attempts | 1 | 1 |
| Result | awaiting approval, then manually rejected | failed safely at evidence gate |
| Input / output tokens | 20,097 / 1,606 | 20,128 / 1,683 |
| Estimated cost | $0.029733 | $0.030226 |

The original produced a correct one-file `StatusBadge` patch and two Worker-verified citations. The Exact Replay reproduced Task, commit, and Context, but Prompt v2 cited file-relative lines as if they were global Context lines. Both citations failed deterministic verification, so the patch was blocked with `PATCH_EVIDENCE_MISSING`. This negative result is retained: stronger evidence wording did not improve this task and cost slightly more.

The run also exposed production retrieval contamination: generated Evaluation fixtures and reports occupied four of six Context slots. Production indexing now excludes `workers/agent/evals/` and `workers/agent/eval-results/`, and semantic results are filtered against the current allowed document set so stale cached vectors cannot reintroduce them.

No branch or PR was created. The original was rejected and the Replay failed before approval.
