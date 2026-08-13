import Link from "next/link";
import { getLatestWorkerHeartbeat, listRuns, listSprints, listSyncEvents, listSyncJobs, listTasks } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";
import { DeadlineWorkspace } from "@/components/deadline-workspace";

export default async function Overview() {
  const [tasks, runs, sprints, syncJobs, syncEvents, heartbeat] = await Promise.all([listTasks(), listRuns(), listSprints(), listSyncJobs(), listSyncEvents(), getLatestWorkerHeartbeat()]);
  const failedJobs = syncJobs.filter(job => job.status === "failed");
  const failedEvents = syncEvents.filter(event => event.status === "failed");
  const formalTasks = tasks.filter(task => !["pending", "needs_info", "ignored"].includes(task.review_status));
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

    <DeadlineWorkspace tasks={formalTasks.filter(task => task.planning_status !== "done")} sprints={sprints} />

    <section className="section card"><h2>近期工作</h2>{formalTasks.length ? <table className="table"><thead><tr><th>任務</th><th>來源</th><th>規劃狀態</th><th>代理狀態</th></tr></thead><tbody>{formalTasks.slice(0, 10).map(task => <tr key={task.id}><td><Link href={`/tasks/${task.id}`}>{task.title}</Link></td><td><StatusBadge value={task.source} /></td><td><StatusBadge value={task.planning_status} /></td><td><StatusBadge value={task.agent_status} /></td></tr>)}</tbody></table> : <div className="empty">目前沒有任務。</div>}</section>
  </>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}
