import { adminDb } from "@/lib/supabase";
import { verifyGitHubSignature } from "@/lib/github";
import { failure, ok } from "@/lib/http";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyGitHubSignature(raw, request.headers.get("x-hub-signature-256"))) return failure("Invalid GitHub signature", 401);
  const delivery = request.headers.get("x-github-delivery"); const event = request.headers.get("x-github-event");
  if (!delivery || !event) return failure("Missing GitHub delivery headers");
  const payload = JSON.parse(raw) as Record<string, any>;
  const db = adminDb();
  const { error: eventError } = await db.from("sync_events").insert({ provider: "github", provider_event_id: delivery, event_type: event, payload });
  if (eventError?.code === "23505") return ok({ duplicate: true });
  if (eventError) return failure(eventError.message, 500);
  try {
    if (event === "issues" && payload.issue && payload.repository) {
      const issue = payload.issue; const repository = payload.repository;
      const repositoryIds = [repository.node_id, String(repository.id)].filter(Boolean);
      const { data: repo } = await db.from("repositories").select("id,project_id").in("github_node_id", repositoryIds).maybeSingle();
      if (repo) await db.from("work_items").upsert({ project_id: repo.project_id, repository_id: repo.id, source: "github", type: issue.labels?.some((x:any) => x.name === "bug") ? "bug" : "unknown", title: issue.title, description: issue.body, review_status: "pending", github_issue_node_id: issue.node_id, github_issue_number: issue.number, github_issue_url: issue.html_url, github_issue_state: issue.state }, { onConflict: "repository_id,github_issue_node_id", ignoreDuplicates: false });
    }
    if (event === "pull_request" && payload.pull_request && payload.repository) {
      const pr = payload.pull_request; const repositoryIds = [payload.repository.node_id, String(payload.repository.id)].filter(Boolean); const { data: repo } = await db.from("repositories").select("id").in("github_node_id", repositoryIds).maybeSingle();
      if (repo) { const { data: run } = await db.from("agent_runs").select("work_item_id").eq("branch_name", pr.head.ref).maybeSingle(); await db.from("pull_requests").upsert({ repository_id: repo.id, work_item_id: run?.work_item_id ?? null, github_pr_node_id: pr.node_id, github_pr_number: pr.number, github_pr_url: pr.html_url, head_branch: pr.head.ref, state: pr.merged ? "merged" : pr.state, merged_at: pr.merged_at }, { onConflict: "repository_id,github_pr_node_id" }); if (run?.work_item_id) { await db.from("work_items").update({ planning_status: pr.merged ? "done" : pr.state === "closed" ? "blocked" : "in_progress", github_pr_url: pr.html_url }).eq("id", run.work_item_id); await db.from("sync_jobs").insert({work_item_id:run.work_item_id,action:"update_notion_status"}); } }
    }
    await db.from("sync_events").update({ status: "completed", processed_at: new Date().toISOString() }).eq("provider", "github").eq("provider_event_id", delivery);
    return ok({ accepted: true }, 202);
  } catch (error) { await db.from("sync_events").update({ status: "failed", last_error: String(error) }).eq("provider", "github").eq("provider_event_id", delivery); return failure("Webhook processing failed", 500); }
}
