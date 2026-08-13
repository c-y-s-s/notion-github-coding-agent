alter table agent_runs add column if not exists parent_run_id uuid references agent_runs(id) on delete set null;
alter table agent_runs add column if not exists replay_mode text check(replay_mode in ('exact','latest'));
alter table agent_runs add column if not exists task_snapshot jsonb;
alter table agent_runs add column if not exists context_manifest jsonb;
create index if not exists agent_runs_parent_run_idx on agent_runs(parent_run_id);
