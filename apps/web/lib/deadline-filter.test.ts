import { describe, expect, it } from "vitest";
import { matchesDeadlineFilter } from "./deadline-filter";
import type { WorkItem } from "./types";

const base = { range: "this_week", sprintId: "all", currentSprintId: "current", customStart: "2026-08-10", customEnd: "2026-08-16", today: "2026-08-13" } as const;

describe("deadline workspace filter", () => {
  it("shows an unscheduled Current Sprint task when 本週 is selected", () => {
    expect(matchesDeadlineFilter(task({ sprint_id: "current", deadline: null }), base)).toBe(true);
  });

  it("does not show unscheduled backlog or Next Sprint tasks in 本週", () => {
    expect(matchesDeadlineFilter(task({ sprint_id: null, deadline: null }), base)).toBe(false);
    expect(matchesDeadlineFilter(task({ sprint_id: "next", deadline: null }), base)).toBe(false);
  });
});

function task(fields: Partial<WorkItem>): WorkItem {
  return { id: "task", source: "notion", type: "bug", title: "Task", description: null, acceptance_criteria: null, review_status: "not_required", planning_status: "ready", agent_status: "idle", deadline: null, sprint_id: null, github_issue_number: null, github_issue_url: null, notion_page_url: "https://notion.so/task", updated_at: "2026-08-13T00:00:00Z", ...fields };
}
