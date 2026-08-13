alter table agent_runs add column if not exists slack_notified_at timestamptz;
alter table agent_runs add column if not exists slack_notification_error text;
