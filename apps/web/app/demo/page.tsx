import Link from "next/link";
import { AgentFlow } from "@/components/agent-flow";
import { AnalysisPanel } from "@/components/analysis-panel";
import { DiffViewer } from "@/components/diff-viewer";
import { StatusBadge } from "@/components/status-badge";
import { getDemoStory } from "@/lib/data";
import { getRetrievalEvaluation, retrievalVerdict } from "@/lib/retrieval-evaluation";
import { estimatedCost, formatCost } from "@/lib/model-costs";

export default async function DemoPage() {
  const story = await getDemoStory();
  const retrieval = getRetrievalEvaluation();
  const verdict = retrievalVerdict();
  if (!story) return <><div className="eyebrow">面試展示</div><h1>Demo Mode</h1><section className="section card demo-empty"><h2>尚未找到 Original＋Replay 資料</h2><p className="muted">先完成一筆新版 Agent Run，再從 Run 詳情建立 Exact Replay。此頁不會使用假資料填充。</p><Link className="button" href="/tasks">前往任務</Link></section></>;
  const originalAnalysis = lastArtifact(story.artifacts, story.original.id, "analysis");
  const originalDiff = story.artifacts.find((item: Artifact) => item.agent_run_id === story.original.id && item.type === "diff" && item.metadata?.verified);
  const replayAnalysis = lastArtifact(story.artifacts, story.replay.id, "analysis");
  const originalSteps = story.steps.filter((step: Step) => step.agent_run_id === story.original.id);
  const replaySteps = story.steps.filter((step: Step) => step.agent_run_id === story.replay.id);
  const retrievalMeta = originalAnalysis?.metadata?.retrieval;
  const recordingMode = "recordingMode" in story && story.recordingMode === true;
  return <>
    {recordingMode && <div className="demo-recording-note"><strong>錄影資料模式</strong><span>固定資料用於穩定錄製介面流程；正式模式會改讀 Supabase 真實 Run。</span></div>}
    <div className="demo-header"><div><div className="eyebrow">五分鐘面試展示</div><h1>AI Coding Agent：從任務到可驗證決策</h1><p className="lead">{recordingMode ? "使用固定錄影案例展示完整流程，避免錄製期間受外部服務與模型延遲影響。" : "所有內容來自真實 Task、Agent Run、測試、Evidence 與 Replay；不是預先寫死的成功畫面。"}</p></div>{!recordingMode && <div className="demo-header-actions"><Link className="button secondary" href={`/runs/${story.original.id}`}>查看原始 Run</Link><Link className="button" href={`/runs/${story.replay.id}`}>查看 Replay</Link></div>}</div>

    <nav className="demo-nav" aria-label="Demo 段落"><a href="#intake">1 Intake</a><a href="#retrieval">2 Retrieval</a><a href="#patch">3 Patch</a><a href="#evidence">4 Evidence</a><a href="#replay">5 Replay</a><a href="#evaluation">6 Evaluation</a></nav>

    <DemoSection id="intake" number="01" title="人工審核後才交給 Agent" talking="Notion 是內部任務來源；外部 GitHub Issue 先進 Inbox。未經人工接受或連結，不會污染 Notion，也不能啟動 Agent。"><div className="demo-task"><div><span className="field-label">真實 E2E Task</span><h3>{story.task.title}</h3><p>{story.task.description}</p></div><div className="stacked-badges"><StatusBadge value={story.task.type} /><StatusBadge value={story.task.source} /><StatusBadge value={story.task.planning_status} /></div></div></DemoSection>

    <DemoSection id="retrieval" number="02" title="Context 不是整個 Repository" talking="Agent 先做 Hybrid Retrieval，索引綁定 commit。Embedding 失敗會降級 Keyword；Evaluation fixture 不允許進正式 Context。"><div className="demo-metrics"><Metric label="檢索方式" value={retrievalMeta?.method === "hybrid_embedding" ? "Hybrid" : retrievalMeta?.method ?? "—"} /><Metric label="Context Files" value={String(originalAnalysis?.metadata?.context_files?.length ?? 0)} /><Metric label="Context Chars" value={String(originalAnalysis?.metadata?.context_chars ?? 0)} /><Metric label="檢索耗時" value={retrievalMeta?.duration_ms ? `${(retrievalMeta.duration_ms / 1000).toFixed(1)}s` : "—"} /></div><div className="file-list demo-files">{originalAnalysis?.metadata?.context_files?.map((file: string) => <code key={file}>{file}</code>)}</div></DemoSection>

    <DemoSection id="patch" number="03" title="Agent 是可檢查的工作流程" talking="這不是單次 LLM 呼叫。Baseline 先通過，模型才可修改；Patch 後重新執行 lint、typecheck、test，最多修正三次。"><AgentFlow steps={originalSteps} runStatus={story.original.status} /><div className="demo-metrics"><Metric label="結果" value={story.original.status} /><Metric label="嘗試" value={String(story.original.attempt_number)} /><Metric label="風險" value={story.original.risk_level ?? "—"} /><Metric label="成本" value={formatCost(estimatedCost(story.original.model, story.original.token_usage?.totals))} /></div><DiffViewer content={originalDiff?.content} /></DemoSection>

    <DemoSection id="evidence" number="04" title="沒有可驗證證據就不能核准" talking="模型必須引用檔案、行號與原始片段。Worker 對照實際 Context 驗證，不相信模型自行宣稱『已確認』。"><AnalysisPanel content={originalAnalysis?.content} /></DemoSection>

    <DemoSection id="replay" number="05" title="相同條件下比較 Prompt" talking="Exact Replay 固定 Task snapshot、base commit、Context paths 與 SHA-256。這次 Prompt v2 並沒有更好，而是因錯誤行號被 Evidence Gate 阻擋。"><div className="demo-compare"><RunCard label="Original" run={story.original} /><div className="comparison-direction">→</div><RunCard label="Exact Replay" run={story.replay} /></div><AgentFlow steps={replaySteps} runStatus={story.replay.status} />{replayAnalysis && <details className="demo-details"><summary>查看 Replay 分析與失敗證據</summary><AnalysisPanel content={replayAnalysis.content} /></details>}</DemoSection>

    <DemoSection id="evaluation" number="06" title="用 Evaluation 決定技術，不替技術找理由" talking="困難 Retrieval corpus 中，Keyword 與 Hybrid 品質持平，但 Hybrid 明顯更慢。因此目前沒有證據支持全面取代 Keyword。"><div className={`demo-verdict ${verdict.tone}`}><strong>{verdict.title}</strong><span>{verdict.detail}</span></div><div className="demo-compare"><Strategy label="Keyword" data={retrieval.summary.keyword} /><div className="comparison-direction">vs</div><Strategy label="Hybrid" data={retrieval.summary.hybrid} /></div><div className="demo-final-links"><Link className="button secondary" href="/evaluations/retrieval">Retrieval 報告</Link><Link className="button secondary" href="/evaluations">完整 Evaluation</Link></div></DemoSection>
  </>;
}

type Artifact = { agent_run_id: string; type: string; content?: string | null; metadata?: { verified?: boolean; retrieval?: { method?: string; duration_ms?: number }; context_files?: string[]; context_chars?: number } };
type Step = { agent_run_id: string; sequence: number; step_type: string; status: string; attempt_number?: number };
function lastArtifact(artifacts: Artifact[], runId: string, type: string) { return artifacts.filter(item => item.agent_run_id === runId && item.type === type).at(-1); }
function DemoSection({ id, number, title, talking, children }: { id: string; number: string; title: string; talking: string; children: React.ReactNode }) { return <section className="section card demo-section" id={id}><div className="demo-section-heading"><span>{number}</span><div><h2>{title}</h2><p>{talking}</p></div></div><div className="demo-section-content">{children}</div></section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="card"><span className="muted">{label}</span><strong>{value}</strong></div>; }
type DemoRun = { id: string; status: string; prompt_version: string; base_commit_sha?: string | null; token_usage?: { totals?: { total_tokens?: number } }; error_code?: string | null };
function RunCard({ label, run }: { label: string; run: DemoRun }) { return <div className="card run-card"><span className="field-label">{label}</span><div className="run-card-title"><strong>{run.id.slice(0, 8)}</strong><StatusBadge value={run.status} /></div><dl><div><dt>Prompt</dt><dd>{run.prompt_version}</dd></div><div><dt>Commit</dt><dd>{run.base_commit_sha?.slice(0, 8)}</dd></div><div><dt>Tokens</dt><dd>{run.token_usage?.totals?.total_tokens ?? "—"}</dd></div><div><dt>結果</dt><dd>{run.error_code ?? "通過檢查"}</dd></div></dl></div>; }
function Strategy({ label, data }: { label: string; data: { recall_at_k: number; mrr: number; duration_ms: number } }) { return <div className="card strategy-demo"><h3>{label}</h3><div><span>Recall@3</span><strong>{Math.round(data.recall_at_k * 100)}%</strong></div><div><span>MRR</span><strong>{data.mrr.toFixed(2)}</strong></div><div><span>延遲</span><strong>{data.duration_ms < 1 ? "<1 ms" : `${Math.round(data.duration_ms)} ms`}</strong></div></div>; }
