# Workflow

- A Notion task is imported but does not create a GitHub issue automatically. The user creates it from Task Detail.
- A GitHub issue enters Inbox. Accept creates a Notion sync job, Link selects an existing Notion task, Needs Info waits, and Ignore remains archived.
- Prepare Patch queues a run. The worker checks the baseline, prepares a constrained patch, reruns checks, and stores the diff.
- The user approves or rejects the exact run. Approval causes a fresh default-branch SHA check, commit, and push. PR creation remains manual.
- A merged PR marks the related task done.

