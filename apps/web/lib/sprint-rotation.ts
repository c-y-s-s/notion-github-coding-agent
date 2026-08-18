import { createNotionSprint, notionSprintFields, queryNotionDataSource, updateNotionTask } from "./notion";
import { adminDb } from "./supabase";
import type { SprintWindow } from "./types";

type SprintRecord = {
  name: string;
  week_key: string;
  start_date: string;
  end_date: string;
  status: "planned" | "active" | "completed";
  sprint_window: SprintWindow;
  goal: string | null;
  notion_page_id: string;
  notion_page_url: string | null;
};

export function deriveSprintWindows<T extends Pick<SprintRecord, "start_date" | "end_date">>(sprints: T[], today: string) {
  const ordered = [...sprints].sort((left, right) => left.start_date.localeCompare(right.start_date));
  const currentIndex = ordered.findIndex(sprint => sprint.start_date <= today && today <= sprint.end_date);
  const priorIndexes = ordered.map((_, index) => index).filter(index => ordered[index].end_date < today);
  const upcomingIndexes = ordered.map((_, index) => index).filter(index => ordered[index].start_date > today);
  const lastIndex = priorIndexes.at(-1) ?? -1;
  const nextIndex = upcomingIndexes[0] ?? -1;

  return ordered.map((sprint, index) => {
    const sprint_window: SprintWindow = index === currentIndex ? "current" : index === lastIndex ? "last" : index === nextIndex ? "next" : index < (currentIndex === -1 ? nextIndex : currentIndex) ? "past" : "future";
    const status = sprint_window === "current" ? "active" : sprint_window === "last" || sprint_window === "past" ? "completed" : "planned";
    return { ...sprint, sprint_window, status } as T & { sprint_window: SprintWindow; status: SprintRecord["status"] };
  });
}

export function canonicalSprintName(startDate: string, endDate: string) {
  return `Sprint ${startDate.replaceAll("-", "/")}–${endDate.slice(5).replaceAll("-", "/")}`;
}

export async function rotateSprints(today = taipeiDate()) {
  const db = adminDb();
  const { data: projects, error } = await db.from("projects").select("id,notion_sprint_data_source_id").not("notion_sprint_data_source_id", "is", null);
  if (error) throw new Error(`讀取 Sprint 專案失敗：${error.message}`);

  const results = [];
  for (const project of projects ?? []) {
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await db.from("sprint_rotation_locks").delete().eq("project_id", project.id).lt("acquired_at", staleBefore);
    const { error: lockError } = await db.from("sprint_rotation_locks").insert({ project_id: project.id });
    if (lockError?.code === "23505") {
      results.push({ projectId: project.id, skipped: "rotation_in_progress" });
      continue;
    }
    if (lockError) throw new Error(`取得 Sprint 輪替鎖失敗：${lockError.message}`);

    try {
      const dataSourceId = project.notion_sprint_data_source_id as string;
      const pages = await queryNotionDataSource(dataSourceId);
      const records = pages.map(toSprintRecord).filter((record): record is SprintRecord => Boolean(record));
      let created = 0;

      while (records.filter(record => record.start_date > today).length < 2) {
        const dates = nextSprintDates(records, today);
        const page = await createNotionSprint({ dataSourceId, name: canonicalSprintName(dates.startDate, dates.endDate), weekKey: dates.weekKey, startDate: dates.startDate, endDate: dates.endDate });
        const record = toSprintRecord(page);
        if (!record) throw new Error("Notion 建立的 Sprint 缺少日期");
        records.push(record);
        created += 1;
      }

      const rotated = deriveSprintWindows(records, today);
      let updated = 0;
      for (const sprint of rotated) {
        const original = records.find(record => record.notion_page_id === sprint.notion_page_id);
        if (!original) continue;
        const name = canonicalSprintName(sprint.start_date, sprint.end_date);
        if (original.sprint_window !== sprint.sprint_window || original.status !== sprint.status || original.name !== name) {
          await updateNotionTask(sprint.notion_page_id, {
            Name: { title: [{ text: { content: name } }] },
            Status: { select: { name: notionStatus(sprint.status) } },
            Window: { select: { name: notionWindow(sprint.sprint_window) } },
          });
          updated += 1;
        }
        const { error: upsertError } = await db.from("sprints").upsert({ project_id: project.id, ...sprint, name }, { onConflict: "notion_page_id" });
        if (upsertError) throw new Error(`同步 Sprint 到 Supabase 失敗：${upsertError.message}`);
      }
      results.push({ projectId: project.id, total: rotated.length, updated, created });
    } finally {
      await db.from("sprint_rotation_locks").delete().eq("project_id", project.id);
    }
  }
  return { today, projects: results };
}

function toSprintRecord(page: Record<string, any>): SprintRecord | null {
  const fields = notionSprintFields(page);
  if (!fields.start_date || !fields.end_date) return null;
  return { ...fields, notion_page_id: page.id, notion_page_url: page.url ?? null } as SprintRecord;
}

function nextSprintDates(records: SprintRecord[], today: string) {
  const latestEnd = records.map(record => record.end_date).sort().at(-1);
  const start = addDays(latestEnd ?? previousDay(today), 1);
  const end = addDays(start, 6);
  return { startDate: start, endDate: end, weekKey: isoWeekKey(start) };
}

function notionWindow(window: SprintWindow) {
  return ({ future: "Future", next: "Next", current: "Current", last: "Last", past: "Past" } as const)[window];
}

function notionStatus(status: SprintRecord["status"]) {
  return ({ planned: "Planned", active: "Active", completed: "Completed" } as const)[status];
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousDay(value: string) {
  return addDays(value, -1);
}

function isoWeekKey(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function taipeiDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
