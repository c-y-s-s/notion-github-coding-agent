import { failure, ok } from "@/lib/http";
import { scheduleSyncJobs } from "@/lib/sync-scheduler";
import { adminDb } from "@/lib/supabase";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await adminDb()
    .from("sync_jobs")
    .update({ status: "queued", attempt_count: 0, last_error: null, available_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "failed")
    .select("id")
    .maybeSingle();
  if (error) return failure(error.message, 500);
  if (!data) return failure("只有失敗的同步工作可以重新執行", 409);
  scheduleSyncJobs();
  return ok({ queued: true });
}
