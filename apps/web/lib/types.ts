export type WorkItem = {
  id: string; source: "notion" | "github"; type: "bug" | "feature" | "chore" | "unknown";
  title: string; description: string | null; acceptance_criteria: string | null;
  review_status: "not_required" | "pending" | "accepted" | "linked" | "needs_info" | "ignored";
  planning_status: "draft" | "ready" | "in_progress" | "blocked" | "done";
  agent_status: "idle" | "queued" | "preparing" | "awaiting_approval" | "rejected" | "pushing" | "branch_ready" | "failed";
  github_issue_number: number | null; github_issue_url: string | null; notion_page_url: string | null; updated_at: string;
};

export type AgentRun = { id: string; work_item_id: string; status: string; risk_level: string | null; branch_name: string | null; started_at: string | null; finished_at: string | null };
