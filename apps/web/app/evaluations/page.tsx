import Link from "next/link";
import { listEvaluations } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";

const categoryLabels: Record<string, string> = { wrong_analysis: "分析方向錯誤", missing_context: "缺少程式碼背景", bad_patch: "Patch 不符合需求", checks_failed: "檢查無法通過", unsafe_scope: "修改範圍不安全", other: "其他" };

export default async function EvaluationsPage() {
  const evaluations = await listEvaluations();
  const analyzed = evaluations.length;
  const patchRated = evaluations.filter(item => item.patch_usable !== null);
  const correct = evaluations.filter(item => item.analysis_correct).length;
  const usable = patchRated.filter(item => item.patch_usable).length;
  const failures = Object.entries(evaluations.reduce<Record<string, number>>((counts, item) => { if (item.failure_category) counts[item.failure_category] = (counts[item.failure_category] ?? 0) + 1; return counts; }, {})).sort((a, b) => b[1] - a[1]);
  return <>
    <div className="eyebrow">Agent 品質</div><h1>Evaluation</h1><p className="lead">以人工標註衡量分析與 Patch 品質；樣本少於 10 筆時，百分比只供觀察。</p>
    <div className="grid"><div className="card"><span className="muted">已評估樣本</span><div className="metric">{analyzed}</div></div><div className="card"><span className="muted">分析正確率</span><div className="metric">{rate(correct, analyzed)}</div></div><div className="card"><span className="muted">Patch 可用率</span><div className="metric">{rate(usable, patchRated.length)}</div></div><div className="card"><span className="muted">尚未評 Patch</span><div className="metric">{analyzed - patchRated.length}</div></div></div>
    <section className="section card"><h2>失敗分類</h2>{failures.length ? <div className="failure-bars">{failures.map(([category, count]) => <div className="failure-row" key={category}><span>{categoryLabels[category] ?? category}</span><strong>{count}</strong></div>)}</div> : <p className="muted">目前沒有失敗標註。</p>}</section>
    <section className="section card"><h2>最近評估</h2>{evaluations.length ? <div className="table-scroll"><table className="table"><thead><tr><th>Run</th><th>分析</th><th>Patch</th><th>主要問題</th><th>備註</th></tr></thead><tbody>{evaluations.map(item => <tr key={item.id}><td><Link href={`/runs/${item.agent_run_id}`}>{item.agent_run_id.slice(0, 8)}</Link></td><td><StatusBadge value={item.analysis_correct ? "correct" : "incorrect"} /></td><td>{item.patch_usable === null ? "未評" : <StatusBadge value={item.patch_usable ? "usable" : "unusable"} />}</td><td>{item.failure_category ? categoryLabels[item.failure_category] : "—"}</td><td>{item.notes || "—"}</td></tr>)}</tbody></table></div> : <p className="muted">完成一次 Agent Run 後，可在執行詳情加入人工評估。</p>}</section>
  </>;
}

function rate(value: number, total: number) { return total ? `${Math.round(value / total * 100)}%` : "—"; }
