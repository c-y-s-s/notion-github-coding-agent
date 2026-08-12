import { StatusBadge } from "./status-badge";

type Analysis = {
  summary?: string;
  complexity?: string;
  risk_level?: string;
  risk_reasons?: string[];
  related_files?: string[];
  proposed_changes?: string[];
  acceptance_checks?: string[];
  can_prepare_patch?: boolean;
};

export function AnalysisPanel({ content }: { content?: string | null }) {
  if (!content) return <p className="muted">Agent 完成分析後會在這裡顯示摘要與風險。</p>;
  const analysis = parseAnalysis(content);
  if (!analysis) return <pre className="code">{content}</pre>;

  return <div className="analysis-panel">
    <div className="analysis-summary">
      <div><span className="field-label">分析摘要</span><p>{analysis.summary || "未提供摘要"}</p></div>
      <div className="analysis-badges">
        {analysis.complexity && <span className="badge">{complexityLabel(analysis.complexity)}</span>}
        {analysis.risk_level && <StatusBadge value={analysis.risk_level} />}
        <StatusBadge value={analysis.can_prepare_patch ? "patch_ready" : "patch_blocked"} />
      </div>
    </div>
    <AnalysisList title="預計修改" items={analysis.proposed_changes} />
    <AnalysisList title="驗收方式" items={analysis.acceptance_checks} checked />
    <AnalysisList title="風險原因" items={analysis.risk_reasons} />
    {analysis.related_files?.length ? <div><span className="field-label">相關檔案</span><div className="file-list">{analysis.related_files.map(file => <code key={file}>{file}</code>)}</div></div> : null}
  </div>;
}

function AnalysisList({ title, items, checked = false }: { title: string; items?: string[]; checked?: boolean }) {
  if (!items?.length) return null;
  return <div><span className="field-label">{title}</span><ul className="analysis-list">{items.map((item, index) => <li key={`${index}-${item}`}>{checked && <span className="checkmark">✓</span>}{item}</li>)}</ul></div>;
}

function parseAnalysis(content: string): Analysis | null {
  try { return JSON.parse(content) as Analysis; } catch { return null; }
}

function complexityLabel(value: string) {
  return ({ small: "小型修改", medium: "中型修改", large: "大型修改" } as Record<string, string>)[value] ?? value;
}
