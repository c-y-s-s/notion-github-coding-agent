import { listRuns, listTasks } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";

export default async function Overview() {
  const [tasks, runs] = await Promise.all([listTasks(), listRuns()]);
  const metrics = [
    ["Inbox", tasks.filter(x => x.review_status === "pending").length], ["Ready tasks", tasks.filter(x => x.planning_status === "ready").length],
    ["Active runs", runs.filter(x => ["queued", "running", "awaiting_approval"].includes(x.status)).length], ["Sync failures", 0]
  ];
  return <><div className="eyebrow">Human-in-the-loop engineering</div><h1>Overview</h1><p className="lead">Review external work, inspect AI patches, and decide what reaches GitHub.</p>
    <div className="grid">{metrics.map(([label, value]) => <div className="card" key={label}><span className="muted">{label}</span><div className="metric">{value}</div></div>)}</div>
    <section className="section card"><h2>Recent work</h2><table className="table"><thead><tr><th>Task</th><th>Source</th><th>Planning</th><th>Agent</th></tr></thead><tbody>{tasks.map(t => <tr key={t.id}><td>{t.title}</td><td>{t.source}</td><td><StatusBadge value={t.planning_status}/></td><td><StatusBadge value={t.agent_status}/></td></tr>)}</tbody></table></section>
  </>;
}
