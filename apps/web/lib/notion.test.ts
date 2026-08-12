import { describe, expect, it } from "vitest";
import { notionPageFields } from "./notion";

describe("notionPageFields", () => {
  it("maps configured Notion properties to a work item", () => {
    expect(notionPageFields({ properties: {
      Name: { type: "title", title: [{ plain_text: "Fix login" }] },
      Type: { type: "select", select: { name: "Bug" } },
      "Planning Status": { type: "status", status: { name: "進行中" } },
      Description: { type: "rich_text", rich_text: [{ plain_text: "Login fails" }] },
      "Acceptance Criteria": { type: "rich_text", rich_text: [{ plain_text: "Test passes" }] },
    } })).toEqual({ title: "Fix login", type: "bug", planning_status: "in_progress", description: "Login fails", acceptance_criteria: "Test passes" });
  });

  it("uses safe defaults for unsupported values", () => {
    expect(notionPageFields({ properties: { Name: { type: "title", title: [] } } })).toEqual({ title: "Untitled", type: "unknown", planning_status: "draft", description: null, acceptance_criteria: null });
  });
});
