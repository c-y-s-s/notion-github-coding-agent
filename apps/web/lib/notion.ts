import { createHmac, timingSafeEqual } from "node:crypto";

type NotionProperty = Record<string, any>;

function plainText(parts: Array<{ plain_text?: string }> | undefined) {
  return parts?.map(part => part.plain_text ?? "").join("") || null;
}

export function notionPageFields(page: Record<string, any>) {
  const properties = (page.properties ?? {}) as Record<string, NotionProperty>;
  const titleProperty = Object.values(properties).find(property => property.type === "title");
  const typeName = properties.Type?.select?.name?.toLowerCase();
  const rawPlanningName = properties["Planning Status"]?.status?.name;
  const allowedTypes = new Set(["bug", "feature", "chore"]);
  const planningAliases: Record<string, string> = { Draft: "draft", Ready: "ready", "In Progress": "in_progress", Blocked: "blocked", Done: "done", "草稿": "draft", "可執行": "ready", "進行中": "in_progress", "受阻": "blocked", "已完成": "done" };
  return {
    title: plainText(titleProperty?.title) ?? "Untitled",
    type: allowedTypes.has(typeName) ? typeName : "unknown",
    description: plainText(properties.Description?.rich_text),
    acceptance_criteria: plainText(properties["Acceptance Criteria"]?.rich_text),
    planning_status: planningAliases[rawPlanningName] ?? "draft",
    deadline: properties.Deadline?.date?.start?.slice(0, 10) ?? null,
    sprint_notion_page_id: properties.Sprint?.relation?.[0]?.id ?? null,
  };
}

export function notionSprintFields(page: Record<string, any>) {
  const properties = (page.properties ?? {}) as Record<string, NotionProperty>;
  const titleProperty = Object.values(properties).find(property => property.type === "title");
  const statusName = properties.Status?.select?.name?.toLowerCase();
  const statuses = new Set(["planned", "active", "completed"]);
  return {
    name: plainText(titleProperty?.title) ?? "Untitled Sprint",
    week_key: plainText(properties["Week Key"]?.rich_text) ?? "unknown",
    start_date: properties["Start Date"]?.date?.start?.slice(0, 10),
    end_date: properties["End Date"]?.date?.start?.slice(0, 10),
    status: statuses.has(statusName) ? statusName : "planned",
    goal: plainText(properties.Goal?.rich_text),
  };
}

export function readyTaskDefaults(
  fields: { planning_status: string; deadline: string | null; sprint_notion_page_id: string | null },
  activeSprint: { notion_page_id: string; end_date: string } | null,
) {
  if (fields.planning_status !== "ready" || !activeSprint) return { deadline: fields.deadline, sprint_notion_page_id: fields.sprint_notion_page_id, notionProperties: {} };
  const deadline = fields.deadline ?? activeSprint.end_date;
  const sprintPageId = fields.sprint_notion_page_id ?? activeSprint.notion_page_id;
  return {
    deadline,
    sprint_notion_page_id: sprintPageId,
    notionProperties: {
      ...(!fields.deadline ? { Deadline: { date: { start: deadline } } } : {}),
      ...(!fields.sprint_notion_page_id ? { Sprint: { relation: [{ id: sprintPageId }] } } : {}),
    },
  };
}
export function verifyNotionSignature(raw: string, signature: string | null, secret = process.env.NOTION_WEBHOOK_SECRET) {
  if (!secret || !signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function retrieveNotionPage(pageId: string) {
  if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN is not configured");
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": "2025-09-03" } });
  if (!response.ok) throw new Error(`Notion API failed: ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}
export async function createNotionTask(input: { dataSourceId: string; title: string; source: string; githubIssueUrl?: string | null; deadline?: string | null }) {
  if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN is not configured");
  const response = await fetch("https://api.notion.com/v1/pages", { method:"POST", headers:{ Authorization:`Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version":"2025-09-03", "Content-Type":"application/json" }, body:JSON.stringify({ parent:{type:"data_source_id",data_source_id:input.dataSourceId}, properties:{ Name:{title:[{text:{content:input.title}}]}, Source:{select:{name:input.source}}, ...(input.githubIssueUrl ? {"GitHub Issue URL":{url:input.githubIssueUrl}} : {}), ...(input.deadline ? {Deadline:{date:{start:input.deadline}}} : {}) } }) });
  if(!response.ok) throw new Error(`Notion create page failed: ${response.status} ${await response.text()}`); return response.json() as Promise<{id:string;url:string}>;
}
export async function updateNotionTask(pageId:string, properties:Record<string,unknown>) { if(!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN is not configured"); const response=await fetch(`https://api.notion.com/v1/pages/${pageId}`,{method:"PATCH",headers:{Authorization:`Bearer ${process.env.NOTION_TOKEN}`,"Notion-Version":"2025-09-03","Content-Type":"application/json"},body:JSON.stringify({properties})});if(!response.ok)throw new Error(`Notion update failed: ${response.status}`);return response.json(); }
