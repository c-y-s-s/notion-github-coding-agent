import { listRuns, listSyncJobs, listTasks } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";

export default async function Overview() {
  const [tasks, runs, syncJobs] = await Promise.all([listTasks(), listRuns(), listSyncJobs()]);
  const metrics = [
    ["待審核 Issue", tasks.filter(x => x.review_status === "pending").length], ["可執行任務", tasks.filter(x => x.planning_status === "ready").length],
    ["執行中工作", runs.filter(x => ["queued", "running", "awaiting_approval"].includes(x.status)).length], ["同步失敗", syncJobs.filter(x => x.status === "failed").length]
  ];
  return <><div className="eyebrow">工作台</div><h1>總覽</h1><p className="lead">審核外部需求、追蹤開發進度，並在程式碼送往 GitHub 前確認修改內容。</p>
    <div className="grid">{metrics.map(([label, value]) => <div className="card" key={label}><span className="muted">{label}</span><div className="metric">{value}</div></div>)}</div>
    <section className="section card"><h2>近期工作</h2><table className="table"><thead><tr><th>任務</th><th>來源</th><th>規劃狀態</th><th>代理狀態</th></tr></thead><tbody>{tasks.map(t => <tr key={t.id}><td>{t.title}</td><td><StatusBadge value={t.source}/></td><td><StatusBadge value={t.planning_status}/></td><td><StatusBadge value={t.agent_status}/></td></tr>)}</tbody></table></section>
  </>;
}
