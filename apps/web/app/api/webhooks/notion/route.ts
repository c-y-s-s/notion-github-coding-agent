import { notionPageFields, verifyNotionSignature, retrieveNotionPage } from "@/lib/notion";
import { adminDb } from "@/lib/supabase";
import { failure, ok } from "@/lib/http";

export async function POST(request: Request) {
  const raw = await request.text(); const body = JSON.parse(raw) as any;
  if (body.verification_token) return ok({ verification_token: body.verification_token });
  if (!verifyNotionSignature(raw, request.headers.get("x-notion-signature"))) return failure("Invalid Notion signature", 401);
  const eventId = body.id; const pageId = body.entity?.id;
  if (!eventId || !pageId) return failure("Unsupported Notion event");
  const db = adminDb(); const { error } = await db.from("sync_events").insert({ provider: "notion", provider_event_id: eventId, event_type: body.type, payload: body });
  if (error?.code === "23505") return ok({ duplicate: true }); if (error) return failure(error.message, 500);
  if (body.entity?.type !== "page") {
    await db.from("sync_events").update({ status: "completed", processed_at: new Date().toISOString() }).eq("provider", "notion").eq("provider_event_id", eventId);
    return ok({ accepted: true, ignored: true }, 202);
  }
  try {
    const page: any = await retrieveNotionPage(pageId);
    const { data: project } = await db.from("projects").select("id,default_repository_id").eq("notion_data_source_id", page.parent?.data_source_id ?? page.parent?.database_id).maybeSingle();
    if (project) { const fields = notionPageFields(page); await db.from("work_items").upsert({ project_id: project.id, repository_id: project.default_repository_id, source: "notion", ...fields, notion_page_id: page.id, notion_page_url: page.url, review_status: "not_required" }, { onConflict: "notion_page_id" }); }
    await db.from("sync_events").update({ status: "completed", processed_at: new Date().toISOString() }).eq("provider", "notion").eq("provider_event_id", eventId); return ok({ accepted: true }, 202);
  } catch (e) { await db.from("sync_events").update({ status: "failed", last_error: String(e) }).eq("provider", "notion").eq("provider_event_id", eventId); return failure("Webhook processing failed", 500); }
}
