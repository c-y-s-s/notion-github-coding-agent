import type { Sprint } from "./types";

export function sprintSlots(sprints: Sprint[]) {
  const ordered = [...sprints].sort((left, right) => left.start_date.localeCompare(right.start_date));
  const current = ordered.find(sprint => sprint.status === "active") ?? null;
  if (!current) return { current: null, next: null, last: null };
  const index = ordered.findIndex(sprint => sprint.id === current.id);
  return { current, last: ordered[index - 1] ?? null, next: ordered[index + 1] ?? null };
}

export function orderedSprints(sprints: Sprint[]) {
  const slots = sprintSlots(sprints);
  const highlighted = [slots.current, slots.next, slots.last].filter((sprint): sprint is Sprint => Boolean(sprint));
  const highlightedIds = new Set(highlighted.map(sprint => sprint.id));
  const history = [...sprints].filter(sprint => !highlightedIds.has(sprint.id)).sort((left, right) => right.start_date.localeCompare(left.start_date));
  return [...highlighted, ...history];
}

export function sprintLabel(sprint: Sprint, sprints: Sprint[]) {
  const slots = sprintSlots(sprints);
  const prefix = sprint.id === slots.current?.id ? "Current" : sprint.id === slots.next?.id ? "Next" : sprint.id === slots.last?.id ? "Last" : "";
  const range = `${shortDate(sprint.start_date)}–${shortDate(sprint.end_date)}`;
  return prefix ? `${prefix}｜${range}` : range;
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
}
