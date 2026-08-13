alter table projects add column if not exists notion_sprint_data_source_id text unique;

create table if not exists sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  week_key text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed')),
  goal text,
  notion_page_id text not null unique,
  notion_page_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, week_key)
);

alter table work_items add column if not exists sprint_id uuid references sprints(id) on delete set null;
create index if not exists work_items_sprint_id_idx on work_items(sprint_id);

create trigger touch_sprints before update on sprints
for each row execute function touch_updated_at();

alter table sprints enable row level security;
