import { listGitHubPullRequests, listOpenGitHubIssues } from "@/lib/github";
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
  let pullRequestsCreated = 0;
  let pullRequestsUpdated = 0;
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

    const pullRequests = await listGitHubPullRequests(repository.github_owner, repository.github_name);
    for (const pullRequest of pullRequests) {
      const state = pullRequest.merged_at ? "merged" : pullRequest.state;
      const { data: run } = await db.from("agent_runs").select("work_item_id").eq("branch_name", pullRequest.head.ref).maybeSingle();
      const { data: existing } = await db.from("pull_requests").select("id,state,work_item_id").eq("repository_id", repository.id).eq("github_pr_node_id", pullRequest.node_id).maybeSingle();
      const fields = { work_item_id: run?.work_item_id ?? existing?.work_item_id ?? null, github_pr_number: pullRequest.number, github_pr_url: pullRequest.html_url, head_branch: pullRequest.head.ref, state, merged_at: pullRequest.merged_at };
      if (existing) {
        const result = await db.from("pull_requests").update(fields).eq("id", existing.id);
        if (result.error) return failure(result.error.message, 500);
        pullRequestsUpdated += 1;
      } else {
        const result = await db.from("pull_requests").insert({ repository_id: repository.id, github_pr_node_id: pullRequest.node_id, ...fields });
        if (result.error) return failure(result.error.message, 500);
        pullRequestsCreated += 1;
      }
      if (run?.work_item_id && (!existing || existing.state !== state || existing.work_item_id !== run.work_item_id)) {
        const planningStatus = state === "merged" ? "done" : state === "closed" ? "blocked" : "in_progress";
        await db.from("work_items").update({ planning_status: planningStatus, github_pr_url: pullRequest.html_url }).eq("id", run.work_item_id);
        await db.from("sync_jobs").insert({ work_item_id: run.work_item_id, action: "update_notion_status" });
      }
    }
  }
  return ok({ repositories: repositories?.length ?? 0, issues: { created, updated }, pullRequests: { created: pullRequestsCreated, updated: pullRequestsUpdated } });
}
