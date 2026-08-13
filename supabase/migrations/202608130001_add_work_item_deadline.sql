alter table work_items add column if not exists deadline date;

create index if not exists work_items_deadline_idx
  on work_items (deadline)
  where deadline is not null;
