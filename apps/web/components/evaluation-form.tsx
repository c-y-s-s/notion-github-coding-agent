"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Evaluation = {
  analysis_correct: boolean;
  patch_usable: boolean | null;
  failure_category: string | null;
  notes: string | null;
};

export function EvaluationForm({ runId, initial }: { runId: string; initial?: Evaluation | null }) {
  const router = useRouter();
  const [analysisCorrect, setAnalysisCorrect] = useState(initial?.analysis_correct ?? true);
  const [patchUsable, setPatchUsable] = useState<"yes" | "no" | "na">(
    initial?.patch_usable === true ? "yes" : initial?.patch_usable === false ? "no" : "na",
  );
  const [failureCategory, setFailureCategory] = useState(initial?.failure_category ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/agent-runs/${runId}/evaluation`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          analysis_correct: analysisCorrect,
          patch_usable: patchUsable === "na" ? null : patchUsable === "yes",
          failure_category: failureCategory || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "儲存失敗");
      setMessage("評估已儲存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗");
    } finally {
      setBusy(false);
    }
  }

  const failed = !analysisCorrect || patchUsable === "no";
  return <form className="evaluation-form" onSubmit={submit}>
    <div className="evaluation-grid">
      <fieldset><legend>分析是否正確？</legend><label><input type="radio" checked={analysisCorrect} onChange={() => setAnalysisCorrect(true)} /> 正確</label><label><input type="radio" checked={!analysisCorrect} onChange={() => setAnalysisCorrect(false)} /> 不正確</label></fieldset>
      <fieldset><legend>Patch 是否可用？</legend><label><input type="radio" name="patch" checked={patchUsable === "yes"} onChange={() => setPatchUsable("yes")} /> 可用</label><label><input type="radio" name="patch" checked={patchUsable === "no"} onChange={() => setPatchUsable("no")} /> 不可用</label><label><input type="radio" name="patch" checked={patchUsable === "na"} onChange={() => setPatchUsable("na")} /> 未產生／不適用</label></fieldset>
    </div>
    {failed && <label className="form-field"><span>主要問題</span><select value={failureCategory} onChange={event => setFailureCategory(event.target.value)} required><option value="">請選擇</option><option value="wrong_analysis">分析方向錯誤</option><option value="missing_context">缺少程式碼背景</option><option value="bad_patch">Patch 不符合需求</option><option value="checks_failed">檢查無法通過</option><option value="unsafe_scope">修改範圍不安全</option><option value="other">其他</option></select></label>}
    <label className="form-field"><span>備註（選填）</span><textarea maxLength={1000} rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="例如：分析正確，但漏改了一個測試檔案" /></label>
    <div className="actions"><button className="button" disabled={busy}>{busy ? "儲存中…" : initial ? "更新評估" : "儲存評估"}</button>{message && <span className="muted">{message}</span>}</div>
  </form>;
}
