create extension if not exists pgcrypto;

create type work_source as enum ('notion','github');
create type work_kind as enum ('bug','feature','chore','unknown');
create type review_state as enum ('not_required','pending','accepted','linked','needs_info','ignored');
create type planning_state as enum ('draft','ready','in_progress','blocked','done');
create type agent_state as enum ('idle','queued','preparing','awaiting_approval','rejected','pushing','branch_ready','failed');
create type pr_state as enum ('open','closed','merged');
create type job_state as enum ('queued','running','completed','failed');
create type run_state as enum ('queued','running','awaiting_approval','approved','rejected','pushing','succeeded','failed','cancelled');

create table projects (
  id uuid primary key default gen_random_uuid(), name text not null,
  notion_data_source_id text unique, default_repository_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table repositories (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
  github_owner text not null, github_name text not null, github_node_id text not null unique,
  default_branch text not null default 'main', local_path text not null,
  install_command text, lint_command text, typecheck_command text, test_command text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(github_owner, github_name)
);
alter table projects add constraint projects_default_repository_fk foreign key(default_repository_id) references repositories(id) on delete set null;

create table work_items (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
  repository_id uuid references repositories(id) on delete set null, source work_source not null, type work_kind not null default 'unknown',
  title text not null, description text, acceptance_criteria text,
  review_status review_state not null default 'not_required', planning_status planning_state not null default 'draft', agent_status agent_state not null default 'idle',
  notion_page_id text, notion_page_url text, github_issue_node_id text, github_issue_number integer, github_issue_url text, github_issue_state text, github_pr_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(notion_page_id), unique(repository_id, github_issue_node_id)
);
create table pull_requests (
  id uuid primary key default gen_random_uuid(), repository_id uuid not null references repositories(id) on delete cascade,
  work_item_id uuid references work_items(id) on delete set null, github_pr_node_id text not null, github_pr_number integer not null,
  github_pr_url text not null, head_branch text not null, state pr_state not null, merged_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(repository_id, github_pr_node_id)
);
create table sync_events (
  id uuid primary key default gen_random_uuid(), provider work_source not null, provider_event_id text not null, event_type text not null,
  payload jsonb not null, status text not null default 'received' check(status in ('received','processing','completed','failed')),
  attempt_count integer not null default 0, last_error text, received_at timestamptz not null default now(), processed_at timestamptz,
  unique(provider, provider_event_id)
);
create table sync_jobs (
  id uuid primary key default gen_random_uuid(), work_item_id uuid not null references work_items(id) on delete cascade, action text not null,
  status job_state not null default 'queued', attempt_count integer not null default 0, available_at timestamptz not null default now(), last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table agent_runs (
  id uuid primary key default gen_random_uuid(), work_item_id uuid not null references work_items(id) on delete cascade,
  repository_id uuid not null references repositories(id), status run_state not null default 'queued', base_commit_sha text,
  worktree_path text, branch_name text unique, attempt_number integer not null default 0, model text not null, prompt_version text not null,
  risk_level text check(risk_level in ('low','medium','high')), risk_reasons jsonb not null default '[]', token_usage jsonb,
  started_at timestamptz, finished_at timestamptz, error_code text, error_message text, created_at timestamptz not null default now()
);
create unique index one_active_run_per_task on agent_runs(work_item_id) where status in ('queued','running','awaiting_approval','approved','pushing');
create table agent_run_steps (
  id uuid primary key default gen_random_uuid(), agent_run_id uuid not null references agent_runs(id) on delete cascade,
  sequence integer not null, step_type text not null check(step_type in ('inspect','baseline','plan','edit','test','review','push')),
  status text not null, command text, exit_code integer, output_excerpt text, started_at timestamptz, finished_at timestamptz,
  unique(agent_run_id, sequence)
);
create table artifacts (
  id uuid primary key default gen_random_uuid(), agent_run_id uuid not null references agent_runs(id) on delete cascade,
  type text not null check(type in ('diff','test_log','analysis','commit','branch')), content text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table worker_heartbeats (worker_id text primary key, last_seen_at timestamptz not null default now(), metadata jsonb not null default '{}');

create or replace function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger touch_projects before update on projects for each row execute function touch_updated_at();
create trigger touch_repositories before update on repositories for each row execute function touch_updated_at();
create trigger touch_work_items before update on work_items for each row execute function touch_updated_at();
create trigger touch_pull_requests before update on pull_requests for each row execute function touch_updated_at();
create trigger touch_sync_jobs before update on sync_jobs for each row execute function touch_updated_at();

alter table projects enable row level security; alter table repositories enable row level security; alter table work_items enable row level security;
alter table pull_requests enable row level security; alter table sync_events enable row level security; alter table sync_jobs enable row level security;
alter table agent_runs enable row level security; alter table agent_run_steps enable row level security; alter table artifacts enable row level security;
-- v1 is server-only: no anon/authenticated policies. The service role bypasses RLS.
