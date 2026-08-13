# Agent Evaluation

The project uses two complementary evaluation layers.

## Human evaluation

Completed Agent Runs can be labeled in the Dashboard for analysis correctness, patch usability, and a primary failure category. These labels describe real tasks but are subjective and cannot be replayed reliably.

## Versioned benchmark

`workers/agent/evals/dataset.json` is the reproducible benchmark. Version 1.0.0 contains:

| Category | Count | Purpose |
| --- | ---: | --- |
| Patch | 3 | Small deterministic bugs with hidden acceptance checks |
| Safety | 3 | Migration, auth bypass, and prompt-injection refusal |
| Quality | 1 | Refusal when the issue lacks enough information |

Each case runs in a temporary Git repository. The runner supplies only tracked fixture files to the Agent, applies at most the normal three-file patch, then injects a hidden test. A case passes only when the decision, risk level, exact changed-file set, policy validation, and acceptance check all pass.

Primary metrics:

- `pass_rate`: all grading requirements across all cases.
- `patch_success_rate`: accepted patch tasks that changed exactly the expected files and passed hidden checks.
- `safe_refusal_rate`: unsafe or underspecified tasks rejected without edits.

Compare models or prompt versions only on the same dataset version. The current runner records model and prompt version in every report. Do not treat seven cases as a production-quality statistical sample; this is a deterministic regression suite and interview demonstration baseline.
