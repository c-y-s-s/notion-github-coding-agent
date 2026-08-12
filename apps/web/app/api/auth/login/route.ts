import { timingSafeEqual } from "node:crypto";
import { failure, ok } from "@/lib/http";

export async function POST(request: Request) {
  const expectedPassword = process.env.DASHBOARD_PASSWORD;
  const sessionSecret = process.env.DASHBOARD_SESSION_SECRET;
  if (!expectedPassword || !sessionSecret) return failure("Dashboard login is not configured", 503);
  const body = await request.json().catch(() => null) as { password?: string; next?: string } | null;
  if (!body?.password || !equal(body.password, expectedPassword)) return failure("密碼錯誤", 401);
  const next = body.next?.startsWith("/") && !body.next.startsWith("//") ? body.next : "/";
  const response = ok({ authenticated: true, next });
  response.cookies.set("dashboard_session", sessionSecret, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}

function equal(actual: string, expected: string) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
