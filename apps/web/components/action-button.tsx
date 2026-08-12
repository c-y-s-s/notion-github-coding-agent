"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ActionButton({ endpoint, label, tone = "primary", body }: { endpoint: string; label: string; tone?: "primary"|"secondary"|"danger"; body?: unknown }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function act() { setBusy(true); setError(""); try { const response = await fetch(endpoint, { method:"POST", headers:{"content-type":"application/json"}, body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Action failed"); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); } finally { setBusy(false); } }
  return <span><button className={`button ${tone === "secondary" ? "secondary" : tone === "danger" ? "danger" : ""}`} disabled={busy} onClick={act}>{busy ? "Working…" : label}</button>{error && <small style={{display:"block",color:"var(--red)",marginTop:5}}>{error}</small>}</span>;
}
