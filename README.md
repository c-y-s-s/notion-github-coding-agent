# Notion GitHub Coding Agent

Notion GitHub Coding Agent is a human-reviewed engineering workflow. Notion is the internal planning source, GitHub is the external issue and delivery source, Supabase stores cross-system identity, and a local Python worker prepares verified code patches. No branch is pushed until a person approves the exact diff.

## What is implemented

- Five-page Next.js dashboard with local demo data fallback.
- Signed, idempotent GitHub and Notion webhook receivers.
- GitHub issue inbox with Accept, Link, Needs Info, and Ignore decisions.
- Manual Notion task → GitHub issue creation.
- Supabase schema with external identity constraints, jobs, runs, steps, artifacts, RLS, and worker heartbeat.
- Local Python worker with baseline checks, structured OpenAI patch generation, three-file policy, sensitive-path denylist, post-edit checks, human approval, stale-base detection, and branch push.
- API routes for patch preparation and approval/rejection.

## Quick start

1. Copy `.env.example` to `.env.local` and fill the Supabase, GitHub, Notion, and OpenAI values.
2. Apply `supabase/migrations/202608120001_initial_schema.sql`, then customize and apply `supabase/seed.sql`.
3. Run `pnpm install && pnpm dev`.
4. Create the Python environment with `python3 -m venv .venv`, activate it, then run `pip install -e 'workers/agent[dev]'`.
5. Start the worker with `python -m agent_worker.worker`.
6. Expose `localhost:3000` with a tunnel and register `/api/webhooks/github` and `/api/webhooks/notion`.
7. During the local demo, call `POST /api/internal/sync-jobs/process` with `Authorization: Bearer $INTERNAL_JOB_SECRET` on a short interval to consume retryable Notion sync jobs.

Without Supabase variables the dashboard uses two clearly labeled demo records; mutation APIs require real configuration.

## Safety boundary

The worker operates on one configured local Git repository. It runs the configured checks before any edit, allows at most three existing source/test files, blocks credentials, environment, migrations, CI/CD, lockfiles, and path escape, and reruns all checks. Approval is invalidated when the remote default branch changes. It never creates or merges a PR.

See [architecture](docs/architecture.md), [workflow](docs/workflow.md), [database](docs/database.md), [agent safety](docs/agent-safety.md), and [demo script](docs/demo-script.md).
# notion-github-coding-agent
