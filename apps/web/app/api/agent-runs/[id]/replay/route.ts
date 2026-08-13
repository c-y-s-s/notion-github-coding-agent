import { z } from "zod";
import { failure, ok } from "@/lib/http";
import { adminDb } from "@/lib/supabase";

const bodySchema = z.object({ mode: z.enum(["exact", "latest"]), prompt_version: z.enum(["v1", "v2"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return failure("Replay 參數不正確", 422);
  const db = adminDb();
  const { data: source } = await db.from("agent_runs").select("*").eq("id", id).maybeSingle();
  if (!source) return failure("找不到原始 Run", 404);
  if (["queued", "running", "awaiting_approval", "approved", "pushing"].includes(source.status)) return failure("原始 Run 尚未結束", 409);
  if (parsed.data.mode === "exact" && (!source.base_commit_sha || !source.task_snapshot || !source.context_manifest)) return failure("此舊 Run 沒有完整快照，無法 Exact Replay；請使用 Latest Main。", 409);
  const { data: active } = await db.from("agent_runs").select("id").eq("work_item_id", source.work_item_id).in("status", ["queued", "running", "awaiting_approval", "approved", "pushing"]).maybeSingle();
  if (active) return failure("此任務已有進行中的 Run", 409);
  const { data: task } = await db.from("work_items").select("*").eq("id", source.work_item_id).single();
  const { data, error } = await db.from("agent_runs").insert({
    work_item_id: source.work_item_id,
    repository_id: source.repository_id,
    status: "queued",
    model: source.model,
    prompt_version: parsed.data.prompt_version,
    parent_run_id: source.id,
    replay_mode: parsed.data.mode,
    task_snapshot: parsed.data.mode === "exact" ? source.task_snapshot : task,
    base_commit_sha: parsed.data.mode === "exact" ? source.base_commit_sha : null,
    context_manifest: parsed.data.mode === "exact" ? source.context_manifest : null,
  }).select().single();
  if (error) return failure(error.message, 500);
  await db.from("work_items").update({ agent_status: "queued" }).eq("id", source.work_item_id);
  return ok(data, 202);
}
