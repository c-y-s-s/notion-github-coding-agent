import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { compareBenchmarkRuns } from "@/lib/benchmark-comparison";
import { getBenchmarkRunWithResults } from "@/lib/data";

export default async function BenchmarkComparePage({ searchParams }: { searchParams: Promise<{ baseline?: string; candidate?: string }> }) {
  const { baseline: baselineId, candidate: candidateId } = await searchParams;
  if (!baselineId || !candidateId || baselineId === candidateId) notFound();
  const [baselineData, candidateData] = await Promise.all([getBenchmarkRunWithResults(baselineId), getBenchmarkRunWithResults(candidateId)]);
  if (!baselineData || !candidateData) notFound();
  const comparison = compareBenchmarkRuns(baselineData.run, candidateData.run, baselineData.results, candidateData.results);
  return <>
    <div className="eyebrow">Evaluation 回歸閘門</div><h1>Benchmark 比較</h1><p className="lead">只有相同 Dataset 與案例集合才可比較；任何案例退步都阻止候選版本發布。</p>
    <section className={`section card release-gate ${comparison.publishable ? "pass" : "fail"}`}><div><span className="field-label">發布判斷</span><h2>{comparison.publishable ? "候選版本可發布" : "候選版本不可發布"}</h2><p>{comparison.decisionReason}</p></div><StatusBadge value={comparison.publishable ? "benchmark_pass" : "benchmark_fail"} /></section>
    <section className="section comparison-summary"><div className="card"><span className="muted">基準</span><strong>{baselineData.run.model}</strong><small>Prompt {baselineData.run.prompt_version} · {baselineData.run.passed}/{baselineData.run.total}</small></div><div className="comparison-direction">→</div><div className="card"><span className="muted">候選</span><strong>{candidateData.run.model}</strong><small>Prompt {candidateData.run.prompt_version} · {candidateData.run.passed}/{candidateData.run.total}</small></div></section>
    <section className="section card"><div className="section-heading"><div><h2>逐案例差異</h2><p className="muted">進步不能抵銷安全退步。</p></div><div className="actions"><span className="badge green">進步 {comparison.improvements.length}</span><span className="badge red">退步 {comparison.regressions.length}</span></div></div><div className="table-scroll"><table className="table"><thead><tr><th>案例</th><th>類型</th><th>基準</th><th>候選</th><th>變化</th><th>候選失敗原因</th></tr></thead><tbody>{comparison.cases.map(item => <tr key={item.caseId}><td><Link href={`/evaluations/cases/${item.caseId}`}><strong>{item.name}</strong></Link><small>{item.caseId}</small></td><td>{categoryLabel(item.category)}</td><td><StatusBadge value={item.before?.passed ? "benchmark_pass" : "benchmark_fail"} /></td><td><StatusBadge value={item.after?.passed ? "benchmark_pass" : "benchmark_fail"} /></td><td>{changeLabel(item.change)}</td><td>{failureLabel(item.after?.failure_category)}</td></tr>)}</tbody></table></div></section>
    <Link className="button secondary" href="/evaluations">返回 Evaluation</Link>
  </>;
}

function categoryLabel(value: string) { return value === "patch" ? "Patch" : value === "safety" ? "安全" : "品質"; }
function changeLabel(value: string) { return ({ improved: "↑ 進步", regressed: "↓ 退步", unchanged: "— 相同", missing: "資料缺失" } as Record<string, string>)[value] ?? value; }
function failureLabel(value?: string | null) { return ({ wrong_decision: "判斷錯誤", risk_mismatch: "風險不符", file_scope: "檔案範圍", acceptance_failed: "驗收失敗", runtime_error: "執行錯誤" } as Record<string, string>)[value ?? ""] ?? "—"; }
