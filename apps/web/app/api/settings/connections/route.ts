import { ok } from "@/lib/http";
import { adminDb } from "@/lib/supabase";

async function result(check: () => Promise<string>) {
  try {
    return { ok: true, message: await check() };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "連線失敗" };
  }
}

export async function GET() {
  const db = adminDb();
  const { data: repository } = await db.from("repositories").select("github_owner,github_name,project:projects!repositories_project_id_fkey(notion_data_source_id)").limit(1).maybeSingle();
  const project = Array.isArray(repository?.project) ? repository.project[0] : repository?.project;
  const sourceId = project?.notion_data_source_id;

  const [supabase, github, notion] = await Promise.all([
    result(async () => {
      const { error } = await db.from("projects").select("id", { head: true, count: "exact" });
      if (error) throw error;
      return "資料庫連線正常";
    }),
    result(async () => {
      if (!repository || !process.env.GITHUB_TOKEN) throw new Error("Repository 或 Token 未設定");
      const response = await fetch(`https://api.github.com/repos/${repository.github_owner}/${repository.github_name}`, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`GitHub 回應 ${response.status}`);
      return "Repository 存取正常";
    }),
    result(async () => {
      if (!sourceId || !process.env.NOTION_TOKEN) throw new Error("Data Source 或 Token 未設定");
      const response = await fetch(`https://api.notion.com/v1/data_sources/${sourceId}`, { headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": "2025-09-03" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Notion 回應 ${response.status}`);
      return "Data Source 存取正常";
    }),
  ]);

  return ok({ supabase, github, notion });
}
