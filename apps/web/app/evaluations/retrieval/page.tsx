import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { getRetrievalEvaluation, retrievalVerdict } from "@/lib/retrieval-evaluation";

export default function RetrievalEvaluationPage() {
  const report = getRetrievalEvaluation();
  const verdict = retrievalVerdict();
  return <>
    <div className="eyebrow">Context Retrieval</div><h1>Retrieval Evaluation</h1><p className="lead">Retrieval Dataset v{report.retrieval_dataset_version} · Agent Dataset v{report.dataset_version}。在相同 Ground Truth 與相同 K 下比較 Keyword 與 Hybrid Semantic Retrieval。</p>
    <section className={`section card retrieval-verdict ${verdict.tone}`}><div><span className="field-label">目前結論</span><h2>{verdict.title}</h2><p>{verdict.detail}</p></div><StatusBadge value={verdict.tone === "positive" ? "benchmark_pass" : verdict.tone === "negative" ? "benchmark_fail" : "pending"} /></section>
    <section className="section retrieval-strategies"><StrategyCard name="Keyword" metrics={report.summary.keyword} /><div className="comparison-direction">vs</div><StrategyCard name="Hybrid Semantic" metrics={report.summary.hybrid} /></section>
    <section className="section card"><div className="section-heading"><div><h2>逐案例檢索結果</h2><p className="muted">Ground Truth 是每題解題或判斷風險所需的檔案；Patch 成功率不混入檢索分數。</p></div><span className="badge">K = {report.k}</span></div><div className="table-scroll"><table className="table benchmark-table"><thead><tr><th>案例</th><th>Ground Truth</th><th>文件數</th><th>Keyword 排名</th><th>Hybrid 排名</th><th>Recall</th></tr></thead><tbody>{report.results.map(item => <tr key={item.case_id}><td><Link href={`/evaluations/cases/${item.case_id}`}><strong>{item.name}</strong></Link><small>{item.case_id}</small></td><td><div className="file-list">{item.expected_files.map(file => <code key={file}>{file}</code>)}</div></td><td>{item.document_count}</td><td><RankedFiles files={item.keyword.selected} expected={item.expected_files} /></td><td><RankedFiles files={item.hybrid.selected} expected={item.expected_files} /></td><td>{percent(item.keyword.recall_at_k)} / {percent(item.hybrid.recall_at_k)}</td></tr>)}</tbody></table></div></section>
    <section className="section card limitation-card"><h2>限制與正確解讀</h2><ul className="analysis-list">{report.limitations.map(item => <li key={item}>{item}</li>)}<li>政策拒絕與資訊不足案例沒有可由 Query 推導的目標檔案，因此保留在 Agent Benchmark，但不製造假的 Retrieval Ground Truth。</li></ul></section>
    <Link href="/evaluations" className="button secondary">返回 Evaluation</Link>
  </>;
}

function StrategyCard({ name, metrics }: { name: string; metrics: { recall_at_k: number; precision_at_k: number; mrr: number; duration_ms: number; context_chars: number } }) { return <div className="card strategy-card"><h2>{name}</h2><div className="retrieval-metric-grid"><div><span>Recall@K</span><strong>{percent(metrics.recall_at_k)}</strong></div><div><span>Precision@K</span><strong>{percent(metrics.precision_at_k)}</strong></div><div><span>MRR</span><strong>{metrics.mrr.toFixed(2)}</strong></div><div><span>平均延遲</span><strong>{metrics.duration_ms < 1 ? "<1 ms" : `${Math.round(metrics.duration_ms)} ms`}</strong></div><div><span>Context</span><strong>{Math.round(metrics.context_chars)} chars</strong></div></div></div>; }
function RankedFiles({ files, expected }: { files: string[]; expected: string[] }) { return <ol className="ranked-files">{files.map(file => <li className={expected.includes(file) ? "hit" : ""} key={file}>{file}</li>)}</ol>; }
function percent(value: number) { return `${Math.round(value * 100)}%`; }
