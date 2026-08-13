import { notionPageFields, notionSprintFields, readyTaskDefaults, retrieveNotionPage, updateNotionTask, verifyNotionSignature } from "@/lib/notion";
import { adminDb } from "@/lib/supabase";
import { failure, ok } from "@/lib/http";

export async function POST(request: Request) {
  const raw = await request.text();
  const body = JSON.parse(raw) as any;
  if (body.verification_token) return ok({ verification_token: body.verification_token });
  if (!verifyNotionSignature(raw, request.headers.get("x-notion-signature"))) return failure("Invalid Notion signature", 401);
  const eventId = body.id;
  const pageId = body.entity?.id;
  if (!eventId || !pageId) return failure("Unsupported Notion event");
  const db = adminDb();
  const { error } = await db.from("sync_events").insert({ provider: "notion", provider_event_id: eventId, event_type: body.type, payload: body });
  if (error?.code === "23505") return ok({ duplicate: true });
  if (error) return failure(error.message, 500);
  if (body.type === "page.deleted") {
    await Promise.all([
      db.from("work_items").update({ notion_page_url: null, planning_status: "blocked", agent_status: "idle" }).eq("notion_page_id", pageId),
      db.from("sprints").update({ notion_page_url: null }).eq("notion_page_id", pageId),
    ]);
    await completeEvent(db, eventId);
    return ok({ accepted: true, deleted: true }, 202);
  }
  if (body.entity?.type !== "page") {
    await completeEvent(db, eventId);
    return ok({ accepted: true, ignored: true }, 202);
  }
  try {
    const page: any = await retrieveNotionPage(pageId);
    const dataSourceId = page.parent?.data_source_id ?? page.parent?.database_id;
    const { data: sprintProject } = await db.from("projects").select("id").eq("notion_sprint_data_source_id", dataSourceId).maybeSingle();
    if (sprintProject) {
      const fields = notionSprintFields(page);
      if (!fields.start_date || !fields.end_date) throw new Error("Sprint must have Start Date and End Date");
      await db.from("sprints").upsert({ project_id: sprintProject.id, ...fields, notion_page_id: page.id, notion_page_url: page.url }, { onConflict: "notion_page_id" });
    } else {
      const { data: project } = await db.from("projects").select("id,default_repository_id").eq("notion_data_source_id", dataSourceId).maybeSingle();
      if (project) {
        const parsedFields = notionPageFields(page);
        const { data: activeSprint } = parsedFields.planning_status === "ready" && (!parsedFields.sprint_notion_page_id || !parsedFields.deadline)
          ? await db.from("sprints").select("id,notion_page_id,end_date").eq("project_id", project.id).eq("status", "active").limit(1).maybeSingle()
          : { data: null };
        const defaults = readyTaskDefaults(parsedFields, activeSprint);
        if (Object.keys(defaults.notionProperties).length) {
          await updateNotionTask(page.id, { ...defaults.notionProperties, "Last Synced At": { date: { start: new Date().toISOString() } } });
        }
        const { sprint_notion_page_id, ...fields } = { ...parsedFields, deadline: defaults.deadline, sprint_notion_page_id: defaults.sprint_notion_page_id };
        let sprintId: string | null = null;
        if (activeSprint && sprint_notion_page_id === activeSprint.notion_page_id) {
          sprintId = activeSprint.id;
        } else if (sprint_notion_page_id) {
          const { data: sprint } = await db.from("sprints").select("id").eq("notion_page_id", sprint_notion_page_id).maybeSingle();
          sprintId = sprint?.id ?? null;
        }
        await db.from("work_items").upsert({ project_id: project.id, repository_id: project.default_repository_id, source: "notion", ...fields, sprint_id: sprintId, notion_page_id: page.id, notion_page_url: page.url, review_status: "not_required" }, { onConflict: "notion_page_id" });
      }
    }
    await completeEvent(db, eventId);
    return ok({ accepted: true }, 202);
  } catch (reason) {
    await db.from("sync_events").update({ status: "failed", last_error: String(reason) }).eq("provider", "notion").eq("provider_event_id", eventId);
    return failure("Webhook processing failed", 500);
  }
}

async function completeEvent(db: ReturnType<typeof adminDb>, eventId: string) {
  await db.from("sync_events").update({ status: "completed", processed_at: new Date().toISOString() }).eq("provider", "notion").eq("provider_event_id", eventId);
}
