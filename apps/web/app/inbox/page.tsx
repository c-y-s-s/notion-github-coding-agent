import { listTasks } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";
import { ActionButton } from "@/components/action-button";
import { LinkNotion } from "@/components/link-notion";
import { hasSupabaseEnv } from "@/lib/supabase";

export default async function Inbox() {
  const configured = hasSupabaseEnv();
  const items = (await listTasks()).filter(x => x.source === "github" && ["pending", "needs_info"].includes(x.review_status));
  return <><div className="eyebrow">外部需求</div><h1>GitHub 收件匣</h1><p className="lead">外部 Issue 必須由你接受或連結後，才會進入 Notion。</p>{!configured&&<div className="notice">目前為示範模式。設定 Supabase 後即可執行審核操作。</div>}<section className="section card">
    {items.length === 0 ? <div className="empty">目前沒有等待審核的 Issue。</div> : items.map(x => <div key={x.id} style={{padding:"18px 0", borderBottom:"1px solid var(--border)"}}><div className="actions" style={{justifyContent:"space-between"}}><h2>#{x.github_issue_number} · {x.title}</h2><StatusBadge value={x.review_status}/></div><p className="muted">{x.description}</p><div className="actions"><ActionButton endpoint={`/api/inbox/issues/${x.id}/accept`} label="接受" disabled={!configured}/><LinkNotion issueId={x.id} disabled={!configured}/><ActionButton endpoint={`/api/inbox/issues/${x.id}/needs-info`} label="需要更多資訊" tone="secondary" disabled={!configured}/><ActionButton endpoint={`/api/inbox/issues/${x.id}/ignore`} label="忽略" tone="danger" disabled={!configured}/></div></div>)}
  </section></>;
}
