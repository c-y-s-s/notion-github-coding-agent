import { reconcileGitHub } from "@/lib/github-reconcile";
import { failure, ok } from "@/lib/http";
import { scheduleSyncJobs } from "@/lib/sync-scheduler";

export async function POST() {
  try {
    const result = await reconcileGitHub();
    if (result.syncJobsCreated) scheduleSyncJobs();
    return ok(result);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "GitHub reconciliation failed", 502);
  }
}
