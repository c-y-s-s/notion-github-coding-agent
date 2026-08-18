import { createClient } from "@supabase/supabase-js";

export function hasSupabaseEnv() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment is not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

type SupabaseResult = { data?: unknown; error: { code?: string | null } | null };

export async function retrySupabaseRead<T extends SupabaseResult>(
  operation: () => PromiseLike<T>,
  wait: (milliseconds: number) => Promise<void> = delay,
): Promise<T> {
  // Opaque sb_secret keys are translated to short-lived internal JWTs by the
  // Supabase gateway. A small clock skew between gateway and PostgREST can
  // transiently reject a freshly issued token as PGRST303.
  const delays = [200, 500, 1_000];
  let result = await operation();
  for (const milliseconds of delays) {
    if (result.error?.code !== "PGRST303") return result;
    await wait(milliseconds);
    result = await operation();
  }
  return result;
}

function delay(milliseconds: number) {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}
