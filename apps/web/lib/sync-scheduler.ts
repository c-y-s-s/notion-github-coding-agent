import { after } from "next/server";
import { processOneSyncJob } from "./sync-worker";

export function scheduleSyncJobs(limit = 5) {
  after(async () => {
    for (let index = 0; index < limit; index += 1) {
      try {
        const result = await processOneSyncJob();
        if (!result) break;
      } catch {
        // The worker records the error and retry time. A later event or manual retry resumes it.
        break;
      }
    }
  });
}
