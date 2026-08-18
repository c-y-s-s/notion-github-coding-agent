import { failure, ok } from "@/lib/http";
import { updateNotionTask } from "@/lib/notion";
import { notionPlanningProperties } from "@/lib/notion-task-sync";
import { adminDb } from "@/lib/supabase";
import type { WorkItem } from "@/lib/types";

export async function POST() {
  const db = adminDb();
  const { data: current, error: sprintError } = await db
    .from("sprints")
    .select("id,notion_page_id")
    .eq("sprint_window", "current")
    .maybeSingle();
  if (sprintError) return failure(sprintError.message, 500);
  if (!current?.notion_page_id) return failure("找不到 Current Sprint 的 Notion 頁面", 409);

  const { data, error } = await db
    .from("work_items")
    .select("id,title,planning_status,deadline,notion_page_id,notion_page_url")
    .eq("source", "notion")
    .eq("sprint_id", current.id);
  if (error) return failure(error.message, 500);

  const tasks = (data ?? []) as Array<Pick<WorkItem, "id" | "title" | "planning_status" | "deadline" | "notion_page_id" | "notion_page_url">>;
  const updated: string[] = [];
  const skipped: Array<{ id: string; title: string; reason: string }> = [];
  const failures: Array<{ id: string; title: string; error: string }> = [];

  for (const task of tasks) {
    if (!task.notion_page_id || !task.notion_page_url) {
      skipped.push({ id: task.id, title: task.title, reason: "缺少可用的 Notion 頁面" });
      continue;
    }
    try {
      await updateNotionTask(
        task.notion_page_id,
        notionPlanningProperties(task, current.notion_page_id),
      );
      updated.push(task.id);
    } catch (reason) {
      failures.push({
        id: task.id,
        title: task.title,
        error: reason instanceof Error ? reason.message : "Notion 回寫失敗",
      });
    }
  }

  return ok(
    { updated, skipped, failures },
    failures.length ? 207 : 200,
  );
}
