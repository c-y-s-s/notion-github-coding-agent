import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/webhooks/github", "/api/webhooks/notion", "/api/cron/reconcile", "/api/internal"];

export function middleware(request: NextRequest) {
  const sessionSecret = process.env.DASHBOARD_SESSION_SECRET;
  if (!sessionSecret) return NextResponse.next();
  if (PUBLIC_PATHS.some(path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))) return NextResponse.next();
  if (request.cookies.get("dashboard_session")?.value === sessionSecret) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
