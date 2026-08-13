"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[dashboard] page failed", error); }, [error]);
  return <section className="section card error-state">
    <div className="eyebrow">暫時無法載入</div>
    <h1>資料讀取失敗</h1>
    <p className="lead">{error.message || "服務暫時發生錯誤，請稍後重試。"}</p>
    {error.digest && <p className="muted">錯誤編號：{error.digest}</p>}
    <button className="button" onClick={reset}>重新載入</button>
  </section>;
}
