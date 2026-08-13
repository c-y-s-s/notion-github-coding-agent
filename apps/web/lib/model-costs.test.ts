import { describe, expect, it } from "vitest";
import { estimatedCost, formatCost } from "./model-costs";

describe("model cost estimate", () => {
  it("uses the configured Luna input and output rates", () => {
    expect(estimatedCost("gpt-5.6-luna", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBe(7);
    expect(formatCost(0.001763)).toBe("$0.0018");
  });

  it("does not invent pricing for unknown models", () => {
    expect(estimatedCost("custom-model", { input_tokens: 100, output_tokens: 100 })).toBeNull();
    expect(formatCost(null)).toBe("—");
  });
});
