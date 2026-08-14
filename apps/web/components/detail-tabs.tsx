"use client";

import { useState } from "react";

export type DetailTab = { id: string; label: string; content: React.ReactNode };

export function DetailTabs({ tabs, initialId }: { tabs: DetailTab[]; initialId?: string }) {
  const [active, setActive] = useState(initialId ?? tabs[0]?.id);
  const selected = tabs.find(tab => tab.id === active) ?? tabs[0];
  return <section className="section detail-tabs">
    <div className="tab-list" role="tablist" aria-label="詳細資訊">
      {tabs.map(tab => <button key={tab.id} id={`tab-${tab.id}`} role="tab" aria-selected={selected?.id === tab.id} aria-controls={`panel-${tab.id}`} className={selected?.id === tab.id ? "active" : ""} onClick={() => setActive(tab.id)}>{tab.label}</button>)}
    </div>
    {selected ? <div className="card tab-panel" id={`panel-${selected.id}`} role="tabpanel" aria-labelledby={`tab-${selected.id}`}>{selected.content}</div> : null}
  </section>;
}
