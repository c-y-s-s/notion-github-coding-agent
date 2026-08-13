import { describe, expect, it } from "vitest";
import { getRetrievalEvaluation, retrievalVerdict } from "./retrieval-evaluation";

describe("retrieval evaluation report", () => {
  it("contains both strategies for every case", () => {
    const report = getRetrievalEvaluation();
    expect(report.results).toHaveLength(5);
    expect(report.results.every(result => result.keyword && result.hybrid)).toBe(true);
  });

  it("does not claim hybrid wins when recall is tied", () => {
    expect(retrievalVerdict().tone).toBe("neutral");
  });
});
