import Link from "next/link";
import { listTasks } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";

export default async function Tasks() { const tasks = (await listTasks()).filter(x => !["pending", "ignored"].includes(x.review_status)); return <><div className="eyebrow">正式工作項目</div><h1>任務</h1><p className="lead">Notion 負責規劃工作，GitHub 負責追蹤工程交付。</p><section className="section card"><table className="table"><thead><tr><th>任務</th><th>來源</th><th>Issue</th><th>任務狀態</th><th>代理狀態</th></tr></thead><tbody>{tasks.map(t => <tr key={t.id}><td><Link href={`/tasks/${t.id}`}>{t.title}</Link></td><td><StatusBadge value={t.source}/></td><td>{t.github_issue_number ? `#${t.github_issue_number}` : "尚未建立"}</td><td><StatusBadge value={t.planning_status}/></td><td><StatusBadge value={t.agent_status}/></td></tr>)}</tbody></table></section></>; }
