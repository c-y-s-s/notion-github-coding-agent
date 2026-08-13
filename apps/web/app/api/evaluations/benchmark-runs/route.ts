import { z } from "zod";
import dataset from "../../../../../../workers/agent/evals/dataset.json";
import { failure, ok } from "@/lib/http";
import { adminDb } from "@/lib/supabase";

const schema = z.object({
  model: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9._:-]+$/),
  prompt_version: z.enum(["v1", "v2"]),
  case_ids: z.array(z.string()).max(20).default([]),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Benchmark 設定不正確", 422);
  const known = new Set(dataset.cases.map(testCase => testCase.id));
  if (parsed.data.case_ids.some(id => !known.has(id))) return failure("包含不存在的測試案例", 422);
  const { data, error } = await adminDb().from("benchmark_runs").insert({
    dataset_version: dataset.version,
    model: parsed.data.model,
    prompt_version: parsed.data.prompt_version,
    selected_case_ids: parsed.data.case_ids,
    status: "queued",
  }).select().single();
  if (error) return failure(error.message, 500);
  return ok(data, 202);
}
