import { ActionButton } from "@/components/action-button";
import { StatusBadge } from "@/components/status-badge";
import { listSyncEvents, listSyncJobs } from "@/lib/data";
import { EmptyState, PageHeader, SectionHeader } from "@/components/ui";

const actionLabels: Record<string, string> = {
  create_notion_task: "建立 Notion 任務",
  update_notion_issue: "回寫 GitHub Issue",
  update_notion_status: "回寫 PR 狀態",
};

export default async function SyncPage() {
  const [jobs, events] = await Promise.all([listSyncJobs(), listSyncEvents()]);
  return <>
    <PageHeader eyebrow="系統整合" title="同步紀錄" description="預設先處理失敗工作；Webhook 紀錄保留作為稽核與除錯依據。" />
    <section className="section card">
      <SectionHeader title="回寫工作" description="失敗工作最多自動嘗試三次，也可以人工重新排入。" />
      {jobs.length === 0 ? <EmptyState title="沒有待處理的同步工作" description="Notion 與 GitHub 目前沒有等待回寫的資料。" /> : <div className="table-scroll"><table className="table">
        <thead><tr><th>任務</th><th>動作</th><th>狀態</th><th>嘗試</th><th>錯誤</th><th>操作</th></tr></thead>
        <tbody>{jobs.map(job => <tr key={job.id}>
          <td>{job.work_items?.title ?? "未知任務"}</td>
          <td>{actionLabels[job.action] ?? job.action}</td>
          <td><StatusBadge value={job.status} /></td>
          <td>{job.attempt_count} / 3</td>
          <td className="muted">{job.last_error ?? "—"}</td>
          <td>{job.status === "failed" && <ActionButton endpoint={`/api/sync-jobs/${job.id}/retry`} label="重新同步" tone="secondary" />}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    <section className="section card">
      <SectionHeader title="Webhook 收件紀錄" description="成功事件屬於歷史紀錄；失敗事件可能已由 reconciliation 補回。" />
      {events.length === 0 ? <EmptyState title="尚未收到 Webhook" description="建立 Notion Task 或 GitHub Issue 後，事件會出現在這裡。" /> : <div className="table-scroll"><table className="table">
        <thead><tr><th>來源</th><th>事件</th><th>狀態</th><th>收到時間</th><th>錯誤</th></tr></thead>
        <tbody>{events.map(event => <tr key={event.id}>
          <td><StatusBadge value={event.provider} /></td>
          <td>{event.event_type}<small className="event-id">{event.provider_event_id}</small></td>
          <td><StatusBadge value={event.status} /></td>
          <td>{formatTime(event.received_at)}</td>
          <td className="muted">{event.last_error ?? "—"}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
