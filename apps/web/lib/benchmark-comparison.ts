export type ComparableRun = {
  id: string;
  dataset_version: string;
  selected_case_ids: string[];
  status: string;
  total: number;
  passed: number;
};

export type ComparableResult = {
  case_id: string;
  name: string;
  category: string;
  passed: boolean;
  failure_category?: string | null;
};

export function compareBenchmarkRuns(
  baseline: ComparableRun,
  candidate: ComparableRun,
  baselineResults: ComparableResult[],
  candidateResults: ComparableResult[],
) {
  const sameCases = normalizedCases(baseline).join("\0") === normalizedCases(candidate).join("\0");
  const eligible = baseline.status === "succeeded" && candidate.status === "succeeded" && baseline.dataset_version === candidate.dataset_version && baseline.total === candidate.total && sameCases;
  const baselineByCase = new Map(baselineResults.map(result => [result.case_id, result]));
  const candidateByCase = new Map(candidateResults.map(result => [result.case_id, result]));
  const cases = [...new Set([...baselineByCase.keys(), ...candidateByCase.keys()])].sort().map(caseId => {
    const before = baselineByCase.get(caseId);
    const after = candidateByCase.get(caseId);
    const change = !before || !after ? "missing" : before.passed === after.passed ? "unchanged" : after.passed ? "improved" : "regressed";
    return { caseId, name: after?.name ?? before?.name ?? caseId, category: after?.category ?? before?.category ?? "unknown", before, after, change };
  });
  const regressions = cases.filter(item => item.change === "regressed");
  const improvements = cases.filter(item => item.change === "improved");
  const safetyRegressions = regressions.filter(item => item.category === "safety");
  const qualityImproved = candidate.passed > baseline.passed || candidate.passed === candidate.total;
  const publishable = eligible && regressions.length === 0 && qualityImproved;
  return {
    eligible,
    reason: eligible ? null : comparisonReason(baseline, candidate, sameCases),
    cases,
    regressions,
    improvements,
    safetyRegressions,
    publishable,
    decisionReason: !eligible
      ? comparisonReason(baseline, candidate, sameCases)
      : regressions.length
        ? safetyRegressions.length ? `發現 ${safetyRegressions.length} 個安全案例退步。` : `發現 ${regressions.length} 個案例退步。`
        : !qualityImproved ? "候選版本沒有提高通過數，仍不建議發布。" : "沒有案例退步，且候選版本的通過數已提升。",
  };
}

function normalizedCases(run: ComparableRun) {
  return [...(run.selected_case_ids ?? [])].sort();
}

function comparisonReason(baseline: ComparableRun, candidate: ComparableRun, sameCases: boolean) {
  if (baseline.status !== "succeeded" || candidate.status !== "succeeded") return "兩次 Benchmark 都必須已完成。";
  if (baseline.dataset_version !== candidate.dataset_version) return "Dataset 版本不同，不能直接比較。";
  if (baseline.total !== candidate.total || !sameCases) return "執行的案例集合不同，不能用分數判斷回歸。";
  return "這兩次執行無法比較。";
}
