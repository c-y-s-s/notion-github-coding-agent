import { InboxList } from "@/components/inbox-list";
import { listTasks } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/supabase";

export default async function Inbox() {
  const items = (await listTasks()).filter(item => item.source === "github" && ["pending", "needs_info", "ignored"].includes(item.review_status));
  return <>
    <div className="eyebrow">外部需求</div>
    <h1>GitHub 收件匣</h1>
    <p className="lead">外部 Issue 必須由你接受或連結後，才會進入 Notion；已忽略項目仍保留在歷史檢視。</p>
    {!hasSupabaseEnv() && <div className="notice">目前為示範模式。設定 Supabase 後即可執行審核操作。</div>}
    <InboxList items={items} configured={hasSupabaseEnv()} />
  </>;
}
