import { failure, ok } from "@/lib/http";
import { updateNotionTask } from "@/lib/notion";
import { taskPlanningSchema } from "@/lib/schemas";
import { adminDb } from "@/lib/supabase";

const notionStatuses = {
  draft: "草稿",
  ready: "可執行",
  in_progress: "進行中",
  blocked: "受阻",
  done: "已完成",
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = taskPlanningSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("日期或任務狀態格式不正確", 422);
  const { id } = await params;
  const db = adminDb();
  const { data: task, error } = await db.from("work_items").select("id,planning_status,deadline,notion_page_id,notion_page_url").eq("id", id).maybeSingle();
  if (error) return failure(error.message, 500);
  if (!task) return failure("找不到任務", 404);
  if (task.notion_page_id && !task.notion_page_url) return failure("原始 Notion Task 已刪除，無法更新", 409);
  const next = { planning_status: parsed.data.planningStatus, deadline: parsed.data.deadline };
  const updated = await db.from("work_items").update(next).eq("id", id);
  if (updated.error) return failure(updated.error.message, 500);
  try {
    if (task.notion_page_id) {
      await updateNotionTask(task.notion_page_id, {
        "Planning Status": { status: { name: notionStatuses[parsed.data.planningStatus] } },
        Deadline: parsed.data.deadline ? { date: { start: parsed.data.deadline } } : { date: null },
        "Last Synced At": { date: { start: new Date().toISOString() } },
      });
    }
  } catch (reason) {
    await db.from("work_items").update({ planning_status: task.planning_status, deadline: task.deadline }).eq("id", id);
    return failure(reason instanceof Error ? reason.message : "Notion 回寫失敗", 502);
  }
  return ok({ id, ...next });
}
