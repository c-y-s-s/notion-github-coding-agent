"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReplayForm({ runId, exactAvailable }: { runId: string; exactAvailable: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"exact" | "latest">(exactAvailable ? "exact" : "latest");
  const [prompt, setPrompt] = useState("v1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const response = await fetch(`/api/agent-runs/${runId}/replay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, prompt_version: prompt }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "建立 Replay 失敗"); router.push(`/runs/${data.id}`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "建立失敗"); }
    finally { setBusy(false); }
  }
  return <form className="replay-form" onSubmit={submit}><label><span>執行方式</span><select value={mode} onChange={event => setMode(event.target.value as "exact" | "latest")}><option value="exact" disabled={!exactAvailable}>Exact Replay{exactAvailable ? "" : "（舊 Run 無快照）"}</option><option value="latest">Latest Main Rerun</option></select></label><label><span>Prompt</span><select value={prompt} onChange={event => setPrompt(event.target.value)}><option value="v1">v1 基準</option><option value="v2">v2 證據導向</option></select></label><button className="button" disabled={busy}>{busy ? "建立中…" : "建立實驗 Run"}</button>{message && <small className="replay-message">{message}</small>}</form>;
}
