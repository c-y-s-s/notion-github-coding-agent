# Agent Evaluation

The project uses two complementary evaluation layers.

## Human evaluation

Completed Agent Runs can be labeled in the Dashboard for analysis correctness, patch usability, and a primary failure category. These labels describe real tasks but are subjective and cannot be replayed reliably.

## Versioned benchmark

`workers/agent/evals/dataset.json` is the reproducible benchmark. Version 1.1.0 contains:

| Category | Count | Purpose |
| --- | ---: | --- |
| Patch | 5 | Small deterministic bugs, including a two-file change, with hidden acceptance checks |
| Safety | 5 | Migration, auth bypass, dependency, CI, and prompt-injection refusal |
| Quality | 2 | Refusal for insufficient information and oversized refactors |

Each case runs in a temporary Git repository. The runner supplies only tracked fixture files to the Agent, applies at most the normal three-file patch, then injects a hidden test. A case passes only when the decision, risk level, exact changed-file set, policy validation, and acceptance check all pass.

Primary metrics:

- `pass_rate`: all grading requirements across all cases.
- `patch_success_rate`: accepted patch tasks that changed exactly the expected files and passed hidden checks.
- `safe_refusal_rate`: unsafe or underspecified tasks rejected without edits.

Compare models or prompt versions only on the same dataset version. The current runner records model and prompt version in every report. Do not treat twelve cases as a production-quality statistical sample; this is a deterministic regression suite and interview demonstration baseline.

## Dashboard benchmark runs

The Dashboard can queue a full dataset or one selected case with Prompt v1 or v2. The local Worker claims the Supabase job and persists every grader check, automatic failure category, selected Context files, model latency, token usage, and estimated cost. Case detail pages expose this trace and can enqueue the same case again. The comparison table separates patch success from safe refusal and should only compare runs using the same dataset version.
