import { demoRuns, demoTasks } from "./demo-data";
import { adminDb, hasSupabaseEnv } from "./supabase";
import type { AgentRun, SyncJob, WorkItem } from "./types";
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
export async function getRun(id: string) {
  noStore();
  if (!hasSupabaseEnv()) return { run: demoRuns.find(x => x.id === id) ?? demoRuns[0], steps: [], artifacts: [{ id:"demo-artifact", type:"diff", content:"示範模式：設定 Supabase 並啟動 Worker 後，即可產生真實的程式碼修改。", metadata:{} }] };
  const db = adminDb(); const [{data:run,error},{data:steps},{data:artifacts}] = await Promise.all([db.from("agent_runs").select("*").eq("id",id).single(),db.from("agent_run_steps").select("*").eq("agent_run_id",id).order("sequence"),db.from("artifacts").select("*").eq("agent_run_id",id).order("created_at")]); if(error) throw error; return {run,steps:steps??[],artifacts:artifacts??[]};
}
