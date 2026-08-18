import { describe, expect, it } from "vitest";
import { orderedSprints, sprintLabel, sprintSlots } from "./sprint-display";
import type { Sprint } from "./types";

const sprints = [
  sprint("last", "2026-08-03", "2026-08-09", "completed"),
  sprint("current", "2026-08-10", "2026-08-16", "active"),
  sprint("next", "2026-08-17", "2026-08-23", "planned"),
];

describe("sprint display", () => {
  it("resolves relative slots without relying on page names", () => {
    expect(sprintSlots(sprints)).toEqual({ current: sprints[1], next: sprints[2], last: sprints[0] });
  });

  it("orders the selector and formats concise labels", () => {
    expect(orderedSprints(sprints).map(item => item.id)).toEqual(["current", "next", "last"]);
    expect(sprintLabel(sprints[1], sprints)).toBe("Current｜08/10–08/16");
    expect(sprintLabel(sprints[2], sprints)).toBe("Next｜08/17–08/23");
  });
});

function sprint(id: string, start_date: string, end_date: string, status: Sprint["status"]): Sprint {
  const sprint_window = id === "current" ? "current" : id === "next" ? "next" : "last";
  return { id, project_id: "project", name: id, week_key: id, start_date, end_date, status, sprint_window, goal: null, notion_page_id: id, notion_page_url: null };
}
