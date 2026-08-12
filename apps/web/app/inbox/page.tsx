import { listTasks } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";
import { ActionButton } from "@/components/action-button";
import { LinkNotion } from "@/components/link-notion";

export default async function Inbox() {
  const items = (await listTasks()).filter(x => x.source === "github" && ["pending", "needs_info"].includes(x.review_status));
  return <><div className="eyebrow">External intake</div><h1>GitHub Inbox</h1><p className="lead">Nothing enters Notion until you accept or link it.</p><section className="section card">
    {items.length === 0 ? <div className="empty">No issues waiting for review.</div> : items.map(x => <div key={x.id} style={{padding:"18px 0", borderBottom:"1px solid var(--border)"}}><div className="actions" style={{justifyContent:"space-between"}}><h2>#{x.github_issue_number} · {x.title}</h2><StatusBadge value={x.review_status}/></div><p className="muted">{x.description}</p><div className="actions"><ActionButton endpoint={`/api/inbox/issues/${x.id}/accept`} label="Accept"/><LinkNotion issueId={x.id}/><ActionButton endpoint={`/api/inbox/issues/${x.id}/needs-info`} label="Needs info" tone="secondary"/><ActionButton endpoint={`/api/inbox/issues/${x.id}/ignore`} label="Ignore" tone="danger"/></div></div>)}
  </section></>;
}
