import { describe, expect, it } from "vitest";
import { carryOverCandidates } from "./sprint-carry-over";
import type { WorkItem } from "./types";

let sequence = 0;
const task = (overrides: Partial<WorkItem>): WorkItem => ({
  id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`, source: "notion", type: "bug", title: "任務", description: null,
  acceptance_criteria: null, review_status: "not_required", planning_status: "ready", agent_status: "idle",
  deadline: "2026-08-15", sprint_id: "last", github_issue_number: null, github_issue_url: null,
  notion_page_id: `10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`, notion_page_url: "https://notion.so/task", updated_at: "2026-08-18T00:00:00Z",
  ...overrides,
});

describe("carryOverCandidates", () => {
  it("只選取 Last Sprint 中可執行或進行中的 Notion 任務", () => {
    const eligible = task({ title: "可延續" });
    const running = task({ title: "進行中", planning_status: "in_progress" });
    const tasks = [
      eligible,
      running,
      task({ planning_status: "blocked" }),
      task({ planning_status: "done" }),
      task({ agent_status: "failed" }),
      task({ sprint_id: null }),
      task({ source: "github", notion_page_id: null, notion_page_url: null }),
    ];
    expect(carryOverCandidates(tasks, "last").map(item => item.title)).toEqual(["可延續", "進行中"]);
  });
});
