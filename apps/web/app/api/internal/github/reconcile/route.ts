import { listOpenGitHubIssues } from "@/lib/github";
import { failure, ok } from "@/lib/http";
import { adminDb } from "@/lib/supabase";

export async function POST(request: Request) {
  const expected = process.env.INTERNAL_JOB_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return failure("Unauthorized", 401);

  const db = adminDb();
  const { data: repositories, error } = await db.from("repositories").select("id,project_id,github_owner,github_name");
  if (error) return failure(error.message, 500);

  let created = 0;
  let updated = 0;
  for (const repository of repositories ?? []) {
    const issues = await listOpenGitHubIssues(repository.github_owner, repository.github_name);
    for (const issue of issues) {
      const { data: existing } = await db.from("work_items").select("id").eq("repository_id", repository.id).eq("github_issue_node_id", issue.node_id).maybeSingle();
      const fields = { type: issue.labels?.some((label: { name?: string }) => label.name === "bug") ? "bug" : "unknown", title: issue.title, description: issue.body, github_issue_number: issue.number, github_issue_url: issue.html_url, github_issue_state: issue.state };
      if (existing) {
        const result = await db.from("work_items").update(fields).eq("id", existing.id);
        if (result.error) return failure(result.error.message, 500);
        updated += 1;
      } else {
        const result = await db.from("work_items").insert({ project_id: repository.project_id, repository_id: repository.id, source: "github", review_status: "pending", github_issue_node_id: issue.node_id, ...fields });
        if (result.error) return failure(result.error.message, 500);
        created += 1;
      }
    }
  }
  return ok({ repositories: repositories?.length ?? 0, created, updated });
}
