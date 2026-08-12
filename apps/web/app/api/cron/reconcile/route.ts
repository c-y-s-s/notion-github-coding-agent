import { reconcileGitHub } from "@/lib/github-reconcile";
import { failure, ok } from "@/lib/http";
import { processOneSyncJob } from "@/lib/sync-worker";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return failure("Unauthorized", 401);
  try {
    const reconciliation = await reconcileGitHub();
    let processedJobs = 0;
    for (let index = 0; index < 10; index += 1) {
      const job = await processOneSyncJob();
      if (!job) break;
      processedJobs += 1;
    }
    return ok({ reconciliation, processedJobs });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Scheduled reconciliation failed", 502);
  }
}
