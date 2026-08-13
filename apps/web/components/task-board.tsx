"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Sprint, WorkItem } from "@/lib/types";
import { StatusBadge } from "./status-badge";

const columns = [["draft", "草稿"], ["ready", "可執行"], ["in_progress", "進行中"], ["blocked", "受阻"], ["done", "完成"]] as const;
type SprintView = "current" | "next" | "last" | "backlog" | "all";

export function TaskBoard({ tasks, sprints }: { tasks: WorkItem[]; sprints: Sprint[] }) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("board");
  const [sprintView, setSprintView] = useState<SprintView>("current");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sprintSlots = useMemo(() => resolveSprintSlots(sprints), [sprints]);
  const selectedSprint = sprintView === "current" ? sprintSlots.current : sprintView === "next" ? sprintSlots.next : sprintView === "last" ? sprintSlots.last : null;
  const visibleTasks = tasks.filter(task => sprintView === "all" || (sprintView === "backlog" ? !task.sprint_id : task.sprint_id === selectedSprint?.id));

  async function update(task: WorkItem, planningStatus: WorkItem["planning_status"], deadline: string | null, sprintId: string | null) {
    setSaving(task.id); setError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}/planning`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planningStatus, deadline, sprintId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "更新失敗");
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "更新失敗"); } finally { setSaving(null); }
  }

  return <>
    <div className="board-toolbar">
      <div className="sprint-tabs">
        {(["current", "next", "last", "backlog", "all"] as SprintView[]).map(value => <button key={value} className={`sprint-tab ${sprintView === value ? "active" : ""}`} onClick={() => setSprintView(value)}>{sprintViewLabel(value)}</button>)}
      </div>
      <div className="view-toolbar"><button className={`filter-chip ${view === "board" ? "active" : ""}`} onClick={() => setView("board")}>Board</button><button className={`filter-chip ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>List</button></div>
    </div>
    {selectedSprint && <div className="sprint-context"><div><strong>{selectedSprint.name}</strong><span>{selectedSprint.start_date} ～ {selectedSprint.end_date}</span></div><StatusBadge value={selectedSprint.status} /></div>}
    {!selectedSprint && ["current", "next", "last"].includes(sprintView) && <div className="notice">尚未建立這個週期的 Sprint。</div>}
    {error && <div className="notice error-text">{error}</div>}
    {view === "board" ? <div className="task-board">{columns.map(([status, label]) => <section className="board-column" key={status}><div className="board-column-title"><span>{label}</span><span>{visibleTasks.filter(task => task.planning_status === status).length}</span></div><div className="board-cards">{visibleTasks.filter(task => task.planning_status === status).map(task => <article className="board-card" key={task.id}><Link href={`/tasks/${task.id}`}><strong>{task.title}</strong></Link><div className="board-meta"><StatusBadge value={task.source} />{task.github_issue_number ? <span>#{task.github_issue_number}</span> : null}</div><label>Sprint<select value={task.sprint_id ?? ""} disabled={saving === task.id} onChange={event => update(task, task.planning_status, task.deadline, event.target.value || null)}><option value="">Backlog</option>{sprints.map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></label><label>Deadline<input type="date" value={task.deadline ?? ""} disabled={saving === task.id} onChange={event => update(task, task.planning_status, event.target.value || null, task.sprint_id)} /></label><select aria-label={`${task.title} 狀態`} value={task.planning_status} disabled={saving === task.id} onChange={event => update(task, event.target.value as WorkItem["planning_status"], task.deadline, task.sprint_id)}>{columns.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></article>)}</div></section>)}</div> : <section className="section card"><table className="table"><thead><tr><th>任務</th><th>來源</th><th>Sprint</th><th>Deadline</th><th>Issue</th><th>狀態</th></tr></thead><tbody>{visibleTasks.map(task => <tr key={task.id}><td><Link href={`/tasks/${task.id}`}>{task.title}</Link></td><td><StatusBadge value={task.source} /></td><td>{sprints.find(sprint => sprint.id === task.sprint_id)?.name ?? "Backlog"}</td><td>{task.deadline ?? "未排程"}</td><td>{task.github_issue_number ? `#${task.github_issue_number}` : "—"}</td><td><StatusBadge value={task.planning_status} /></td></tr>)}</tbody></table></section>}
  </>;
}

function resolveSprintSlots(sprints: Sprint[]) {
  const current = sprints.find(sprint => sprint.status === "active") ?? null;
  const ordered = [...sprints].sort((left, right) => left.start_date.localeCompare(right.start_date));
  if (!current) return { current: null, next: ordered[0] ?? null, last: null };
  const index = ordered.findIndex(sprint => sprint.id === current.id);
  return { current, last: ordered[index - 1] ?? null, next: ordered[index + 1] ?? null };
}
function sprintViewLabel(value: SprintView) { return ({ current: "This Sprint", next: "Next", last: "Last", backlog: "Backlog", all: "All tasks" } as Record<SprintView, string>)[value]; }
