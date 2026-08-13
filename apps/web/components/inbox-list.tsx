"use client";

import { useState } from "react";
import type { WorkItem } from "@/lib/types";
import { ActionButton } from "./action-button";
import { LinkNotion } from "./link-notion";
import { StatusBadge } from "./status-badge";

type InboxView = "pending" | "needs_info" | "ignored";

export function InboxList({ items, configured }: { items: WorkItem[]; configured: boolean }) {
  const [view, setView] = useState<InboxView>("pending");
  const visible = items.filter(item => item.review_status === view);
  return <section className="section card">
    <div className="inbox-tabs">
      {(["pending", "needs_info", "ignored"] as InboxView[]).map(status => <button key={status} className={`filter-chip ${view === status ? "active" : ""}`} onClick={() => setView(status)}>{viewLabel(status)} <span>{items.filter(item => item.review_status === status).length}</span></button>)}
    </div>
    {visible.length === 0 ? <div className="empty">{emptyLabel(view)}</div> : visible.map(item => <article className="inbox-item" key={item.id}>
      <div className="inbox-heading"><h2>#{item.github_issue_number} · {item.title}</h2><StatusBadge value={item.review_status} /></div>
      <p className="muted">{item.description || "此 Issue 沒有提供說明。"}</p>
      {view === "pending" && <div className="actions"><ActionButton endpoint={`/api/inbox/issues/${item.id}/accept`} label="接受" disabled={!configured} /><LinkNotion issueId={item.id} disabled={!configured} /><ActionButton endpoint={`/api/inbox/issues/${item.id}/needs-info`} label="需要更多資訊" tone="secondary" disabled={!configured} /><ActionButton endpoint={`/api/inbox/issues/${item.id}/ignore`} label="忽略" tone="danger" disabled={!configured} /></div>}
    </article>)}
  </section>;
}

function viewLabel(view: InboxView) { return ({ pending: "待審核", needs_info: "待補資訊", ignored: "已忽略" } as const)[view]; }
function emptyLabel(view: InboxView) { return ({ pending: "目前沒有等待審核的 Issue。", needs_info: "目前沒有等待補充資訊的 Issue。", ignored: "目前沒有已忽略的 Issue。" } as const)[view]; }
