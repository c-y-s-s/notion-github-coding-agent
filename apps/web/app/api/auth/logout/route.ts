import { ok } from "@/lib/http";

export async function POST() {
  const response = ok({ authenticated: false });
  response.cookies.set("dashboard_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
