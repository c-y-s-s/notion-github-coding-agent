import { ActionButton } from "@/components/action-button";
import { StatusBadge } from "@/components/status-badge";
import { listSyncJobs } from "@/lib/data";

const actionLabels: Record<string, string> = {
  create_notion_task: "建立 Notion 任務",
  update_notion_issue: "回寫 GitHub Issue",
  update_notion_status: "回寫 PR 狀態",
};

export default async function SyncPage() {
  const jobs = await listSyncJobs();
  return <>
    <div className="eyebrow">系統整合</div>
    <h1>同步紀錄</h1>
    <p className="lead">查看 Notion 與 GitHub 的資料回寫結果；失敗工作最多自動嘗試三次，也可以人工重新排入。</p>
    <section className="section card">
      {jobs.length === 0 ? <div className="empty">目前沒有同步紀錄。</div> : <table className="table">
        <thead><tr><th>任務</th><th>動作</th><th>狀態</th><th>嘗試</th><th>錯誤</th><th>操作</th></tr></thead>
        <tbody>{jobs.map(job => <tr key={job.id}>
          <td>{job.work_items?.title ?? "未知任務"}</td>
          <td>{actionLabels[job.action] ?? job.action}</td>
          <td><StatusBadge value={job.status} /></td>
          <td>{job.attempt_count} / 3</td>
          <td className="muted">{job.last_error ?? "—"}</td>
          <td>{job.status === "failed" && <ActionButton endpoint={`/api/sync-jobs/${job.id}/retry`} label="重新同步" tone="secondary" />}</td>
        </tr>)}</tbody>
      </table>}
    </section>
  </>;
}
