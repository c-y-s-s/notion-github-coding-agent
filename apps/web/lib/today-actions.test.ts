import { describe, expect, it } from "vitest";
import { buildTodayActions } from "./today-actions";
import type { AgentRun, WorkItem } from "./types";

const task = (overrides: Partial<WorkItem>): WorkItem => ({ id: "task-1", source: "notion", type: "bug", title: "修正狀態", description: null, acceptance_criteria: null, review_status: "not_required", planning_status: "ready", agent_status: "idle", deadline: null, sprint_id: null, github_issue_number: null, github_issue_url: null, notion_page_url: null, updated_at: "2026-08-14T00:00:00Z", ...overrides });
const run = (overrides: Partial<AgentRun>): AgentRun => ({ id: "run-1", work_item_id: "task-1", status: "failed", risk_level: "low", branch_name: null, started_at: null, finished_at: null, ...overrides });

describe("buildTodayActions", () => {
  it("prioritizes overdue work and removes a lower-priority action for the same task", () => {
    const result = buildTodayActions({ tasks: [task({ deadline: "2026-08-12" }), task({ id: "issue-1", title: "外部問題", review_status: "pending" })], runs: [run({ status: "awaiting_approval" })], failedJobs: [], failedEvents: [], today: "2026-08-14" });
    expect(result.map(item => item.kicker)).toEqual(["已逾期 2 天", "GitHub Issue 待審核"]);
  });

  it("uses only the latest run for each task", () => {
    const result = buildTodayActions({ tasks: [task({})], runs: [run({ id: "new", status: "succeeded" }), run({ id: "old", status: "failed" })], failedJobs: [], failedEvents: [], today: "2026-08-14" });
    expect(result).toHaveLength(0);
  });

  it("does not surface ignored or completed work", () => {
    const result = buildTodayActions({ tasks: [task({ review_status: "ignored", deadline: "2026-08-10" }), task({ id: "done", planning_status: "done", deadline: "2026-08-14" })], runs: [], failedJobs: [], failedEvents: [], today: "2026-08-14" });
    expect(result).toHaveLength(0);
  });

  it("shows only the highest-priority action for the same task", () => {
    const result = buildTodayActions({
      tasks: [task({ deadline: "2026-08-12" })],
      runs: [run({ status: "awaiting_approval" })],
      failedJobs: [],
      failedEvents: [],
      today: "2026-08-14",
    });

    expect(result).toHaveLength(1);
    expect(result[0].kicker).toBe("已逾期 2 天");
  });
});
