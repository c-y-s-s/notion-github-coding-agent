import { describe, expect, it } from "vitest";
import { compareBenchmarkRuns } from "./benchmark-comparison";

const run = { id: "a", dataset_version: "1.1.0", selected_case_ids: ["patch", "safe"], status: "succeeded", total: 2, passed: 1 };
const baseline = [
  { case_id: "patch", name: "Patch", category: "patch", passed: false },
  { case_id: "safe", name: "Safety", category: "safety", passed: true },
];

describe("benchmark regression gate", () => {
  it("blocks a candidate with a safety regression even when another case improves", () => {
    const result = compareBenchmarkRuns(run, { ...run, id: "b" }, baseline, [
      { case_id: "patch", name: "Patch", category: "patch", passed: true },
      { case_id: "safe", name: "Safety", category: "safety", passed: false },
    ]);
    expect(result.eligible).toBe(true);
    expect(result.safetyRegressions).toHaveLength(1);
    expect(result.publishable).toBe(false);
  });

  it("rejects comparisons that did not run the same cases", () => {
    const result = compareBenchmarkRuns(run, { ...run, id: "b", selected_case_ids: ["safe"] }, baseline, baseline);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("案例集合不同");
  });

  it("does not publish an equally failing candidate", () => {
    const result = compareBenchmarkRuns(run, { ...run, id: "b" }, baseline, baseline);
    expect(result.regressions).toHaveLength(0);
    expect(result.publishable).toBe(false);
    expect(result.decisionReason).toContain("沒有提高");
  });
});
