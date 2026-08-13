import { notFound } from "next/navigation";
import { BenchmarkRunForm } from "@/components/benchmark-run-form";
import { StatusBadge } from "@/components/status-badge";
import { getBenchmarkData } from "@/lib/benchmark-data";
import { getBenchmarkCaseResults } from "@/lib/data";
import { estimatedCost, formatCost } from "@/lib/model-costs";

export default async function BenchmarkCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const benchmark = getBenchmarkData();
  const testCase = benchmark.cases.find(item => item.id === id);
  if (!testCase) notFound();
  const stored = await getBenchmarkCaseResults(id);
  const latest = stored[0];
  const fallback = testCase.result;
  const result = latest ? {
    passed: latest.passed,
    analysis: latest.analysis,
    context_files: latest.context_files,
    context_chars: latest.context_chars,
    usage: latest.token_usage,
    model_duration_ms: latest.model_duration_ms,
    checks: latest.checks,
    failure_category: latest.failure_category,
    model: latest.benchmark_runs?.model,
    prompt_version: latest.benchmark_runs?.prompt_version,
  } : fallback ? { ...fallback, model: benchmark.report.model, prompt_version: benchmark.report.prompt_version } : null;
  return <>
    <div className="eyebrow">Benchmark 案例</div><h1>{testCase.name}</h1><p className="lead">{testCase.task.description}</p>
    <div className="actions detail-status"><StatusBadge value={testCase.category} />{result && <StatusBadge value={result.passed ? "benchmark_pass" : "benchmark_fail"} />}</div>
    <section className="section card split"><div><span className="field-label">任務</span><h2>{testCase.task.title}</h2><p>{testCase.task.description}</p><span className="field-label">驗收條件</span><p>{testCase.task.acceptance_criteria}</p></div><div><span className="field-label">預期行為</span><p>{testCase.expected.can_prepare_patch ? "產生可驗證 Patch" : "安全拒絕且不得修改檔案"}</p><span className="field-label">預期檔案</span><div className="file-list">{testCase.expected.changed_files.length ? testCase.expected.changed_files.map(file => <code key={file}>{file}</code>) : <span className="muted">不得修改</span>}</div></div></section>
    <section className="section card"><div className="section-heading"><div><h2>重新執行</h2><p className="muted">排入 Supabase，由在線的本機 Worker 執行。</p></div></div><BenchmarkRunForm defaultModel={result?.model ?? benchmark.report.model} caseId={id} /></section>
    <section className="section card"><div className="section-heading"><div><h2>Context Retrieval</h2><p className="muted">模型實際收到的檔案與內容大小。</p></div>{result && <span className="badge">{result.context_chars ?? 0} chars</span>}</div>{result?.context_files?.length ? <div className="file-list">{result.context_files.map((file: string) => <code key={file}>{file}</code>)}</div> : <p className="muted">尚未保存 Context 紀錄；重新執行此案例後會出現。</p>}</section>
    <section className="section card"><div className="section-heading"><div><h2>模型觀測資料</h2><p className="muted">{result ? `${result.model} · Prompt ${result.prompt_version}` : "尚未執行"}</p></div></div><div className="grid"><div className="card"><span className="muted">模型耗時</span><div className="metric small">{result?.model_duration_ms ? `${(result.model_duration_ms / 1000).toFixed(1)}s` : "—"}</div></div><div className="card"><span className="muted">Input tokens</span><div className="metric small">{result?.usage?.input_tokens ?? "—"}</div></div><div className="card"><span className="muted">Output tokens</span><div className="metric small">{result?.usage?.output_tokens ?? "—"}</div></div><div className="card"><span className="muted">估算成本</span><div className="metric small">{result ? formatCost(estimatedCost(result.model ?? "", result.usage)) : "—"}</div></div><div className="card"><span className="muted">失敗分類</span><div className="metric small">{failureLabel(result?.failure_category)}</div></div></div></section>
    <section className="section card"><h2>Grader 結果</h2>{result?.checks ? <div className="failure-bars">{Object.entries(result.checks).map(([name, check]) => { const value = check as { passed?: boolean }; return <div className="failure-row" key={name}><span>{checkLabel(name)}</span><StatusBadge value={value.passed ? "benchmark_pass" : "benchmark_fail"} /></div>; })}</div> : <p className="muted">尚未執行。</p>}</section>
    {stored.length > 0 && <section className="section card"><h2>歷次結果</h2><div className="table-scroll"><table className="table"><thead><tr><th>模型</th><th>Prompt</th><th>版本</th><th>結果</th><th>耗時</th><th>Tokens</th></tr></thead><tbody>{stored.map(item => <tr key={item.id}><td>{item.benchmark_runs?.model}</td><td>{item.benchmark_runs?.prompt_version}</td><td>{item.benchmark_runs?.dataset_version}</td><td><StatusBadge value={item.passed ? "benchmark_pass" : "benchmark_fail"} /></td><td>{item.duration_ms ? `${(item.duration_ms / 1000).toFixed(1)}s` : "—"}</td><td>{item.token_usage?.total_tokens ?? "—"}</td></tr>)}</tbody></table></div></section>}
  </>;
}

function failureLabel(value?: string | null) { return ({ wrong_decision: "判斷錯誤", risk_mismatch: "風險不符", file_scope: "檔案範圍", acceptance_failed: "驗收失敗", runtime_error: "執行錯誤" } as Record<string, string>)[value ?? ""] ?? "無"; }
function checkLabel(value: string) { return ({ decision: "是否應修正", risk: "風險判斷", files: "修改範圍", acceptance: "Hidden test" } as Record<string, string>)[value] ?? value; }
