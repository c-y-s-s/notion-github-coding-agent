import { failure, ok } from "@/lib/http";
import { adminDb } from "@/lib/supabase";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = adminDb();
  const { data: task } = await db.from("work_items").select("*").eq("id", id).maybeSingle();
  if (!task) return failure("找不到任務", 404);
  if (task.notion_page_id && !task.notion_page_url) return failure("原始 Notion Task 已刪除，不能啟動 Agent", 409);
  if (task.type !== "bug") return failure(task.source === "github" ? "第一版只分析 Bug；請先在 GitHub Issue 加上 bug label，等待同步後再試。" : "第一版只有 Bug 任務可以產生修正", 422);
  if (["pending", "needs_info", "ignored"].includes(task.review_status)) return failure("此任務尚未通過人工審核", 409);
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  if (model.startsWith("ollama:")) return failure("本地模型目前只允許 Evaluation，不能產生正式任務 Patch", 422);
  const { data: active } = await db.from("agent_runs").select("id").eq("work_item_id", id).in("status", ["queued", "running", "awaiting_approval", "approved", "pushing"]).maybeSingle();
  if (active) return failure("此任務已有進行中的執行紀錄", 409);
  const { data, error } = await db.from("agent_runs").insert({ work_item_id: id, repository_id: task.repository_id, status: "queued", model, prompt_version: "v1", task_snapshot: task }).select().single();
  if (error) return failure(error.message, 500);
  await db.from("work_items").update({ agent_status: "queued" }).eq("id", id);
  return ok(data, 202);
}
