import { demoRuns, demoTasks } from "./demo-data";
import { adminDb, hasSupabaseEnv } from "./supabase";
import type { AgentRun, WorkItem } from "./types";

export async function listTasks(): Promise<WorkItem[]> {
  if (!hasSupabaseEnv()) return demoTasks;
  const { data, error } = await adminDb().from("work_items").select("*").order("updated_at", { ascending: false });
  if (error) throw error; return data as WorkItem[];
}
export async function listRuns(): Promise<AgentRun[]> {
  if (!hasSupabaseEnv()) return demoRuns;
  const { data, error } = await adminDb().from("agent_runs").select("*").order("created_at", { ascending: false });
  if (error) throw error; return data as AgentRun[];
}
export async function getRun(id: string) {
  if (!hasSupabaseEnv()) return { run: demoRuns.find(x => x.id === id) ?? demoRuns[0], steps: [], artifacts: [{ id:"demo-artifact", type:"diff", content:"Demo mode: configure Supabase and start the worker to produce a real patch.", metadata:{} }] };
  const db = adminDb(); const [{data:run,error},{data:steps},{data:artifacts}] = await Promise.all([db.from("agent_runs").select("*").eq("id",id).single(),db.from("agent_run_steps").select("*").eq("agent_run_id",id).order("sequence"),db.from("artifacts").select("*").eq("agent_run_id",id).order("created_at")]); if(error) throw error; return {run,steps:steps??[],artifacts:artifacts??[]};
}
