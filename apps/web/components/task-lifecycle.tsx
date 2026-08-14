const steps = [
  ["task", "任務"], ["issue", "Issue"], ["agent", "AI 修改"], ["branch", "分支"], ["pr", "PR"], ["done", "完成"],
] as const;

export function TaskLifecycle({ issue, agentStatus, branch, prState }: { issue: boolean; agentStatus: string; branch: boolean; prState?: string | null }) {
  const reached = issue ? agentStatus === "idle" ? 1 : branch ? prState === "merged" ? 5 : prState ? 4 : 3 : 2 : 0;
  return <ol className="lifecycle" aria-label="任務工程流程">{steps.map(([id, label], index) => <li className={index < reached ? "complete" : index === reached ? "current" : ""} key={id}><span>{index < reached ? "✓" : index + 1}</span><small>{label}</small></li>)}</ol>;
}
