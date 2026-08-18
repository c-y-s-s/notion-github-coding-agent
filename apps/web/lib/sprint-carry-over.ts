import type { WorkItem } from "./types";

export function carryOverCandidates(tasks: WorkItem[], lastSprintId?: string | null) {
  if (!lastSprintId) return [];
  return tasks.filter(task =>
    task.sprint_id === lastSprintId &&
    task.source === "notion" &&
    Boolean(task.notion_page_id && task.notion_page_url) &&
    ["ready", "in_progress"].includes(task.planning_status) &&
    task.agent_status !== "failed"
  );
}
