import { z } from "zod";
export const linkSchema = z.object({ notionPageId: z.string().uuid() });
export const reviewActionSchema = z.enum(["accept", "needs-info", "ignore"]);
export const agentDecisionSchema = z.object({ decision: z.enum(["approve", "reject"]) });

