import Link from "next/link";
import { listBenchmarkRuns, listEvaluations } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";
import { getBenchmarkData } from "@/lib/benchmark-data";
import { BenchmarkRunForm } from "@/components/benchmark-run-form";
import { estimatedCost, formatCost } from "@/lib/model-costs";

const categoryLabels: Record<string, string> = { wrong_analysis: "分析方向錯誤", missing_context: "缺少程式碼背景", bad_patch: "Patch 不符合需求", checks_failed: "檢查無法通過", unsafe_scope: "修改範圍不安全", other: "其他" };

export default async function EvaluationsPage() {
  const [evaluations, benchmarkRuns] = await Promise.all([listEvaluations(), listBenchmarkRuns()]);
  const benchmark = getBenchmarkData();
  const analyzed = evaluations.length;
  const patchRated = evaluations.filter(item => item.patch_usable !== null);
  const correct = evaluations.filter(item => item.analysis_correct).length;
  const usable = patchRated.filter(item => item.patch_usable).length;
  const failures = Object.entries(evaluations.reduce<Record<string, number>>((counts, item) => { if (item.failure_category) counts[item.failure_category] = (counts[item.failure_category] ?? 0) + 1; return counts; }, {})).sort((a, b) => b[1] - a[1]);
  return <>
    <div className="eyebrow">Agent 品質</div><h1>Evaluation</h1><p className="lead">固定測試集驗證 Agent 的修正與安全拒絕能力；人工標註補充真實任務的品質判斷。</p>

    <section className="section benchmark-hero">
      <div className="section-heading"><div><h2>固定測試集</h2><p className="muted">Dataset v{benchmark.dataset.version} · {benchmark.report.model} · Prompt {benchmark.report.prompt_version}</p></div><StatusBadge value={benchmark.report.summary.passed === benchmark.report.summary.total ? "benchmark_pass" : "benchmark_fail"} /></div>
      <div className="grid benchmark-metrics"><div className="card"><span className="muted">測試案例</span><div className="metric">{benchmark.report.summary.total}</div></div><div className="card"><span className="muted">整體通過率</span><div className="metric">{percent(benchmark.report.summary.pass_rate)}</div></div><div className="card"><span className="muted">Patch 成功率</span><div className="metric">{percent(benchmark.report.summary.patch_success_rate)}</div></div><div className="card"><span className="muted">安全拒絕率</span><div className="metric">{percent(benchmark.report.summary.safe_refusal_rate)}</div></div></div>
      <p className="benchmark-note">這是固定 regression dataset 的結果，不代表真實世界準確率。最新執行：{formatBenchmarkTime(benchmark.report.created_at)}</p>
      <BenchmarkRunForm defaultModel={benchmark.report.model} />
    </section>

    {benchmarkRuns.length > 0 && <section className="section card"><div className="section-heading"><div><h2>模型／Prompt 比較</h2><p className="muted">同一 Dataset 版本與案例數才適合直接比較；本地模型目前只允許 Evaluation。</p></div></div><div className="table-scroll"><table className="table"><thead><tr><th>模型</th><th>Prompt</th><th>版本</th><th>案例</th><th>狀態</th><th>通過</th><th>Patch</th><th>拒絕</th><th>Tokens</th><th>估算成本</th></tr></thead><tbody>{benchmarkRuns.map(run => <tr key={run.id}><td><strong>{run.model}</strong></td><td>{run.prompt_version}</td><td>{run.dataset_version}</td><td>{run.total}</td><td><StatusBadge value={run.status} /></td><td>{run.pass_rate === null ? "—" : percent(Number(run.pass_rate))}</td><td>{run.patch_success_rate === null ? "—" : percent(Number(run.patch_success_rate))}</td><td>{run.safe_refusal_rate === null ? "—" : percent(Number(run.safe_refusal_rate))}</td><td>{run.token_usage?.total_tokens ?? "—"}</td><td>{formatCost(estimatedCost(run.model, run.token_usage))}</td></tr>)}</tbody></table></div></section>}

    <section className="section card"><div className="section-heading"><div><h2>測試案例結果</h2><p className="muted">Patch 案例必須修改正確檔案並通過 hidden test；拒絕案例不得產生任何修改。</p></div></div><div className="table-scroll"><table className="table benchmark-table"><thead><tr><th>案例</th><th>類型</th><th>預期</th><th>結果</th><th>風險</th><th>耗時</th></tr></thead><tbody>{benchmark.cases.map(testCase => <tr key={testCase.id}><td><Link href={`/evaluations/cases/${testCase.id}`}><strong>{testCase.name}</strong></Link><small>{testCase.id}</small></td><td>{benchmarkCategory(testCase.category)}</td><td>{testCase.expected.can_prepare_patch ? "產生 Patch" : "安全拒絕"}</td><td>{testCase.result ? <StatusBadge value={testCase.result.passed ? "benchmark_pass" : "benchmark_fail"} /> : <span className="muted">尚未執行</span>}</td><td>{testCase.result?.analysis?.risk_level ? <StatusBadge value={testCase.result.analysis.risk_level} /> : "—"}</td><td>{testCase.result?.duration_ms ? `${(testCase.result.duration_ms / 1000).toFixed(1)} 秒` : "—"}</td></tr>)}</tbody></table></div></section>

    <div className="section-heading evaluation-heading"><div><div className="eyebrow">真實任務標註</div><h2>人工評估</h2><p className="muted">由使用者判斷實際 Run 的分析正確性與 Patch 可用性。</p></div></div>
    <div className="grid"><div className="card"><span className="muted">已評估樣本</span><div className="metric">{analyzed}</div></div><div className="card"><span className="muted">分析正確率</span><div className="metric">{rate(correct, analyzed)}</div></div><div className="card"><span className="muted">Patch 可用率</span><div className="metric">{rate(usable, patchRated.length)}</div></div><div className="card"><span className="muted">尚未評 Patch</span><div className="metric">{analyzed - patchRated.length}</div></div></div>
    <section className="section card"><h2>失敗分類</h2>{failures.length ? <div className="failure-bars">{failures.map(([category, count]) => <div className="failure-row" key={category}><span>{categoryLabels[category] ?? category}</span><strong>{count}</strong></div>)}</div> : <p className="muted">目前沒有失敗標註。</p>}</section>
    <section className="section card"><h2>最近評估</h2>{evaluations.length ? <div className="table-scroll"><table className="table"><thead><tr><th>Run</th><th>分析</th><th>Patch</th><th>主要問題</th><th>備註</th></tr></thead><tbody>{evaluations.map(item => <tr key={item.id}><td><Link href={`/runs/${item.agent_run_id}`}>{item.agent_run_id.slice(0, 8)}</Link></td><td><StatusBadge value={item.analysis_correct ? "correct" : "incorrect"} /></td><td>{item.patch_usable === null ? "未評" : <StatusBadge value={item.patch_usable ? "usable" : "unusable"} />}</td><td>{item.failure_category ? categoryLabels[item.failure_category] : "—"}</td><td>{item.notes || "—"}</td></tr>)}</tbody></table></div> : <p className="muted">完成一次 Agent Run 後，可在執行詳情加入人工評估。</p>}</section>
  </>;
}

function rate(value: number, total: number) { return total ? `${Math.round(value / total * 100)}%` : "—"; }
function percent(value: number | null) { return value === null ? "—" : `${Math.round(value * 100)}%`; }
function benchmarkCategory(category: string) { return category === "patch" ? "Patch" : category === "safety" ? "安全" : "品質"; }
function formatBenchmarkTime(value: string) { return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
