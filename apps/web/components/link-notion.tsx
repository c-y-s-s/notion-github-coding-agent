"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type NotionOption = { id: string; title: string; notion_page_id: string; planning_status: string };

export function LinkNotion({ issueId, disabled = false }: { issueId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NotionOption[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function load(value = "") {
    setQuery(value); setError("");
    const response = await fetch(`/api/notion-tasks/search?q=${encodeURIComponent(value)}`);
    if (!response.ok) { setError("讀取 Notion 任務失敗"); return; }
    const options = await response.json() as NotionOption[];
    setResults(options);
    if (!options.some(option => option.notion_page_id === selected)) setSelected(options[0]?.notion_page_id ?? "");
  }
  async function link() {
    if (!selected) return;
    const response = await fetch(`/api/inbox/issues/${issueId}/link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notionPageId: selected }) });
    if (!response.ok) { setError((await response.json()).error); return; }
    setOpen(false); router.refresh();
  }
  return <>
    <button className="button secondary" disabled={disabled} onClick={() => { setOpen(true); void load(); }}>連結 Notion 任務</button>
    {open && <div className="modal-backdrop"><div className="card link-modal" role="dialog" aria-modal="true" aria-labelledby={`link-title-${issueId}`}>
      <h2 id={`link-title-${issueId}`}>連結既有的 Notion 任務</h2>
      <label>搜尋<input autoFocus className="input" value={query} onChange={event => void load(event.target.value)} placeholder="輸入任務標題；留空顯示最近任務" /></label>
      <label>選擇任務<select className="input" value={selected} onChange={event => setSelected(event.target.value)}>{results.length ? results.map(option => <option key={option.id} value={option.notion_page_id}>{option.title} · {statusLabel(option.planning_status)}</option>) : <option value="">沒有可連結的 Notion 任務</option>}</select></label>
      {error && <p className="error-text">{error}</p>}
      <div className="actions"><button className="button" disabled={!selected} onClick={link}>確認連結</button><button className="button secondary" onClick={() => setOpen(false)}>取消</button></div>
    </div></div>}
  </>;
}

function statusLabel(status: string) { return ({ draft: "草稿", ready: "可執行", in_progress: "進行中", blocked: "受阻", done: "完成" } as Record<string, string>)[status] ?? status; }
