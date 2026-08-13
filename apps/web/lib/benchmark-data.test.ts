import { describe, expect, it } from "vitest";
import { getBenchmarkData } from "./benchmark-data";

describe("versioned benchmark bundle", () => {
  it("ships a result for every dataset case", () => {
    const benchmark = getBenchmarkData();
    expect(benchmark.dataset.version).toBe("1.1.0");
    expect(benchmark.cases).toHaveLength(12);
    expect(benchmark.cases.every(testCase => testCase.result?.passed)).toBe(true);
  });
});
