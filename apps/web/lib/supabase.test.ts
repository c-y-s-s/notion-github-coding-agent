import { describe, expect, it, vi } from "vitest";
import { retrySupabaseRead } from "./supabase";

describe("retrySupabaseRead", () => {
  it("PGRST303 後會重新讀取", async () => {
    const operation = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST303" } })
      .mockResolvedValueOnce({ data: ["ok"], error: null });
    const result = await retrySupabaseRead(operation, async () => {});
    expect(operation).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual(["ok"]);
  });

  it("其他錯誤不重試", async () => {
    const operation = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    await retrySupabaseRead(operation, async () => {});
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("持續發生 PGRST303 時最多嘗試四次", async () => {
    const operation = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST303" } });
    const wait = vi.fn().mockResolvedValue(undefined);
    await retrySupabaseRead(operation, wait);
    expect(operation).toHaveBeenCalledTimes(4);
    expect(wait).toHaveBeenCalledTimes(3);
  });
});
