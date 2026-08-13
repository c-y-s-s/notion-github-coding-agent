import { createNotionTask, updateNotionTask } from "./notion";
import { adminDb } from "./supabase";

export async function processOneSyncJob() {
  const { data } = await adminDb()
    .from("sync_jobs")
    .select("id")
    .eq("status", "queued")
    .lte("available_at", new Date().toISOString())
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data ? processSyncJob(data.id) : null;
}

export async function processSyncJob(jobId: string) {
  const db = adminDb();
  const { data: claimed } = await db
    .from("sync_jobs")
    .update({ status: "running" })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*,work_items(*,projects(notion_data_source_id))")
    .maybeSingle();
  if (!claimed) return null;

  const attemptCount = claimed.attempt_count + 1;
  await db.from("sync_jobs").update({ attempt_count: attemptCount }).eq("id", jobId);
  try {
    const task = claimed.work_items;
    if (claimed.action !== "create_notion_task" && task.notion_page_id && !task.notion_page_url) {
      await db.from("sync_jobs").update({ status: "completed", last_error: "Notion page was deleted; write-back skipped" }).eq("id", jobId);
      return { jobId, status: "completed" };
    }
    if (claimed.action === "create_notion_task") {
      if (task.notion_page_id) throw new Error("Task already has a Notion page");
      const dataSourceId = task.projects?.notion_data_source_id;
      if (!dataSourceId) throw new Error("Notion Data Source is not configured");
      const page = await createNotionTask({ dataSourceId, title: task.title, source: "GitHub", githubIssueUrl: task.github_issue_url });
      await db.from("work_items").update({ notion_page_id: page.id, notion_page_url: page.url }).eq("id", task.id);
    } else if (claimed.action === "update_notion_issue") {
      if (!task.notion_page_id) throw new Error("Task has no Notion page");
      await updateNotionTask(task.notion_page_id, {
        "GitHub Issue URL": task.github_issue_url ? { url: task.github_issue_url } : { url: null },
        "Last Synced At": { date: { start: new Date().toISOString() } },
      });
    } else if (claimed.action === "update_notion_status") {
      if (!task.notion_page_id) throw new Error("Task has no Notion page");
      const notionStatus = ({ draft: "草稿", ready: "可執行", in_progress: "進行中", blocked: "受阻", done: "已完成" } as Record<string, string>)[task.planning_status] ?? task.planning_status;
      await updateNotionTask(task.notion_page_id, {
        "Planning Status": { status: { name: notionStatus } },
        "GitHub PR URL": task.github_pr_url ? { url: task.github_pr_url } : { url: null },
        "Last Synced At": { date: { start: new Date().toISOString() } },
      });
    } else {
      throw new Error(`Unknown sync action: ${claimed.action}`);
    }
    await db.from("sync_jobs").update({ status: "completed", last_error: null }).eq("id", jobId);
    return { jobId, status: "completed" };
  } catch (reason) {
    await db.from("sync_jobs").update({
      status: attemptCount >= 3 ? "failed" : "queued",
      last_error: reason instanceof Error ? reason.message : String(reason),
      available_at: new Date(Date.now() + Math.min(60_000, attemptCount * 10_000)).toISOString(),
    }).eq("id", jobId);
    throw reason;
  }
}
