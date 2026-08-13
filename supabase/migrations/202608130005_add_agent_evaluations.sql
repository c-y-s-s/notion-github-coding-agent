create table agent_evaluations (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null unique references agent_runs(id) on delete cascade,
  analysis_correct boolean not null,
  patch_usable boolean,
  failure_category text check(failure_category in ('wrong_analysis','missing_context','bad_patch','checks_failed','unsafe_scope','other')),
  notes text check(char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(patch_usable is not true or analysis_correct is true)
);

create trigger touch_agent_evaluations before update on agent_evaluations
for each row execute function touch_updated_at();

alter table agent_evaluations enable row level security;
-- v1 is server-only: the service role bypasses RLS.
