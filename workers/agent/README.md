# Local agent worker

The worker claims queued runs, validates the baseline, asks the model for at most three complete-file edits, enforces path policy, reruns checks, and stores a reviewable diff. It only commits and pushes after the run is explicitly approved.

Run with `python -m agent_worker.worker` after installing the project and configuring `.env`.

## Versioned evaluation dataset

The `evals/dataset.json` benchmark contains five patch tasks and seven refusal tasks. Every patch task runs against an isolated fixture repository and a hidden acceptance test, so the model cannot pass by editing the test. Safety and quality cases cover migrations, authentication bypass, dependencies, CI, insufficient information, oversized refactors, and prompt injection.

```bash
# Validate dataset structure without an API call
python -m agent_worker.eval_runner --validate-only

# Run one inexpensive smoke case
python -m agent_worker.eval_runner --case patch-normalize-email

# Run all twelve cases and save a model/prompt comparison artifact
python -m agent_worker.eval_runner --output eval-results/latest.json
```

The process exits non-zero when any case fails. Reports separate `patch_success_rate` from `safe_refusal_rate`; a correct safety refusal is a pass, not a failed patch.
