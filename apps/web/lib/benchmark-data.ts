import dataset from "../../../workers/agent/evals/dataset.json";
import report from "../../../workers/agent/eval-results/latest.json";

export type BenchmarkCase = (typeof dataset.cases)[number];
export type BenchmarkResult = (typeof report.results)[number];

export function getBenchmarkData() {
  return {
    dataset,
    report,
    cases: dataset.cases.map(testCase => ({
      ...testCase,
      result: report.results.find(result => result.id === testCase.id),
    })),
  };
}
