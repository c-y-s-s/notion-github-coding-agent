import { failure, ok } from "@/lib/http";
import { findNotionSprintAlias, updateNotionTask } from "@/lib/notion";
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
  const { data: task, error } = await db.from("work_items").select("id,project_id,planning_status,deadline,sprint_id,notion_page_id,notion_page_url").eq("id", id).maybeSingle();
  if (error) return failure(error.message, 500);
  if (!task) return failure("找不到任務", 404);
  if (task.notion_page_id && !task.notion_page_url) return failure("原始 Notion Task 已刪除，無法更新", 409);
  let sprintPageId: string | null = null;
  let sprintAliasPageId: string | null = null;
  if (parsed.data.sprintId) {
    const [{ data: sprint }, { data: sprints }, { data: project }] = await Promise.all([
      db.from("sprints").select("id,notion_page_id").eq("id", parsed.data.sprintId).eq("project_id", task.project_id).maybeSingle(),
      db.from("sprints").select("id,start_date,status").eq("project_id", task.project_id).order("start_date"),
      db.from("projects").select("notion_sprint_data_source_id").eq("id", task.project_id).maybeSingle(),
    ]);
    if (!sprint) return failure("找不到這個 Sprint", 404);
    sprintPageId = sprint.notion_page_id;
    const currentIndex = (sprints ?? []).findIndex(item => item.status === "active");
    const selectedIndex = (sprints ?? []).findIndex(item => item.id === sprint.id);
    const alias = selectedIndex === currentIndex ? "current" : selectedIndex === currentIndex - 1 ? "last" : selectedIndex === currentIndex + 1 ? "next" : null;
    if (alias && project?.notion_sprint_data_source_id) sprintAliasPageId = await findNotionSprintAlias(project.notion_sprint_data_source_id, alias);
  }
  const next = { planning_status: parsed.data.planningStatus, deadline: parsed.data.deadline, sprint_id: parsed.data.sprintId };
  const updated = await db.from("work_items").update(next).eq("id", id);
  if (updated.error) return failure(updated.error.message, 500);
  try {
    if (task.notion_page_id) {
      await updateNotionTask(task.notion_page_id, {
        "Planning Status": { status: { name: notionStatuses[parsed.data.planningStatus] } },
        Deadline: parsed.data.deadline ? { date: { start: parsed.data.deadline } } : { date: null },
        Sprint: { relation: [sprintPageId, sprintAliasPageId].filter(Boolean).map(id => ({ id })) },
        "Last Synced At": { date: { start: new Date().toISOString() } },
      });
    }
  } catch (reason) {
    await db.from("work_items").update({ planning_status: task.planning_status, deadline: task.deadline, sprint_id: task.sprint_id }).eq("id", id);
    return failure(reason instanceof Error ? reason.message : "Notion 回寫失敗", 502);
  }
  return ok({ id, ...next });
}
