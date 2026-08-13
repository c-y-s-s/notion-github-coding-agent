import { adminDb } from "@/lib/supabase";
import { failure, ok } from "@/lib/http";
import { scheduleSyncJobs } from "@/lib/sync-scheduler";
import { processSyncJob } from "@/lib/sync-worker";

const mapping: Record<string, string> = { accept: "accepted", "needs-info": "needs_info", ignore: "ignored" };
export async function POST(_: Request, { params }: { params: Promise<{id:string;action:string}> }) { const { id, action } = await params; const target = mapping[action]; if (!target) return failure("Unknown review action"); const db = adminDb(); const { data, error } = await db.from("work_items").update({ review_status: target }).eq("id", id).eq("review_status", "pending").select().maybeSingle(); if (error) return failure(error.message, 500); if (!data) return failure("Issue was already reviewed", 409); if (action === "accept") { const { data: job, error: jobError } = await db.from("sync_jobs").insert({ work_item_id: id, action: "create_notion_task" }).select("id").single(); if (jobError) { await db.from("work_items").update({review_status:"pending"}).eq("id",id); return failure(jobError.message, 500); } try { await processSyncJob(job.id); } catch { scheduleSyncJobs(); return ok({ ...data, notionSync: "queued" }, 202); } } return ok(data); }
