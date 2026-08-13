import Link from "next/link";
import { listSprints, listTasks } from "@/lib/data";
import { TaskBoard } from "@/components/task-board";

export default async function Tasks() {
  const [allTasks, sprints] = await Promise.all([listTasks(), listSprints()]);
  const tasks = allTasks.filter(x => !["pending", "needs_info", "ignored"].includes(x.review_status));

  return <>
    <div className="eyebrow">正式工作項目</div>
    <h1>任務</h1>
    <p className="lead">像 Notion Board 一樣安排工作；Sprint、狀態與 Deadline 會同步回 Notion。</p>

    {tasks.length === 0 ? <section className="section card empty-state">
      <div className="eyebrow">目前沒有資料</div>
      <h2>目前沒有正式任務</h2>
      <p className="muted">先從 GitHub 收件匣審核 Issue，或確認 Notion 與 Repository 已完成設定。</p>
      <div className="actions">
        <Link className="button" href="/inbox">前往 GitHub 收件匣</Link>
        <Link className="button secondary" href="/settings">檢查設定</Link>
      </div>
    </section> : <TaskBoard tasks={tasks} sprints={sprints} />}
  </>;
}
