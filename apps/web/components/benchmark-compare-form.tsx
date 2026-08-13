type Run = { id: string; model: string; prompt_version: string; dataset_version: string; total: number; status: string };

export function BenchmarkCompareForm({ runs }: { runs: Run[] }) {
  const completed = runs.filter(run => run.status === "succeeded");
  if (completed.length < 2) return <p className="muted">至少需要兩次已完成的 Benchmark 才能比較。</p>;
  return <form className="benchmark-compare-form" action="/evaluations/compare">
    <label><span>基準版本</span><select name="baseline" defaultValue={completed[1]?.id}>{completed.map(run => <option key={run.id} value={run.id}>{label(run)}</option>)}</select></label>
    <span className="compare-arrow">→</span>
    <label><span>候選版本</span><select name="candidate" defaultValue={completed[0]?.id}>{completed.map(run => <option key={run.id} value={run.id}>{label(run)}</option>)}</select></label>
    <button className="button" type="submit">比較回歸</button>
  </form>;
}

function label(run: Run) { return `${run.model} · ${run.prompt_version} · v${run.dataset_version} · ${run.total} 題`; }
