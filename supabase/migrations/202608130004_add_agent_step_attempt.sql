alter table agent_run_steps add column if not exists attempt_number integer not null default 0;
