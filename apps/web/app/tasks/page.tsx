import Link from "next/link";
import { listTasks } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";

export default async function Tasks() { const tasks = (await listTasks()).filter(x => !["pending", "ignored"].includes(x.review_status)); return <><div className="eyebrow">Canonical work</div><h1>Tasks</h1><p className="lead">Notion plans the work. GitHub tracks engineering delivery.</p><section className="section card"><table className="table"><thead><tr><th>Task</th><th>Source</th><th>Issue</th><th>Status</th><th>Agent</th></tr></thead><tbody>{tasks.map(t => <tr key={t.id}><td><Link href={`/tasks/${t.id}`}>{t.title}</Link></td><td>{t.source}</td><td>{t.github_issue_number ? `#${t.github_issue_number}` : "Not created"}</td><td><StatusBadge value={t.planning_status}/></td><td><StatusBadge value={t.agent_status}/></td></tr>)}</tbody></table></section></>; }
