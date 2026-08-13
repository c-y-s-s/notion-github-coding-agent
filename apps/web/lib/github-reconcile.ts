import { listGitHubPullRequests, listOpenGitHubIssues } from "./github";
import { adminDb } from "./supabase";
import { serviceError } from "./errors";

export async function reconcileGitHub() {
  const db = adminDb();
  const { data: repositories, error } = await db.from("repositories").select("id,project_id,github_owner,github_name");
  if (error) throw serviceError("讀取 Repository 設定失敗", error);

  let issuesCreated = 0;
  let issuesUpdated = 0;
  let pullRequestsCreated = 0;
  let pullRequestsUpdated = 0;
  let syncJobsCreated = 0;

  for (const repository of repositories ?? []) {
    const issues = await listOpenGitHubIssues(repository.github_owner, repository.github_name);
    for (const issue of issues) {
      const { data: existing } = await db.from("work_items").select("id").eq("repository_id", repository.id).eq("github_issue_node_id", issue.node_id).maybeSingle();
      const fields = { type: issue.labels?.some((label: { name?: string }) => label.name === "bug") ? "bug" : "unknown", title: issue.title, description: issue.body, github_issue_number: issue.number, github_issue_url: issue.html_url, github_issue_state: issue.state };
      if (existing) {
        const result = await db.from("work_items").update(fields).eq("id", existing.id);
        if (result.error) throw serviceError("更新 GitHub Issue 失敗", result.error);
        issuesUpdated += 1;
      } else {
        const result = await db.from("work_items").insert({ project_id: repository.project_id, repository_id: repository.id, source: "github", review_status: "pending", github_issue_node_id: issue.node_id, ...fields });
        if (result.error) throw serviceError("建立 GitHub Issue Work Item 失敗", result.error);
        issuesCreated += 1;
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
        if (result.error) throw serviceError("更新 Pull Request 失敗", result.error);
        pullRequestsUpdated += 1;
      } else {
        const result = await db.from("pull_requests").insert({ repository_id: repository.id, github_pr_node_id: pullRequest.node_id, ...fields });
        if (result.error) throw serviceError("建立 Pull Request 紀錄失敗", result.error);
        pullRequestsCreated += 1;
      }
      if (run?.work_item_id && (!existing || existing.state !== state || existing.work_item_id !== run.work_item_id)) {
        const planningStatus = state === "merged" ? "done" : state === "closed" ? "blocked" : "in_progress";
        const workItemResult = await db.from("work_items").update({ planning_status: planningStatus, github_pr_url: pullRequest.html_url }).eq("id", run.work_item_id);
        if (workItemResult.error) throw serviceError("更新 PR 對應任務失敗", workItemResult.error);
        const jobResult = await db.from("sync_jobs").insert({ work_item_id: run.work_item_id, action: "update_notion_status" });
        if (jobResult.error) throw serviceError("建立 Notion 回寫工作失敗", jobResult.error);
        syncJobsCreated += 1;
      }
    }
  }

  return { repositories: repositories?.length ?? 0, issues: { created: issuesCreated, updated: issuesUpdated }, pullRequests: { created: pullRequestsCreated, updated: pullRequestsUpdated }, syncJobsCreated };
}
