import { createGitHubIssue } from "@/lib/github";
import { failure, ok } from "@/lib/http";
import { updateNotionTask } from "@/lib/notion";
import { scheduleSyncJobs } from "@/lib/sync-scheduler";
import { adminDb } from "@/lib/supabase";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = adminDb();
  const { data: task } = await db
    .from("work_items")
    .select("*,repositories(github_owner,github_name)")
    .eq("id", id)
    .maybeSingle();

  if (!task) return failure("Task not found", 404);
  if (task.notion_page_id && !task.notion_page_url)
    return failure("原始 Notion Task 已刪除，不能建立 GitHub Issue", 409);
  if (task.github_issue_node_id)
    return failure("GitHub issue already exists", 409);
  if (task.source !== "notion")
    return failure("Only Notion-origin tasks use this action", 422);
  const repo = task.repositories;
  if (!repo) return failure("Repository is not configured", 422);

  try {
    const issue = await createGitHubIssue({
      owner: repo.github_owner,
      repo: repo.github_name,
      title: task.title,
      body: [
        task.description,
        task.acceptance_criteria &&
          `## Acceptance criteria\n${task.acceptance_criteria}`,
        `Agent-Desk-Work-Item: ${task.id}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    const { data, error } = await db
      .from("work_items")
      .update({
        github_issue_node_id: issue.node_id,
        github_issue_number: issue.number,
        github_issue_url: issue.html_url,
        github_issue_state: issue.state,
      })
      .eq("id", id)
      .is("github_issue_node_id", null)
      .select()
      .single();
    if (error) return failure(error.message, 500);

    if (task.notion_page_id) {
      try {
        await updateNotionTask(task.notion_page_id, {
          "GitHub Issue URL": { url: issue.html_url },
          "Last Synced At": { date: { start: new Date().toISOString() } },
        });
      } catch {
        await db
          .from("sync_jobs")
          .insert({ work_item_id: id, action: "update_notion_issue" });
        scheduleSyncJobs();
      }
    }

    return ok(data, 201);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "GitHub request failed",
      502,
    );
  }
}
