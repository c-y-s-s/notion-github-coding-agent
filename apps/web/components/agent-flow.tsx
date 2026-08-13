type Step = { sequence: number; step_type: string; status: string; attempt_number?: number };

const stages = [
  { key: "inspect", label: "Context Retrieval" },
  { key: "baseline", label: "Baseline" },
  { key: "plan", label: "Plan" },
  { key: "edit", label: "Patch" },
  { key: "test", label: "Check" },
  { key: "review", label: "Evidence Gate" },
];

export function AgentFlow({ steps, runStatus }: { steps: Step[]; runStatus: string }) {
  const attempts = Math.max(0, ...steps.map(step => step.attempt_number ?? 0));
  return <div className="agent-flow-wrap">
    <div className="agent-flow">{stages.map((stage, index) => { const matching = steps.filter(step => step.step_type === stage.key); const state = stageState(matching); return <div className="flow-segment" key={stage.key}><div className={`flow-node ${state}`}><span className="flow-index">{index + 1}</span><div><strong>{stage.label}</strong><small>{stateLabel(state, matching.length)}</small></div></div>{index < stages.length - 1 && <span className="flow-arrow">→</span>}</div>; })}<div className="flow-segment"><div className={`flow-node ${approvalState(runStatus)}`}><span className="flow-index">7</span><div><strong>Human Approval</strong><small>{approvalLabel(runStatus)}</small></div></div></div></div>
    {attempts > 1 && <div className="retry-loop"><span>↳ Error Analysis → Retry</span><strong>{attempts} 次嘗試</strong></div>}
  </div>;
}

function stageState(steps: Step[]) { if (!steps.length) return "pending"; if (steps.some(step => step.status === "failed")) return "failed"; if (steps.some(step => step.status === "running")) return "active"; return "completed"; }
function stateLabel(state: string, count: number) { return state === "completed" ? `完成${count > 1 ? ` · ${count} 次` : ""}` : state === "failed" ? "失敗" : state === "active" ? "執行中" : "尚未執行"; }
function approvalState(status: string) { return status === "awaiting_approval" ? "active" : ["approved", "pushing", "succeeded"].includes(status) ? "completed" : ["rejected", "failed", "cancelled"].includes(status) ? "failed" : "pending"; }
function approvalLabel(status: string) { return status === "awaiting_approval" ? "等待核准" : status === "rejected" ? "已拒絕" : ["approved", "pushing", "succeeded"].includes(status) ? "已核准" : "尚未進入"; }
