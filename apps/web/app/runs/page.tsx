import Link from "next/link";
import { listRuns } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, PageHeader, SectionHeader } from "@/components/ui";

export default async function Runs() {
  const runs = await listRuns();
  const waiting = runs.filter(run => run.status === "awaiting_approval").length;
  const active = runs.filter(run => ["queued", "running", "approved", "pushing"].includes(run.status)).length;
  const failed = runs.filter(run => run.status === "failed").length;
  return <>
    <PageHeader eyebrow="AI Agent" title="執行紀錄" description="每次分析、修改、檢查與人工決策都有可追溯紀錄。" />
    <div className="grid"><Summary label="等待你核准" value={waiting} /><Summary label="執行中" value={active} /><Summary label="失敗需調查" value={failed} /><Summary label="全部執行" value={runs.length} /></div>
    <section className="section card"><SectionHeader title="所有執行" description="優先查看等待核准與失敗的項目。" />{runs.length ? <div className="table-scroll"><table className="table"><thead><tr><th>任務</th><th>結果</th><th>風險</th><th>執行摘要</th><th>時間</th><th>操作</th></tr></thead><tbody>{runs.map(run => <tr key={run.id}><td><div className="table-title"><strong>{run.work_items?.title ?? "已刪除的任務"}</strong><small>Run {run.id.slice(0, 8)}</small></div></td><td><StatusBadge value={run.status} /></td><td>{run.risk_level ? <StatusBadge value={run.risk_level} /> : "—"}</td><td>{run.branch_name ? `分支 ${run.branch_name}` : run.error_code ? errorLabel(run.error_code) : statusSummary(run.status)}</td><td>{formatTime(run.finished_at ?? run.started_at)}</td><td><Link className="table-link" href={`/runs/${run.id}`}>{run.status === "awaiting_approval" ? "查看 Diff" : "查看詳情"} →</Link></td></tr>)}</tbody></table></div> : <EmptyState title="還沒有 Agent 執行" description="從一個可執行任務開始分析後，執行紀錄會顯示在這裡。" actionHref="/tasks" actionLabel="前往任務" />}</section>
  </>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="card"><span className="muted">{label}</span><div className="metric">{value}</div></div>; }
function formatTime(value: string | null) { return value ? new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "尚未開始"; }
function statusSummary(status: string) { return status === "succeeded" ? "檢查通過，分支已就緒" : status === "rejected" ? "已由使用者拒絕" : status === "running" ? "Worker 正在處理" : status === "queued" ? "等待 Worker" : "尚未建立分支"; }
function errorLabel(code: string) { return code === "NO_CHANGES" ? "不需要修改" : code === "STALE_BASE" ? "Main 已更新，需重跑" : `錯誤：${code}`; }
