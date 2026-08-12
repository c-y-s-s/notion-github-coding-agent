import { demoRuns, demoTasks } from "./demo-data";
import { adminDb, hasSupabaseEnv } from "./supabase";
import type { AgentRun, SyncJob, WorkItem, WorkerHeartbeat } from "./types";
import { unstable_noStore as noStore } from "next/cache";

export async function listTasks(): Promise<WorkItem[]> {
  noStore();
  if (!hasSupabaseEnv()) return demoTasks;
  const { data, error } = await adminDb().from("work_items").select("*").order("updated_at", { ascending: false });
  if (error) throw error; return data as WorkItem[];
}
export async function listRuns(): Promise<AgentRun[]> {
  noStore();
  if (!hasSupabaseEnv()) return demoRuns;
  const { data, error } = await adminDb().from("agent_runs").select("*").order("created_at", { ascending: false });
  if (error) throw error; return data as AgentRun[];
}
export async function listSyncJobs(): Promise<SyncJob[]> {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await adminDb()
    .from("sync_jobs")
    .select("*,work_items(title)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as unknown as SyncJob[];
}
export async function getLatestWorkerHeartbeat(): Promise<WorkerHeartbeat | null> {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const { data, error } = await adminDb().from("worker_heartbeats").select("*").order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as WorkerHeartbeat | null;
}
export async function getRun(id: string) {
  noStore();
  if (!hasSupabaseEnv()) return { run: demoRuns.find(x => x.id === id) ?? demoRuns[0], steps: [], artifacts: [{ id:"demo-artifact", type:"diff", content:"示範模式：設定 Supabase 並啟動 Worker 後，即可產生真實的程式碼修改。", metadata:{} }] };
  const db = adminDb(); const [{data:run,error},{data:steps},{data:artifacts}] = await Promise.all([db.from("agent_runs").select("*").eq("id",id).single(),db.from("agent_run_steps").select("*").eq("agent_run_id",id).order("sequence"),db.from("artifacts").select("*").eq("agent_run_id",id).order("created_at")]); if(error) throw error; return {run,steps:steps??[],artifacts:artifacts??[]};
}

export async function getTaskDetail(id: string) {
  noStore();
  if (!hasSupabaseEnv()) {
    return { task: demoTasks.find(item => item.id === id) ?? null, pullRequests: [], latestRun: null, artifacts: [] };
  }
  const db = adminDb();
  const { data: task, error } = await db.from("work_items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
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
