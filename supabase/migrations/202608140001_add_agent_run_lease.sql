alter table agent_runs add column if not exists claimed_by text;
alter table agent_runs add column if not exists lease_expires_at timestamptz;

create index if not exists agent_runs_running_lease_idx
  on agent_runs(lease_expires_at)
  where status = 'running';
