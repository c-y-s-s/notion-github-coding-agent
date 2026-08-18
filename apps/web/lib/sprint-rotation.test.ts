import { describe, expect, it } from "vitest";
import { canonicalSprintName, deriveSprintWindows } from "./sprint-rotation";

const sprint = (start_date: string, end_date: string) => ({ start_date, end_date });

describe("deriveSprintWindows", () => {
  it("依台北日期產生 Past、Last、Current、Next 與 Future", () => {
    const result = deriveSprintWindows([
      sprint("2026-08-03", "2026-08-09"),
      sprint("2026-08-10", "2026-08-16"),
      sprint("2026-08-17", "2026-08-23"),
      sprint("2026-08-24", "2026-08-30"),
      sprint("2026-08-31", "2026-09-06"),
    ], "2026-08-18");

    expect(result.map(item => item.sprint_window)).toEqual(["past", "last", "current", "next", "future"]);
    expect(result.map(item => item.status)).toEqual(["completed", "completed", "active", "planned", "planned"]);
  });

  it("日期落在 Sprint 空檔時仍標示最近的 Last 與 Next", () => {
    const result = deriveSprintWindows([
      sprint("2026-08-03", "2026-08-09"),
      sprint("2026-08-17", "2026-08-23"),
    ], "2026-08-12");

    expect(result.map(item => item.sprint_window)).toEqual(["last", "next"]);
  });

  it("Sprint 名稱不包含會隨時間改變的 Window", () => {
    expect(canonicalSprintName("2026-08-17", "2026-08-23")).toBe("Sprint 2026/08/17–08/23");
  });
});
