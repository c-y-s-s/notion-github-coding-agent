import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (!match || process.env[match[1]]) continue;
  process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

const secret = process.env.INTERNAL_JOB_SECRET ?? process.env.DASHBOARD_PASSWORD;
if (!secret) throw new Error("apps/web/.env.local 缺少 INTERNAL_JOB_SECRET 或 DASHBOARD_PASSWORD");
const baseUrl = process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3001";
const response = await fetch(`${baseUrl}/api/internal/demo/prepare`, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
});
const body = await response.json();
if (!response.ok) throw new Error(body.error ?? `Demo 準備失敗 (${response.status})`);
for (const item of body.results) console.log(`${item.action}: ${item.title}`);
