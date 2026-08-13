"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WorkItem } from "@/lib/types";
import { StatusBadge } from "./status-badge";

const columns = [["draft", "草稿"], ["ready", "可執行"], ["in_progress", "進行中"], ["blocked", "受阻"], ["done", "完成"]] as const;

export function TaskBoard({ tasks }: { tasks: WorkItem[] }) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("board");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function update(task: WorkItem, planningStatus: WorkItem["planning_status"], deadline: string | null) {
    setSaving(task.id); setError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}/planning`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planningStatus, deadline }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "更新失敗");
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "更新失敗"); } finally { setSaving(null); }
  }
  return <>
    <div className="view-toolbar"><button className={`filter-chip ${view === "board" ? "active" : ""}`} onClick={() => setView("board")}>Board</button><button className={`filter-chip ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>List</button></div>
    {error && <div className="notice error-text">{error}</div>}
    {view === "board" ? <div className="task-board">{columns.map(([status, label]) => <section className="board-column" key={status}><div className="board-column-title"><span>{label}</span><span>{tasks.filter(task => task.planning_status === status).length}</span></div><div className="board-cards">{tasks.filter(task => task.planning_status === status).map(task => <article className="board-card" key={task.id}><Link href={`/tasks/${task.id}`}><strong>{task.title}</strong></Link><div className="board-meta"><StatusBadge value={task.source} />{task.github_issue_number ? <span>#{task.github_issue_number}</span> : null}</div><label>Deadline<input type="date" value={task.deadline ?? ""} disabled={saving === task.id} onChange={event => update(task, task.planning_status, event.target.value || null)} /></label><select aria-label={`${task.title} 狀態`} value={task.planning_status} disabled={saving === task.id} onChange={event => update(task, event.target.value as WorkItem["planning_status"], task.deadline)}>{columns.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></article>)}</div></section>)}</div> : <section className="section card"><table className="table"><thead><tr><th>任務</th><th>來源</th><th>Deadline</th><th>Issue</th><th>狀態</th></tr></thead><tbody>{tasks.map(task => <tr key={task.id}><td><Link href={`/tasks/${task.id}`}>{task.title}</Link></td><td><StatusBadge value={task.source} /></td><td>{task.deadline ?? "未排程"}</td><td>{task.github_issue_number ? `#${task.github_issue_number}` : "—"}</td><td><StatusBadge value={task.planning_status} /></td></tr>)}</tbody></table></section>}
  </>;
}
