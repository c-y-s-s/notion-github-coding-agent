import { describe, expect, it } from "vitest";
import { notionPlanningProperties } from "./notion-task-sync";

describe("notionPlanningProperties", () => {
  it("以 Supabase 的狀態、Deadline 與 Sprint 建立 Notion properties", () => {
    const result = notionPlanningProperties(
      { planning_status: "ready", deadline: "2026-08-21" },
      "sprint-page",
    );
    expect(result["Planning Status"]).toEqual({ status: { name: "可執行" } });
    expect(result.Deadline).toEqual({ date: { start: "2026-08-21" } });
    expect(result.Sprint).toEqual({ relation: [{ id: "sprint-page" }] });
  });

  it("可清除未設定的 Deadline", () => {
    const result = notionPlanningProperties(
      { planning_status: "blocked", deadline: null },
      "sprint-page",
    );
    expect(result.Deadline).toEqual({ date: null });
  });
});
