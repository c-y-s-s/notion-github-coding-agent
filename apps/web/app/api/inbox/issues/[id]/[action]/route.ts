import { adminDb } from "@/lib/supabase";
import { failure, ok } from "@/lib/http";

const mapping: Record<string, string> = { accept: "accepted", "needs-info": "needs_info", ignore: "ignored" };
export async function POST(_: Request, { params }: { params: Promise<{id:string;action:string}> }) { const { id, action } = await params; const target = mapping[action]; if (!target) return failure("Unknown review action"); const db = adminDb(); const { data, error } = await db.from("work_items").update({ review_status: target }).eq("id", id).eq("review_status", "pending").select().maybeSingle(); if (error) return failure(error.message, 500); if (!data) return failure("Issue was already reviewed", 409); if (action === "accept") await db.from("sync_jobs").insert({ work_item_id: id, action: "create_notion_task" }); return ok(data); }

