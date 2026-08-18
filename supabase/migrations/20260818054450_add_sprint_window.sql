alter table sprints
add column if not exists sprint_window text not null default 'future'
check (sprint_window in ('future', 'next', 'current', 'last', 'past'));

create index if not exists sprints_project_window_idx
on sprints(project_id, sprint_window);

create table if not exists sprint_rotation_locks (
  project_id uuid primary key references projects(id) on delete cascade,
  acquired_at timestamptz not null default now()
);

alter table sprint_rotation_locks enable row level security;
