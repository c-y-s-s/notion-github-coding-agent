import { createHmac, timingSafeEqual } from "node:crypto";

type NotionProperty = Record<string, any>;

function plainText(parts: Array<{ plain_text?: string }> | undefined) {
  return parts?.map(part => part.plain_text ?? "").join("") || null;
}

export function notionPageFields(page: Record<string, any>) {
  const properties = (page.properties ?? {}) as Record<string, NotionProperty>;
  const titleProperty = Object.values(properties).find(property => property.type === "title");
  const typeName = properties.Type?.select?.name?.toLowerCase();
  const planningName = properties["Planning Status"]?.status?.name?.toLowerCase().replaceAll(" ", "_");
  const allowedTypes = new Set(["bug", "feature", "chore"]);
  const allowedPlanning = new Set(["draft", "ready", "in_progress", "blocked", "done"]);
  return {
    title: plainText(titleProperty?.title) ?? "Untitled",
    type: allowedTypes.has(typeName) ? typeName : "unknown",
    description: plainText(properties.Description?.rich_text),
    acceptance_criteria: plainText(properties["Acceptance Criteria"]?.rich_text),
    planning_status: allowedPlanning.has(planningName) ? planningName : "draft",
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
export async function createNotionTask(input: { dataSourceId: string; title: string; source: string; githubIssueUrl?: string | null }) {
  if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN is not configured");
  const response = await fetch("https://api.notion.com/v1/pages", { method:"POST", headers:{ Authorization:`Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version":"2025-09-03", "Content-Type":"application/json" }, body:JSON.stringify({ parent:{type:"data_source_id",data_source_id:input.dataSourceId}, properties:{ Name:{title:[{text:{content:input.title}}]}, Source:{select:{name:input.source}}, ...(input.githubIssueUrl ? {"GitHub Issue URL":{url:input.githubIssueUrl}} : {}) } }) });
  if(!response.ok) throw new Error(`Notion create page failed: ${response.status} ${await response.text()}`); return response.json() as Promise<{id:string;url:string}>;
}
export async function updateNotionTask(pageId:string, properties:Record<string,unknown>) { if(!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN is not configured"); const response=await fetch(`https://api.notion.com/v1/pages/${pageId}`,{method:"PATCH",headers:{Authorization:`Bearer ${process.env.NOTION_TOKEN}`,"Notion-Version":"2025-09-03","Content-Type":"application/json"},body:JSON.stringify({properties})});if(!response.ok)throw new Error(`Notion update failed: ${response.status}`);return response.json(); }
