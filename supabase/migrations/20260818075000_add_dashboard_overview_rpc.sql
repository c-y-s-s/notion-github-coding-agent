create or replace function dashboard_overview()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(item))
      from (select * from work_items order by updated_at desc) item
    ), '[]'::jsonb),
    'sprints', coalesce((
      select jsonb_agg(to_jsonb(item))
      from (select * from sprints order by start_date desc) item
    ), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(to_jsonb(item) || jsonb_build_object(
        'work_items', case when task.id is null then null else jsonb_build_object('title', task.title) end
      ))
      from (select * from agent_runs order by created_at desc) item
      left join work_items task on task.id = item.work_item_id
    ), '[]'::jsonb),
    'sync_jobs', coalesce((
      select jsonb_agg(to_jsonb(item) || jsonb_build_object(
        'work_items', case when task.id is null then null else jsonb_build_object('title', task.title) end
      ))
      from (select * from sync_jobs order by created_at desc limit 100) item
      left join work_items task on task.id = item.work_item_id
    ), '[]'::jsonb),
    'sync_events', coalesce((
      select jsonb_agg(to_jsonb(item))
      from (
        select id, provider, provider_event_id, event_type, status, attempt_count,
          last_error, received_at, processed_at
        from sync_events order by received_at desc limit 100
      ) item
    ), '[]'::jsonb),
    'heartbeat', (
      select to_jsonb(item)
      from (select * from worker_heartbeats order by last_seen_at desc limit 1) item
    )
  );
$$;
