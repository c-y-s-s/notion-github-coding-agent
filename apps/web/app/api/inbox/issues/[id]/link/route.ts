import { linkSchema } from "@/lib/schemas";
import { adminDb } from "@/lib/supabase";
import { failure, ok } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{id:string}> }) {
  const parsed = linkSchema.safeParse(await request.json());
  if (!parsed.success) return failure(parsed.error.message);
  const { id } = await params;
  const db = adminDb();
  const { data: notionTask } = await db.from("work_items").select("id,notion_page_id").eq("notion_page_id", parsed.data.notionPageId).eq("source", "notion").maybeSingle();
  if (!notionTask) return failure("找不到 Notion 任務", 404);
  const { data: issue } = await db.from("work_items").select("*").eq("id", id).eq("review_status", "pending").maybeSingle();
  if (!issue) return failure("Issue 已經審核過", 409);

  const identity = {
    github_issue_node_id: issue.github_issue_node_id,
    github_issue_number: issue.github_issue_number,
    github_issue_url: issue.github_issue_url,
    github_issue_state: issue.github_issue_state,
  };
  const release = await db.from("work_items").update({ github_issue_node_id: null, github_issue_number: null, github_issue_url: null, github_issue_state: null }).eq("id", issue.id).eq("review_status", "pending");
  if (release.error) return failure("暫時無法釋放 GitHub Issue 關聯", 409);
  const linked = await db.from("work_items").update({ ...identity, review_status: "linked" }).eq("id", notionTask.id);
  if (linked.error) {
    await db.from("work_items").update(identity).eq("id", issue.id);
    return failure(`連結 Notion 任務失敗：${linked.error.message}`, 409);
  }
  const removed = await db.from("work_items").delete().eq("id", issue.id);
  if (removed.error) return failure(`清理 Inbox Issue 失敗：${removed.error.message}`, 500);
  return ok({ linkedTo: notionTask.id });
}
