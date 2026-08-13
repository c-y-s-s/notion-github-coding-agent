"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BenchmarkRunForm({ defaultModel, caseId }: { defaultModel: string; caseId?: string }) {
  const router = useRouter();
  const [model, setModel] = useState(defaultModel);
  const [promptVersion, setPromptVersion] = useState("v1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/evaluations/benchmark-runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, prompt_version: promptVersion, case_ids: caseId ? [caseId] : [] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "建立 Benchmark 失敗");
      setMessage("已排入本機 Worker"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "建立失敗"); }
    finally { setBusy(false); }
  }
  return <form className="benchmark-run-form" onSubmit={submit}><label><span>模型</span><input value={model} onChange={event => setModel(event.target.value)} required pattern="[a-zA-Z0-9._:-]+" list="benchmark-models" /><datalist id="benchmark-models"><option value="gpt-5.6-luna" /><option value="gpt-5.6-terra" /><option value="ollama:qwen2.5-coder:0.5b" /><option value="ollama:qwen2.5-coder:1.5b" /><option value="ollama:qwen2.5-coder:3b" /></datalist></label><label><span>Prompt</span><select value={promptVersion} onChange={event => setPromptVersion(event.target.value)}><option value="v1">v1 基準</option><option value="v2">v2 證據導向</option></select></label><button className="button" disabled={busy}>{busy ? "排程中…" : caseId ? "重新執行此案例" : "執行完整 Benchmark"}</button>{message && <small className="muted">{message}</small>}</form>;
}
