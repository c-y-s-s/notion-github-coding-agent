import { reconcileGitHub } from "@/lib/github-reconcile";
import { failure, ok } from "@/lib/http";
import { scheduleSyncJobs } from "@/lib/sync-scheduler";

export async function POST(request: Request) {
  const expected = process.env.INTERNAL_JOB_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return failure("Unauthorized", 401);
  try {
    const result = await reconcileGitHub();
    if (result.syncJobsCreated) scheduleSyncJobs();
    return ok(result);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "GitHub reconciliation failed", 502);
  }
}
