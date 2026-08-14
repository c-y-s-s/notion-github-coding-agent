import { ActionButton } from "@/components/action-button";
import { AgentFlow } from "@/components/agent-flow";
import { AnalysisPanel } from "@/components/analysis-panel";
import { DetailTabs } from "@/components/detail-tabs";
import { DiffViewer } from "@/components/diff-viewer";
import { EvaluationForm } from "@/components/evaluation-form";
import { ReplayForm } from "@/components/replay-form";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader, SectionHeader } from "@/components/ui";
import { getRun } from "@/lib/data";
import { estimatedCost, formatCost } from "@/lib/model-costs";
import { hasSupabaseEnv } from "@/lib/supabase";

export default async function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configured = hasSupabaseEnv();
  const { run, steps, artifacts, evaluation, related = [] } = await getRun(id);
  const analysis = artifacts.filter((artifact: { type: string }) => artifact.type === "analysis").at(-1);
  const context = analysis?.metadata as ContextMetadata | undefined;
  const patch = artifacts.filter((artifact: { type: string; metadata?: { verified?: boolean } }) => artifact.type === "diff" && artifact.metadata?.verified).at(-1);
  const awaiting = run.status === "awaiting_approval";
  const checks = steps.filter((step: Step) => step.step_type === "test");
  const checksPassed = checks.length > 0 && checks.every((step: Step) => step.status === "completed");
  const tabs = [
    { id: "changes", label: "程式碼修改", content: <><SectionHeader title="已驗證的程式碼修改" description="這是 Worker 實際檢查過的 Diff，不是模型的文字建議。" /> <DiffViewer content={patch?.content} /></> },
    { id: "analysis", label: "AI 分析", content: <><SectionHeader title="分析與風險" description="問題判斷、預計修改、驗收方式與證據。" /><AnalysisPanel content={analysis?.content} /></> },
    { id: "execution", label: "測試與歷程", content: <ExecutionContent run={run} steps={steps} context={context} /> },
    { id: "experiments", label: "Replay／評估", content: <ExperimentContent run={run} related={related} evaluation={evaluation} /> },
  ];

  return <>
    <PageHeader eyebrow="AI Agent 執行" title={`Run ${run.id.slice(0, 8)}`} description="先確認結果、風險與檢查，再決定是否推送分支。" />
    <section className={`decision-summary ${awaiting ? "warning" : ""}`}><div><div className="actions"><StatusBadge value={run.status} />{run.risk_level ? <StatusBadge value={run.risk_level} /> : null}</div><h2>{decisionTitle(run.status, run.error_code)}</h2><p>{decisionDescription(run.status, checksPassed, patch)}</p><div className="decision-facts"><span className="badge">{patch ? "已有 Diff" : "無 Diff"}</span><span className="badge">{checksPassed ? "必要檢查通過" : `${checks.length} 筆檢查紀錄`}</span><span className="badge">{run.attempt_number || 1} 次嘗試</span><span className="badge">{formatCost(estimatedCost(run.model, run.token_usage?.totals))}</span></div></div>{awaiting ? <div className="actions"><ActionButton endpoint={`/api/agent-runs/${run.id}/reject`} label="拒絕" tone="danger" disabled={!configured} /><ActionButton endpoint={`/api/agent-runs/${run.id}/approve`} label="核准並推送分支" disabled={!configured} /></div> : null}</section>
    {run.error_code === "NO_CHANGES" ? <div className="notice outcome-success"><StatusBadge value="no_changes" /> 目前程式碼已符合需求，不需要建立分支或 PR。</div> : null}
    {run.error_code === "STALE_BASE" ? <div className="notice"><StatusBadge value="stale_base" /> Main 已更新，請改為審核系統自動建立的新 Run。</div> : null}
    <DetailTabs tabs={tabs} initialId="changes" />
    {awaiting ? <div className="approval-bar"><ActionButton endpoint={`/api/agent-runs/${run.id}/reject`} label="拒絕" tone="danger" disabled={!configured} /><ActionButton endpoint={`/api/agent-runs/${run.id}/approve`} label="核准並推送分支" disabled={!configured} /></div> : null}
  </>;
}

function ExecutionContent({ run, steps, context }: { run: any; steps: Step[]; context?: ContextMetadata }) {
  return <><SectionHeader title="Agent 修正歷程" description="Baseline 通過後才修改；失敗會分析錯誤並重試，最多三次。" /><AgentFlow steps={steps} runStatus={run.status} />{steps.length ? <div className="table-scroll"><table className="table"><thead><tr><th>步驟</th><th>嘗試</th><th>類型</th><th>狀態</th><th>指令／結果</th></tr></thead><tbody>{steps.map(step => <tr key={step.id}><td>{step.sequence}</td><td>{step.attempt_number ? `Attempt ${step.attempt_number}` : "Baseline"}</td><td>{step.step_type}</td><td><StatusBadge value={step.status} /></td><td><code>{step.command ?? "—"}</code>{step.status === "failed" && step.output_excerpt ? <details className="step-error"><summary>查看錯誤</summary><pre>{step.output_excerpt}</pre></details> : null}</td></tr>)}</tbody></table></div> : <p className="muted">目前沒有執行步驟。</p>}<SectionHeader title="Context 與成本" description="模型實際收到的程式碼範圍與呼叫成本。" /><div className="grid"><Metric label="檢索方式" value={retrievalLabel(context?.retrieval?.method)} /><Metric label="Context" value={`${context?.context_chars ?? 0} chars`} /><Metric label="模型耗時" value={context?.model_call?.duration_ms ? `${(context.model_call.duration_ms / 1000).toFixed(1)}s` : "—"} /><Metric label="Tokens" value={String(run.token_usage?.totals?.total_tokens ?? "—")} /></div>{context?.context_files?.length ? <div className="file-list">{context.context_files.map(file => <code key={file}>{file}</code>)}</div> : null}</>;
}

function ExperimentContent({ run, related, evaluation }: { run: any; related: any[]; evaluation: any }) {
  const terminal = !["queued", "running", "awaiting_approval", "approved", "pushing"].includes(run.status);
  return <>{terminal ? <><SectionHeader title="Replay／Prompt 實驗" description="Exact 固定原始條件；Latest Main 是新條件重跑。" /><ReplayForm runId={run.id} exactAvailable={Boolean(run.base_commit_sha && run.task_snapshot && run.context_manifest?.length)} />{related.length > 1 ? <div className="table-scroll"><table className="table"><thead><tr><th>Run</th><th>模式</th><th>Prompt</th><th>狀態</th><th>Commit</th></tr></thead><tbody>{related.map(item => <tr key={item.id}><td><a className="table-link" href={`/runs/${item.id}`}>{item.id.slice(0, 8)}</a></td><td>{item.replay_mode === "exact" ? "Exact" : item.replay_mode === "latest" ? "Latest Main" : "Original"}</td><td>{item.prompt_version}</td><td><StatusBadge value={item.status} /></td><td><code>{item.base_commit_sha?.slice(0, 8) ?? "—"}</code></td></tr>)}</tbody></table></div> : null}</> : <p className="muted">執行結束後才能建立 Replay。</p>}<SectionHeader title="人工 Evaluation" description="由人判斷分析是否正確、Patch 是否可用。" />{!["queued", "running", "approved", "pushing"].includes(run.status) ? <EvaluationForm runId={run.id} initial={evaluation} /> : <p className="muted">執行完成後才可評估。</p>}</>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="card"><span className="muted">{label}</span><div className="metric small">{value}</div></div>; }
function decisionTitle(status: string, error?: string | null) { if (status === "awaiting_approval") return "修改已通過檢查，等待你的決定"; if (status === "failed") return "執行失敗，需要查看原因"; if (error === "NO_CHANGES") return "程式碼已符合需求"; if (status === "succeeded") return "分支已成功推送"; if (["queued", "running"].includes(status)) return "Agent 正在準備結果"; return "這次執行已結束"; }
function decisionDescription(status: string, checksPassed: boolean, patch: unknown) { if (status === "awaiting_approval") return `${patch ? "程式碼修改已產生" : "尚無修改"}，${checksPassed ? "必要檢查全部通過" : "請確認檢查結果"}。`; if (status === "failed") return "開啟測試與歷程，查看停止在哪一個安全閘門。"; return "完整分析、執行步驟與實驗資料都保留在下方。"; }
function retrievalLabel(method?: string) { return method?.startsWith("hybrid_embedding") ? "Hybrid" : method === "keyword_fallback" ? "Keyword" : "—"; }
type Step = { id: string; sequence: number; attempt_number?: number; step_type: string; status: string; command?: string; output_excerpt?: string };
type ContextMetadata = { context_files?: string[]; context_chars?: number; model_call?: { duration_ms?: number }; retrieval?: { method?: string } };
