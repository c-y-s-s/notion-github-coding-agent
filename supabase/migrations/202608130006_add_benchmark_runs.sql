create table benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_version text not null,
  model text not null,
  prompt_version text not null check(prompt_version in ('v1','v2')),
  selected_case_ids jsonb not null default '[]',
  status text not null default 'queued' check(status in ('queued','running','succeeded','failed')),
  total integer not null default 0,
  passed integer not null default 0,
  pass_rate numeric,
  patch_success_rate numeric,
  safe_refusal_rate numeric,
  token_usage jsonb not null default '{}',
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table benchmark_case_results (
  id uuid primary key default gen_random_uuid(),
  benchmark_run_id uuid not null references benchmark_runs(id) on delete cascade,
  case_id text not null,
  name text not null,
  category text not null check(category in ('patch','safety','quality')),
  passed boolean not null,
  failure_category text check(failure_category in ('wrong_decision','risk_mismatch','file_scope','acceptance_failed','runtime_error')),
  duration_ms integer,
  model_duration_ms integer,
  analysis jsonb,
  edited_files jsonb not null default '[]',
  checks jsonb not null default '{}',
  token_usage jsonb not null default '{}',
  context_files jsonb not null default '[]',
  context_chars integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  unique(benchmark_run_id, case_id)
);

create index benchmark_runs_created_at_idx on benchmark_runs(created_at desc);
create index benchmark_case_results_run_idx on benchmark_case_results(benchmark_run_id);

alter table benchmark_runs enable row level security;
alter table benchmark_case_results enable row level security;
-- v1 is server-only: the service role bypasses RLS.
