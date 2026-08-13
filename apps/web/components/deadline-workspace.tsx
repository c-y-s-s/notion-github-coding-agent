"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Sprint, WorkItem } from "@/lib/types";
import { StatusBadge } from "./status-badge";

type Range = "overdue" | "this_week" | "last_week" | "next_week" | "custom" | "all";

export function DeadlineWorkspace({ tasks, sprints }: { tasks: WorkItem[]; sprints: Sprint[] }) {
  const [range, setRange] = useState<Range>("this_week");
  const [sprintId, setSprintId] = useState("all");
  const [start, setStart] = useState(isoDate(startOfWeek(new Date())));
  const [end, setEnd] = useState(isoDate(addDays(startOfWeek(new Date()), 6)));
  const today = isoDate(new Date());
  const filtered = useMemo(() => tasks.filter(task => (sprintId === "all" || (sprintId === "backlog" ? !task.sprint_id : task.sprint_id === sprintId)) && inRange(task.deadline, range, start, end, today)), [tasks, range, sprintId, start, end, today]);
  const overdue = tasks.filter(task => task.deadline && task.deadline < today && task.planning_status !== "done").length;
  const dueToday = tasks.filter(task => task.deadline === today && task.planning_status !== "done").length;
  const unscheduled = tasks.filter(task => !task.deadline && task.planning_status !== "done").length;
  return <section className="section card deadline-workspace">
    <div className="deadline-heading"><div><h2>Deadline 工作區</h2><p className="muted">依 Notion Deadline 安排本週工作，不隱藏未排程任務。</p></div><div className="deadline-stats"><span className={overdue ? "deadline-alert" : ""}>逾期 {overdue}</span><span>今天 {dueToday}</span><span>未排程 {unscheduled}</span></div></div>
    <div className="date-toolbar">
      <select className="date-input" aria-label="Sprint 篩選" value={sprintId} onChange={event => setSprintId(event.target.value)}><option value="all">所有 Sprint</option><option value="backlog">Backlog</option>{sprints.map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select>
      {(["overdue", "this_week", "last_week", "next_week", "all"] as Range[]).map(value => <button key={value} className={`filter-chip ${range === value ? "active" : ""}`} onClick={() => setRange(value)}>{rangeLabel(value)}</button>)}
      <button className={`filter-chip ${range === "custom" ? "active" : ""}`} onClick={() => setRange("custom")}>自訂</button>
      {range === "custom" && <><input className="date-input" type="date" value={start} onChange={event => setStart(event.target.value)} /><span className="muted">至</span><input className="date-input" type="date" value={end} onChange={event => setEnd(event.target.value)} /></>}
    </div>
    <div className="deadline-list">{filtered.length ? filtered.map(task => <Link href={`/tasks/${task.id}`} className="deadline-row" key={task.id}><span className={`deadline-date ${task.deadline && task.deadline < today && task.planning_status !== "done" ? "overdue" : ""}`}>{task.deadline ? formatDate(task.deadline) : "未排程"}</span><strong>{task.title}</strong><StatusBadge value={task.planning_status} /></Link>) : <div className="empty compact">此日期區間沒有任務。</div>}</div>
  </section>;
}

function inRange(deadline: string | null, range: Range, customStart: string, customEnd: string, today: string) {
  if (range === "all") return true;
  if (!deadline) return false;
  if (range === "overdue") return deadline < today;
  const weekStart = startOfWeek(new Date());
  const offsets = { last_week: [-7, -1], this_week: [0, 6], next_week: [7, 13] } as const;
  const [from, to] = range === "custom" ? [customStart, customEnd] : [isoDate(addDays(weekStart, offsets[range][0])), isoDate(addDays(weekStart, offsets[range][1]))];
  return deadline >= from && deadline <= to;
}
function startOfWeek(date: Date) { const copy = new Date(date); const day = copy.getDay() || 7; copy.setHours(12, 0, 0, 0); copy.setDate(copy.getDate() - day + 1); return copy; }
function addDays(date: Date, days: number) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("zh-TW", { month: "short", day: "numeric", weekday: "short", timeZone: "Asia/Taipei" }).format(new Date(`${value}T12:00:00+08:00`)); }
function rangeLabel(value: Range) { return ({ overdue: "已逾期", this_week: "本週", last_week: "上週", next_week: "下週", all: "全部" } as Record<string, string>)[value]; }
