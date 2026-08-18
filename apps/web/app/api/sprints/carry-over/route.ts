import { failure, ok } from "@/lib/http";
import { updateNotionTask } from "@/lib/notion";
import { sprintCarryOverSchema } from "@/lib/schemas";
import { carryOverCandidates } from "@/lib/sprint-carry-over";
import { adminDb } from "@/lib/supabase";
import type { WorkItem } from "@/lib/types";

export async function POST(request: Request) {
  const parsed = sprintCarryOverSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("請至少選擇一筆有效任務", 422);

  const db = adminDb();
  const { data: sprints, error: sprintError } = await db.from("sprints").select("id,project_id,end_date,notion_page_id,sprint_window").in("sprint_window", ["current", "last"]);
  if (sprintError) return failure(sprintError.message, 500);
  const current = sprints?.find(sprint => sprint.sprint_window === "current");
  const last = sprints?.find(sprint => sprint.sprint_window === "last" && sprint.project_id === current?.project_id);
  if (!current || !last) return failure("缺少 Current 或 Last Sprint", 409);

  const { data, error } = await db.from("work_items").select("*").in("id", parsed.data.taskIds);
  if (error) return failure(error.message, 500);
  const eligible = carryOverCandidates((data ?? []) as WorkItem[], last.id);
  const updated: string[] = [];
  const failures: Array<{ id: string; error: string }> = [];

  for (const task of eligible) {
    try {
      await updateNotionTask(task.notion_page_id as string, {
        Deadline: { date: { start: current.end_date } },
        Sprint: { relation: [{ id: current.notion_page_id }] },
        "Last Synced At": { date: { start: new Date().toISOString() } },
      });
      const result = await db.from("work_items").update({ deadline: current.end_date, sprint_id: current.id }).eq("id", task.id);
      if (result.error) throw result.error;
      updated.push(task.id);
    } catch (reason) {
      failures.push({ id: task.id, error: reason instanceof Error ? reason.message : "更新失敗" });
    }
  }

  return ok({ updated, skipped: parsed.data.taskIds.filter(id => !eligible.some(task => task.id === id)), failures }, failures.length ? 207 : 200);
}
