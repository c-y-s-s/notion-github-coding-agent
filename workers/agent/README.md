# Local agent worker

The worker claims queued runs, validates the baseline, asks the model for at most three complete-file edits, enforces path policy, reruns checks, and stores a reviewable diff. It only commits and pushes after the run is explicitly approved.

Run with `python -m agent_worker.worker` after installing the project and configuring `.env`.
