import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGitHubSignature(raw: string, signature: string | null, secret = process.env.GITHUB_WEBHOOK_SECRET) {
  if (!secret || !signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createGitHubIssue(input: { owner: string; repo: string; title: string; body: string }) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured");
  const response = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/issues`, { method: "POST", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" }, body: JSON.stringify({ title: input.title, body: input.body }) });
  if (!response.ok) throw new Error(`GitHub API failed: ${response.status}`);
  return response.json() as Promise<{ node_id: string; number: number; html_url: string; state: string }>;
}

export async function listOpenGitHubIssues(owner: string, repo: string) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured");
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GitHub API failed: ${response.status}`);
  const items = await response.json() as Array<Record<string, any>>;
  return items.filter(item => !item.pull_request);
}

export async function listGitHubPullRequests(owner: string, repo: string) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured");
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GitHub API failed: ${response.status}`);
  return response.json() as Promise<Array<Record<string, any>>>;
}
