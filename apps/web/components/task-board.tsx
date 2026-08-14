"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Sprint, WorkItem } from "@/lib/types";
import { orderedSprints, sprintLabel, sprintSlots } from "@/lib/sprint-display";
import { StatusBadge } from "./status-badge";

const columns = [["draft", "草稿"], ["ready", "可執行"], ["in_progress", "進行中"], ["blocked", "受阻"], ["done", "完成"]] as const;
type SprintView = "current" | "next" | "last" | "backlog" | "all";

export function TaskBoard({ tasks, sprints, today }: { tasks: WorkItem[]; sprints: Sprint[]; today: string }) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("board");
  const [sprintView, setSprintView] = useState<SprintView>("current");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const slots = useMemo(() => sprintSlots(sprints), [sprints]);
  const selectedSprint = sprintView === "current" ? slots.current : sprintView === "next" ? slots.next : sprintView === "last" ? slots.last : null;
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
    {view === "board" ? <div className="task-board">{columns.map(([status, label]) => { const columnTasks = visibleTasks.filter(task => task.planning_status === status); const overdue = columnTasks.filter(task => task.deadline && task.deadline < today && status !== "done").length; return <section className="board-column" key={status}><div className="board-column-title"><span>{label}</span><span>{columnTasks.length}{overdue ? ` · ${overdue} 逾期` : ""}</span></div><div className="board-cards">{columnTasks.map(task => <article className="board-card" key={task.id}><Link href={`/tasks/${task.id}`}><strong>{task.title}</strong></Link><div className="board-meta"><StatusBadge value={task.source} />{task.deadline ? <span className={task.deadline < today && status !== "done" ? "error-text" : ""}>{shortDate(task.deadline)}</span> : <span>未排程</span>}{task.github_issue_number ? <span>Issue #{task.github_issue_number}</span> : null}</div><details className="quick-edit"><summary>快速編輯</summary><label>Sprint<select value={task.sprint_id ?? ""} disabled={saving === task.id} onChange={event => update(task, task.planning_status, task.deadline, event.target.value || null)}><option value="">Backlog</option>{orderedSprints(sprints).map(sprint => <option key={sprint.id} value={sprint.id}>{sprintLabel(sprint, sprints)}</option>)}</select></label><label>Deadline<input type="date" value={task.deadline ?? ""} disabled={saving === task.id} onChange={event => update(task, task.planning_status, event.target.value || null, task.sprint_id)} /></label><label>狀態<select aria-label={`${task.title} 狀態`} value={task.planning_status} disabled={saving === task.id} onChange={event => update(task, event.target.value as WorkItem["planning_status"], task.deadline, task.sprint_id)}>{columns.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label></details></article>)}</div></section>; })}</div> : <section className="section card"><div className="table-scroll"><table className="table"><thead><tr><th>任務</th><th>來源</th><th>Sprint</th><th>Deadline</th><th>Issue</th><th>狀態</th></tr></thead><tbody>{visibleTasks.map(task => { const sprint = sprints.find(item => item.id === task.sprint_id); return <tr key={task.id}><td><Link className="table-link" href={`/tasks/${task.id}`}>{task.title}</Link></td><td><StatusBadge value={task.source} /></td><td>{sprint ? sprintLabel(sprint, sprints) : "Backlog"}</td><td>{task.deadline ?? "未排程"}</td><td>{task.github_issue_number ? `#${task.github_issue_number}` : "—"}</td><td><StatusBadge value={task.planning_status} /></td></tr>; })}</tbody></table></div></section>}
  </>;
}

function sprintViewLabel(value: SprintView) { return ({ current: "本週 Sprint", next: "下個 Sprint", last: "上個 Sprint", backlog: "Backlog", all: "全部任務" } as Record<SprintView, string>)[value]; }
function shortDate(value: string) { const [, month, day] = value.split("-"); return `${Number(month)}/${Number(day)}`; }
