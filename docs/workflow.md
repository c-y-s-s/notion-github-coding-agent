# Workflow

GitHub Webhook 是即時同步的主要入口。正式環境另以 Vercel Cron 每天 04:00 UTC（台北時間 12:00）執行 reconciliation，補回漏送的開啟 Issue 與 PR 狀態，並處理最多 10 筆待回寫 Notion 的工作。Cron 只作為安全網，不取代 Webhook。

- A Notion task is imported but does not create a GitHub issue automatically. The user creates it from Task Detail.
- A GitHub issue enters Inbox. Accept creates a Notion sync job, Link selects an existing Notion task, Needs Info waits, and Ignore remains archived.
- Prepare Patch queues a run. The worker checks the baseline, prepares a constrained patch, reruns checks, and stores the diff.
- The user approves or rejects the exact run. Approval causes a fresh default-branch SHA check, commit, and push. PR creation remains manual.
- A merged PR marks the related task done.
