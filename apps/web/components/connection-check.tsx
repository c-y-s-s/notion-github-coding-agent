"use client";

import { useState } from "react";

type ConnectionResult = Record<string, { ok: boolean; message: string }>;
const labels: Record<string, string> = { supabase: "Supabase", github: "GitHub", notion: "Notion" };

export function ConnectionCheck({ disabled }: { disabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ConnectionResult | null>(null);
  const [error, setError] = useState("");

  async function check() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/settings/connections", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "連線測試失敗");
      setResults(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "連線測試失敗");
    } finally {
      setBusy(false);
    }
  }

  return <section className="section card">
    <div className="actions connection-heading"><div><h2>服務連線</h2><p className="muted">即時驗證資料庫及外部 API，不會修改任何資料。</p></div><button className="button" disabled={disabled || busy} onClick={check}>{busy ? "測試中…" : "測試連線"}</button></div>
    {error && <p className="error-text">{error}</p>}
    {results && <div className="connection-grid">{Object.entries(results).map(([provider, result]) => <div className="connection-item" key={provider}><span className={`health-dot ${result.ok ? "healthy" : "unhealthy"}`} /><div><strong>{labels[provider] ?? provider}</strong><small>{result.message}</small></div></div>)}</div>}
  </section>;
}
