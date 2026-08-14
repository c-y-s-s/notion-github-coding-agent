import { demoRuns, demoTasks } from "./demo-data";
import { adminDb, hasSupabaseEnv } from "./supabase";
import type { AgentRun, Sprint, SyncEvent, SyncJob, WorkItem, WorkerHeartbeat } from "./types";
import { unstable_noStore as noStore } from "next/cache";
import { serviceError } from "./errors";

export async function listTasks(): Promise<WorkItem[]> {
  noStore();
  if (!hasSupabaseEnv()) return demoTasks;
  const { data, error } = await adminDb().from("work_items").select("*").order("updated_at", { ascending: false });
  if (error) throw serviceError("讀取任務失敗", error); return data as WorkItem[];
}
export async function listSprints(): Promise<Sprint[]> {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await adminDb().from("sprints").select("*").order("start_date", { ascending: false });
  if (error) throw serviceError("讀取 Sprint 失敗", error);
  return data as Sprint[];
}
export async function listRuns(): Promise<AgentRun[]> {
  noStore();
  if (!hasSupabaseEnv()) return demoRuns;
  const { data, error } = await adminDb().from("agent_runs").select("*,work_items(title)").order("created_at", { ascending: false });
  if (error) throw serviceError("讀取 Agent 執行紀錄失敗", error); return data as AgentRun[];
}
export async function listEvaluations() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await adminDb().from("agent_evaluations").select("*").order("updated_at", { ascending: false });
  if (error) throw serviceError("讀取 Agent 評估失敗", error);
  return data ?? [];
}
export async function listBenchmarkRuns() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await adminDb().from("benchmark_runs").select("*").order("created_at", { ascending: false }).limit(20);
  if (error) throw serviceError("讀取 Benchmark Runs 失敗", error);
  return data ?? [];
}
export async function getBenchmarkCaseResults(caseId: string) {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await adminDb().from("benchmark_case_results").select("*,benchmark_runs(model,prompt_version,dataset_version,created_at,status)").eq("case_id", caseId).order("created_at", { ascending: false }).limit(20);
  if (error) throw serviceError("讀取 Benchmark 案例結果失敗", error);
  return data ?? [];
}
export async function getBenchmarkRunWithResults(id: string) {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const db = adminDb();
  const [{ data: run, error }, { data: results, error: resultsError }] = await Promise.all([
    db.from("benchmark_runs").select("*").eq("id", id).maybeSingle(),
    db.from("benchmark_case_results").select("*").eq("benchmark_run_id", id).order("case_id"),
  ]);
  if (error || resultsError) throw serviceError("讀取 Benchmark 比較資料失敗", error ?? resultsError);
  return run ? { run, results: results ?? [] } : null;
}
export async function getDemoStory() {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const db = adminDb();
  const { data: replay, error } = await db.from("agent_runs").select("*").not("parent_run_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw serviceError("讀取 Demo Replay 失敗", error);
  if (!replay?.parent_run_id) return null;
  const [{ data: original }, { data: task }, { data: runs }, { data: artifacts }, { data: steps }] = await Promise.all([
    db.from("agent_runs").select("*").eq("id", replay.parent_run_id).single(),
    db.from("work_items").select("*").eq("id", replay.work_item_id).single(),
    db.from("agent_runs").select("*").or(`id.eq.${replay.parent_run_id},parent_run_id.eq.${replay.parent_run_id}`).order("created_at"),
    db.from("artifacts").select("*").in("agent_run_id", [replay.parent_run_id, replay.id]).order("created_at"),
    db.from("agent_run_steps").select("*").in("agent_run_id", [replay.parent_run_id, replay.id]).order("sequence"),
  ]);
  if (!original || !task) return null;
  return { original, replay, task, runs: runs ?? [], artifacts: artifacts ?? [], steps: steps ?? [] };
}
export async function listSyncJobs(): Promise<SyncJob[]> {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await adminDb()
    .from("sync_jobs")
    .select("*,work_items(title)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw serviceError("讀取同步工作失敗", error);
  return data as unknown as SyncJob[];
}
export async function getLatestWorkerHeartbeat(): Promise<WorkerHeartbeat | null> {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const { data, error } = await adminDb().from("worker_heartbeats").select("*").order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw serviceError("讀取 Worker 狀態失敗", error);
  return data as WorkerHeartbeat | null;
}
export async function listSyncEvents(): Promise<SyncEvent[]> {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await adminDb().from("sync_events").select("id,provider,provider_event_id,event_type,status,attempt_count,last_error,received_at,processed_at").order("received_at", { ascending: false }).limit(100);
  if (error) throw serviceError("讀取 Webhook 事件失敗", error);
  return data as SyncEvent[];
}
export async function getRun(id: string) {
  noStore();
  if (!hasSupabaseEnv()) return { run: demoRuns.find(x => x.id === id) ?? demoRuns[0], steps: [], artifacts: [{ id:"demo-artifact", type:"diff", content:"示範模式：設定 Supabase 並啟動 Worker 後，即可產生真實的程式碼修改。", metadata:{} }], evaluation: null, related: [] };
  const db = adminDb(); const [{data:run,error},{data:steps},{data:artifacts},{data:evaluation}] = await Promise.all([db.from("agent_runs").select("*").eq("id",id).single(),db.from("agent_run_steps").select("*").eq("agent_run_id",id).order("sequence"),db.from("artifacts").select("*").eq("agent_run_id",id).order("created_at"),db.from("agent_evaluations").select("*").eq("agent_run_id",id).maybeSingle()]); if(error) throw serviceError("讀取 Agent 執行詳情失敗", error); const relatedIds = [run.parent_run_id, run.id].filter(Boolean); const { data: related } = await db.from("agent_runs").select("id,parent_run_id,replay_mode,status,model,prompt_version,base_commit_sha,attempt_number,token_usage,started_at,finished_at,error_code").or(`id.in.(${relatedIds.join(",")}),parent_run_id.eq.${run.parent_run_id ?? run.id}`).order("created_at"); return {run,steps:steps??[],artifacts:artifacts??[],evaluation,related:related??[]};
}

export async function getTaskDetail(id: string) {
  noStore();
  if (!hasSupabaseEnv()) {
    return { task: demoTasks.find(item => item.id === id) ?? null, pullRequests: [], latestRun: null, artifacts: [] };
  }
  const db = adminDb();
  const { data: task, error } = await db.from("work_items").select("*").eq("id", id).maybeSingle();
  if (error) throw serviceError("讀取任務詳情失敗", error);
  if (!task) return { task: null, pullRequests: [], latestRun: null, artifacts: [] };
  const [{ data: pullRequests }, { data: latestRun }] = await Promise.all([
    db.from("pull_requests").select("*").eq("work_item_id", id).order("created_at", { ascending: false }),
    db.from("agent_runs").select("*").eq("work_item_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: artifacts } = latestRun
    ? await db.from("artifacts").select("*").eq("agent_run_id", latestRun.id).order("created_at")
    : { data: [] };
  return { task: task as WorkItem, pullRequests: pullRequests ?? [], latestRun, artifacts: artifacts ?? [] };
}
