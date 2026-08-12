# Database

The migration is the source of truth. `work_items` stores cross-provider identity but keeps review, planning, and agent status separate. Unique constraints on Notion page ID, GitHub issue node ID, webhook delivery ID, and active run prevent duplicates. No anonymous RLS policies exist in v1; only server-side service-role access is supported.

