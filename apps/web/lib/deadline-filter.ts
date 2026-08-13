import type { WorkItem } from "./types";

export type DeadlineRange = "overdue" | "this_week" | "last_week" | "next_week" | "custom" | "all";

export function matchesDeadlineFilter(task: WorkItem, input: { range: DeadlineRange; sprintId: string; currentSprintId?: string; customStart: string; customEnd: string; today: string }) {
  if (input.sprintId !== "all" && (input.sprintId === "backlog" ? task.sprint_id : task.sprint_id !== input.sprintId)) return false;
  if (input.range === "all") return true;
  if (!task.deadline) return input.range === "this_week" && task.sprint_id === input.currentSprintId;
  if (input.range === "overdue") return task.deadline < input.today;
  const weekStart = startOfWeek(parseDate(input.today));
  const offsets = { last_week: [-7, -1], this_week: [0, 6], next_week: [7, 13] } as const;
  const [from, to] = input.range === "custom" ? [input.customStart, input.customEnd] : [isoDate(addDays(weekStart, offsets[input.range][0])), isoDate(addDays(weekStart, offsets[input.range][1]))];
  return task.deadline >= from && task.deadline <= to;
}

function startOfWeek(date: Date) { const copy = new Date(date); const day = copy.getDay() || 7; copy.setHours(12, 0, 0, 0); copy.setDate(copy.getDate() - day + 1); return copy; }
function addDays(date: Date, days: number) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function parseDate(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day, 12); }
