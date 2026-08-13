import { describe, expect, it } from "vitest";
import { notionPageFields, notionSprintFields } from "./notion";

describe("notionPageFields", () => {
  it("maps configured Notion properties to a work item", () => {
    expect(notionPageFields({ properties: {
      Name: { type: "title", title: [{ plain_text: "Fix login" }] },
      Type: { type: "select", select: { name: "Bug" } },
      "Planning Status": { type: "status", status: { name: "進行中" } },
      Deadline: { type: "date", date: { start: "2026-08-20" } },
      Sprint: { type: "relation", relation: [{ id: "sprint-page" }] },
      Description: { type: "rich_text", rich_text: [{ plain_text: "Login fails" }] },
      "Acceptance Criteria": { type: "rich_text", rich_text: [{ plain_text: "Test passes" }] },
    } })).toEqual({ title: "Fix login", type: "bug", planning_status: "in_progress", description: "Login fails", acceptance_criteria: "Test passes", deadline: "2026-08-20", sprint_notion_page_id: "sprint-page" });
  });

  it("uses safe defaults for unsupported values", () => {
    expect(notionPageFields({ properties: { Name: { type: "title", title: [] } } })).toEqual({ title: "Untitled", type: "unknown", planning_status: "draft", description: null, acceptance_criteria: null, deadline: null, sprint_notion_page_id: null });
  });

  it("maps a sprint page", () => {
    expect(notionSprintFields({ properties: {
      Name: { type: "title", title: [{ plain_text: "Sprint 2026-W33" }] },
      "Week Key": { rich_text: [{ plain_text: "2026-W33" }] },
      "Start Date": { date: { start: "2026-08-10" } },
      "End Date": { date: { start: "2026-08-16" } },
      Status: { select: { name: "Active" } },
      Goal: { rich_text: [{ plain_text: "Ship sprint board" }] },
    } })).toEqual({ name: "Sprint 2026-W33", week_key: "2026-W33", start_date: "2026-08-10", end_date: "2026-08-16", status: "active", goal: "Ship sprint board" });
  });
});
