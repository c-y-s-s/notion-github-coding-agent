import Link from "next/link";
import { getLatestWorkerHeartbeat, listRuns, listSprints, listSyncEvents, listSyncJobs, listTasks } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";
import { DeadlineWorkspace } from "@/components/deadline-workspace";
import { sprintLabel } from "@/lib/sprint-display";

export default async function Overview() {
  const [tasks, runs, sprints, syncJobs, syncEvents, heartbeat] = await Promise.all([listTasks(), listRuns(), listSprints(), listSyncJobs(), listSyncEvents(), getLatestWorkerHeartbeat()]);
  const failedJobs = syncJobs.filter(job => job.status === "failed");
  const failedEvents = syncEvents.filter(event => event.status === "failed");
  const formalTasks = tasks.filter(task => !["pending", "needs_info", "ignored"].includes(task.review_status) && !isDeletedNotionTask(task) && task.title !== "Untitled");
  const workerOnline = Boolean(heartbeat && Date.now() - new Date(heartbeat.last_seen_at).getTime() < 15_000);
  const metrics = [
    ["待審核 Issue", tasks.filter(task => task.review_status === "pending").length],
    ["可執行任務", formalTasks.filter(task => task.planning_status === "ready").length],
    ["執行中工作", runs.filter(run => ["queued", "running", "awaiting_approval"].includes(run.status)).length],
    ["同步失敗", failedJobs.length + failedEvents.length],
  ];

  return <>
    <div className="eyebrow">工作台</div>
    <h1>總覽</h1>
    <p className="lead">審核外部需求、追蹤開發進度，並在程式碼送往 GitHub 前確認修改內容。</p>
    <div className="grid">{metrics.map(([label, value]) => <div className="card" key={label}><span className="muted">{label}</span><div className="metric">{value}</div></div>)}</div>

    <section className="section card worker-health">
      <div><h2>本機 Agent Worker</h2><p className="muted">{heartbeat ? `最後回報：${formatTime(heartbeat.last_seen_at)} · ${heartbeat.worker_id}` : "尚未收到 Worker 心跳"}</p></div>
      <span className={`health-label ${workerOnline ? "online" : "offline"}`}><span className={`health-dot ${workerOnline ? "healthy" : ""}`} />{workerOnline ? "在線" : "離線"}</span>
    </section>

    {failedJobs.length + failedEvents.length > 0 && <section className="section card alert-card"><div><h2>同步需要處理</h2><p className="muted">有 {failedJobs.length} 筆回寫工作與 {failedEvents.length} 筆 Webhook 事件失敗。</p></div><Link className="button secondary" href="/sync">查看同步紀錄</Link></section>}

    <DeadlineWorkspace tasks={formalTasks.filter(task => task.planning_status !== "done")} sprints={sprints} today={taipeiDate()} />

    <section className="section card"><div className="section-heading"><div><h2>近期工作</h2><p className="muted">最近更新的正式任務、工程連結與執行狀態。</p></div><Link className="button secondary" href="/tasks">查看全部</Link></div>{formalTasks.length ? <div className="table-scroll"><table className="table recent-work"><thead><tr><th>任務</th><th>類型／來源</th><th>Sprint</th><th>Deadline</th><th>Issue</th><th>規劃</th><th>AI</th><th>更新</th></tr></thead><tbody>{formalTasks.slice(0, 10).map(task => { const sprint=sprints.find(item=>item.id===task.sprint_id); return <tr key={task.id}><td><Link href={`/tasks/${task.id}`}><strong>{task.title}</strong></Link></td><td><div className="stacked-badges"><StatusBadge value={task.type} /><StatusBadge value={task.source} /></div></td><td>{sprint ? sprintLabel(sprint,sprints) : "Backlog"}</td><td>{task.deadline ?? "未排程"}</td><td>{task.github_issue_number ? <a href={task.github_issue_url ?? "#"} target="_blank" rel="noreferrer">#{task.github_issue_number}</a> : "—"}</td><td><StatusBadge value={task.planning_status} /></td><td><StatusBadge value={task.agent_status} /></td><td>{formatCompactTime(task.updated_at)}</td></tr>; })}</tbody></table></div> : <div className="empty">目前沒有任務。</div>}</section>
  </>;
}

function taipeiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

function formatCompactTime(value: string) { const date=new Date(value); return `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`; }
function isDeletedNotionTask(task: { notion_page_id?: string | null; notion_page_url: string | null }) { return Boolean(task.notion_page_id && !task.notion_page_url); }
