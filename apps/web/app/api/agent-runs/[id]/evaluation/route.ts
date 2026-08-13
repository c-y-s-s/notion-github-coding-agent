import { z } from "zod";
import { failure, ok } from "@/lib/http";
import { adminDb } from "@/lib/supabase";

const schema = z.object({
  analysis_correct: z.boolean(),
  patch_usable: z.boolean().nullable(),
  failure_category: z.enum(["wrong_analysis", "missing_context", "bad_patch", "checks_failed", "unsafe_scope", "other"]).nullable(),
  notes: z.string().trim().max(1000).nullable(),
}).superRefine((value, context) => {
  if (value.patch_usable === true && !value.analysis_correct) context.addIssue({ code: "custom", message: "分析不正確時，Patch 不能標記為可用" });
  if ((!value.analysis_correct || value.patch_usable === false) && !value.failure_category) context.addIssue({ code: "custom", message: "請選擇主要問題" });
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "評估資料不正確", 422);
  const db = adminDb();
  const { data: run } = await db.from("agent_runs").select("id,status").eq("id", id).maybeSingle();
  if (!run) return failure("找不到執行紀錄", 404);
  if (["queued", "running", "approved", "pushing"].includes(run.status)) return failure("Agent 尚未完成，現在不能評估", 409);
  const { data, error } = await db.from("agent_evaluations").upsert({ agent_run_id: id, ...parsed.data }, { onConflict: "agent_run_id" }).select().single();
  if (error) return failure(error.message, 500);
  return ok(data);
}
