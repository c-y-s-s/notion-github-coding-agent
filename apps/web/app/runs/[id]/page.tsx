import { ActionButton } from "@/components/action-button";
import { AnalysisPanel } from "@/components/analysis-panel";
import { DiffViewer } from "@/components/diff-viewer";
import { StatusBadge } from "@/components/status-badge";
import { getRun } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/supabase";

export default async function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configured = hasSupabaseEnv();
  const { run, steps, artifacts } = await getRun(id);
  const analysis = artifacts.filter((artifact: { type: string }) => artifact.type === "analysis").at(-1);
  const patch = artifacts.filter((artifact: { type: string; metadata?: { verified?: boolean } }) => artifact.type === "diff" && artifact.metadata?.verified).at(-1);
  const noChanges = run.error_code === "NO_CHANGES";
  const staleBase = run.error_code === "STALE_BASE";

  return <>
    <div className="eyebrow">代理執行詳情</div>
    <h1>Run {run.id.slice(0, 8)}</h1>
    <div className="actions detail-status"><StatusBadge value={run.status} />{run.risk_level && <StatusBadge value={run.risk_level} />}</div>
    {noChanges && <div className="notice outcome-success"><StatusBadge value="no_changes" /> 目前程式碼已符合需求，不需要建立分支或 PR。</div>}
    {staleBase && <div className="notice"><StatusBadge value="stale_base" /> Main 已更新，系統已從最新 commit 自動建立替代 Run，請審核新的 Diff。</div>}
    {!configured && <div className="notice">目前為示範模式。連接 Supabase 與 Worker 後才能核准或拒絕修改。</div>}

    <section className="section card"><h2>AI 分析</h2><AnalysisPanel content={analysis?.content} /></section>
    <section className="section card"><div className="section-heading"><div><h2>Agent 修正歷程</h2><p className="muted">最多三次；每輪修改後都重新執行必要檢查。</p></div><span className="badge">{run.attempt_number || 1} 次嘗試</span></div>{steps.length === 0 ? <p className="muted">目前沒有執行步驟。</p> : <table className="table"><thead><tr><th>步驟</th><th>嘗試</th><th>類型</th><th>狀態</th><th>指令／結果</th></tr></thead><tbody>{steps.map((step: { id: string; sequence: number; attempt_number?: number; step_type: string; status: string; command?: string; output_excerpt?: string }) => <tr key={step.id}><td>{step.sequence}</td><td>{step.attempt_number ? `Attempt ${step.attempt_number}` : "Baseline"}</td><td>{step.step_type}</td><td><StatusBadge value={step.status} /></td><td><code>{step.command ?? "—"}</code>{step.status === "failed" && step.output_excerpt ? <details className="step-error"><summary>查看錯誤</summary><pre>{step.output_excerpt}</pre></details> : null}</td></tr>)}</tbody></table>}</section>
    <section className="section card"><h2>已驗證的程式碼修改</h2><DiffViewer content={patch?.content} />{run.status === "awaiting_approval" && <div className="actions approval-actions"><ActionButton endpoint={`/api/agent-runs/${run.id}/approve`} label="核准並推送分支" disabled={!configured} /><ActionButton endpoint={`/api/agent-runs/${run.id}/reject`} label="拒絕" tone="danger" disabled={!configured} /></div>}</section>
  </>;
}
