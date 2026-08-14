import { InboxList } from "@/components/inbox-list";
import { listTasks } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/supabase";
import { PageHeader } from "@/components/ui";

export default async function Inbox() {
  const items = (await listTasks()).filter(item => item.source === "github" && ["pending", "needs_info", "ignored"].includes(item.review_status));
  return <>
    <PageHeader eyebrow="外部需求" title="GitHub 收件匣" description="先決定外部 Issue 是否進入正式工作流程，避免未審核需求污染 Notion。" />
    {!hasSupabaseEnv() && <div className="notice">目前為示範模式。設定 Supabase 後即可執行審核操作。</div>}
    <InboxList items={items} configured={hasSupabaseEnv()} />
  </>;
}
