import { z } from "zod";
export const linkSchema = z.object({ notionPageId: z.string().uuid() });
export const reviewActionSchema = z.enum(["accept", "needs-info", "ignore"]);
export const agentDecisionSchema = z.object({ decision: z.enum(["approve", "reject"]) });
export const taskPlanningSchema = z.object({
  planningStatus: z.enum(["draft", "ready", "in_progress", "blocked", "done"]),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
