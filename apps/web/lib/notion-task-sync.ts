import type { WorkItem } from "./types";

const notionStatuses: Record<WorkItem["planning_status"], string> = {
  draft: "草稿",
  ready: "可執行",
  in_progress: "進行中",
  blocked: "受阻",
  done: "已完成",
};

export function notionPlanningProperties(
  task: Pick<WorkItem, "planning_status" | "deadline">,
  sprintNotionPageId: string,
) {
  return {
    "Planning Status": { status: { name: notionStatuses[task.planning_status] } },
    Deadline: task.deadline ? { date: { start: task.deadline } } : { date: null },
    Sprint: { relation: [{ id: sprintNotionPageId }] },
    "Last Synced At": { date: { start: new Date().toISOString() } },
  };
}
