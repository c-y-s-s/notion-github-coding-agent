import { ActionButton } from "@/components/action-button";
import { AnalysisPanel } from "@/components/analysis-panel";
import { DiffViewer } from "@/components/diff-viewer";
import { StatusBadge } from "@/components/status-badge";
import { getRun } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/supabase";
import { EvaluationForm } from "@/components/evaluation-form";
import { estimatedCost, formatCost } from "@/lib/model-costs";
import { AgentFlow } from "@/components/agent-flow";
import { ReplayForm } from "@/components/replay-form";

export default async function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configured = hasSupabaseEnv();
  const { run, steps, artifacts, evaluation, related = [] } = await getRun(id);
  const analysis = artifacts.filter((artifact: { type: string }) => artifact.type === "analysis").at(-1);
  const contextMetadata = analysis?.metadata as { context_files?: string[]; context_chars?: number; model_call?: { duration_ms?: number; usage?: Record<string, number> }; retrieval?: { method?: string; embedding_model?: string | null; indexed_files?: number; selected_files?: string[]; duration_ms?: number; fallback_reason?: string | null } } | undefined;
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
    <section className="section card"><div className="section-heading"><div><h2>Agent 可觀測性</h2><p className="muted">模型實際收到的 Context、檢索方式、Token、估算成本與呼叫耗時。</p></div>{contextMetadata?.context_chars ? <span className="badge">{contextMetadata.context_chars} chars</span> : null}</div><div className="grid"><div className="card"><span className="muted">檢索方式</span><div className="metric small">{retrievalLabel(contextMetadata?.retrieval?.method)}</div></div><div className="card"><span className="muted">檢索耗時</span><div className="metric small">{contextMetadata?.retrieval?.duration_ms ? `${(contextMetadata.retrieval.duration_ms / 1000).toFixed(1)}s` : "—"}</div></div><div className="card"><span className="muted">模型耗時</span><div className="metric small">{contextMetadata?.model_call?.duration_ms ? `${(contextMetadata.model_call.duration_ms / 1000).toFixed(1)}s` : "—"}</div></div><div className="card"><span className="muted">Input tokens</span><div className="metric small">{run.token_usage?.totals?.input_tokens ?? contextMetadata?.model_call?.usage?.input_tokens ?? "—"}</div></div><div className="card"><span className="muted">Output tokens</span><div className="metric small">{run.token_usage?.totals?.output_tokens ?? contextMetadata?.model_call?.usage?.output_tokens ?? "—"}</div></div><div className="card"><span className="muted">估算成本</span><div className="metric small">{formatCost(estimatedCost(run.model, run.token_usage?.totals ?? contextMetadata?.model_call?.usage))}</div></div></div>{contextMetadata?.retrieval?.fallback_reason ? <div className="notice">語意檢索降級為關鍵字：{contextMetadata.retrieval.fallback_reason}</div> : null}{contextMetadata?.context_files?.length ? <><span className="field-label observability-files">Context Files</span><div className="file-list">{contextMetadata.context_files.map(file => <code key={file}>{file}</code>)}</div></> : <p className="muted">此紀錄建立於可觀測性功能之前；重新執行後會保存 Context。</p>}</section>
    <section className="section card"><div className="section-heading"><div><h2>Agent 修正歷程</h2><p className="muted">流程圖使用真實執行步驟；失敗檢查會回到 Error Analysis，最多重試三次。</p></div><span className="badge">{run.attempt_number || 1} 次嘗試</span></div><AgentFlow steps={steps} runStatus={run.status} />{steps.length === 0 ? <p className="muted">目前沒有執行步驟。</p> : <div className="table-scroll"><table className="table"><thead><tr><th>步驟</th><th>嘗試</th><th>類型</th><th>狀態</th><th>指令／結果</th></tr></thead><tbody>{steps.map((step: { id: string; sequence: number; attempt_number?: number; step_type: string; status: string; command?: string; output_excerpt?: string }) => <tr key={step.id}><td>{step.sequence}</td><td>{step.attempt_number ? `Attempt ${step.attempt_number}` : "Baseline"}</td><td>{step.step_type}</td><td><StatusBadge value={step.status} /></td><td><code>{step.command ?? "—"}</code>{step.status === "failed" && step.output_excerpt ? <details className="step-error"><summary>查看錯誤</summary><pre>{step.output_excerpt}</pre></details> : null}</td></tr>)}</tbody></table></div>}</section>
    <section className="section card"><h2>已驗證的程式碼修改</h2><DiffViewer content={patch?.content} />{run.status === "awaiting_approval" && <div className="actions approval-actions"><ActionButton endpoint={`/api/agent-runs/${run.id}/approve`} label="核准並推送分支" disabled={!configured} /><ActionButton endpoint={`/api/agent-runs/${run.id}/reject`} label="拒絕" tone="danger" disabled={!configured} /></div>}</section>
    {!['queued','running','awaiting_approval','approved','pushing'].includes(run.status) && <section className="section card"><div className="section-heading"><div><h2>Replay／Prompt 實驗</h2><p className="muted">Exact 固定 commit、Task 與 Context hashes；Latest Main 是新條件重跑，不能視為公平比較。</p></div></div><ReplayForm runId={run.id} exactAvailable={Boolean(run.base_commit_sha && run.task_snapshot && run.context_manifest?.length)} />{related.length > 1 && <div className="table-scroll replay-table"><table className="table"><thead><tr><th>Run</th><th>模式</th><th>Prompt</th><th>狀態</th><th>Commit</th><th>嘗試</th><th>Tokens</th></tr></thead><tbody>{related.map((item: { id: string; replay_mode?: string | null; prompt_version: string; status: string; base_commit_sha?: string | null; attempt_number: number; token_usage?: { totals?: { total_tokens?: number } } }) => <tr key={item.id}><td><a href={`/runs/${item.id}`}>{item.id.slice(0, 8)}</a></td><td>{item.replay_mode === "exact" ? "Exact" : item.replay_mode === "latest" ? "Latest Main" : "Original"}</td><td>{item.prompt_version}</td><td><StatusBadge value={item.status} /></td><td><code>{item.base_commit_sha?.slice(0, 8) ?? "—"}</code></td><td>{item.attempt_number}</td><td>{item.token_usage?.totals?.total_tokens ?? "—"}</td></tr>)}</tbody></table></div>}</section>}
    {!['queued','running','approved','pushing'].includes(run.status) && <section className="section card"><div className="section-heading"><div><h2>人工 Evaluation</h2><p className="muted">評估 AI 的分析與 Patch，不把安全拒絕直接算成失敗。</p></div></div><EvaluationForm runId={run.id} initial={evaluation} /></section>}
  </>;
}

function retrievalLabel(method?: string) { return method?.startsWith("hybrid_embedding") ? "Hybrid Semantic" : method === "keyword_fallback" ? "Keyword Fallback" : "—"; }
