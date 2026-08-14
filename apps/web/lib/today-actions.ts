import type { AgentRun, SyncEvent, SyncJob, WorkItem } from "./types";

export type TodayAction = {
  id: string;
  priority: number;
  tone: "critical" | "warning" | "info";
  kicker: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  workItemId?: string;
};

export function buildTodayActions(input: {
  tasks: WorkItem[];
  runs: AgentRun[];
  failedJobs: SyncJob[];
  failedEvents: SyncEvent[];
  today: string;
}) {
  const { tasks, runs, failedJobs, failedEvents, today } = input;
  const actions: TodayAction[] = [];
  const latestRunByTask = new Map<string, AgentRun>();
  for (const run of runs)
    if (!latestRunByTask.has(run.work_item_id))
      latestRunByTask.set(run.work_item_id, run);

  // Failed jobs remain retryable in the same row. Failed webhook events are an audit trail
  // and may already have been reconciled, so they must not become permanent "today" work.
  if (failedJobs.length > 0) {
    actions.push({
      id: "sync-failures",
      priority: 10,
      tone: "critical",
      kicker: "同步需要處理",
      title: `${failedJobs.length} 筆回寫工作失敗`,
      detail: failedEvents.length
        ? `另有 ${failedEvents.length} 筆 Webhook 失敗紀錄可供調查`
        : "可前往同步紀錄查看原因並重試",
      href: "/sync",
      action: "查看並重試",
    });
  }

  for (const task of tasks) {
    if (task.review_status === "pending") {
      actions.push({
        id: `review-${task.id}`,
        workItemId: task.id,
        priority: 40,
        tone: "info",
        kicker: "GitHub Issue 待審核",
        title: task.title || "未命名 Issue",
        detail: task.github_issue_number
          ? `Issue #${task.github_issue_number}`
          : "外部需求等待你的決定",
        href: "/inbox",
        action: "前往審核",
      });
      continue;
    }
    if (
      ["needs_info", "ignored"].includes(task.review_status) ||
      task.planning_status === "done"
    )
      continue;
    if (task.deadline && task.deadline < today) {
      actions.push({
        id: `overdue-${task.id}`,
        workItemId: task.id,
        priority: 20,
        tone: "critical",
        kicker: `已逾期 ${daysBetween(task.deadline, today)} 天`,
        title: task.title,
        detail: `原定 ${shortDate(task.deadline)} 完成`,
        href: `/tasks/${task.id}`,
        action: "查看任務",
      });
    } else if (task.deadline === today) {
      actions.push({
        id: `today-${task.id}`,
        workItemId: task.id,
        priority: 60,
        tone: "warning",
        kicker: "今天到期",
        title: task.title,
        detail: "請確認進度或調整 Deadline",
        href: `/tasks/${task.id}`,
        action: "查看任務",
      });
    }
  }

  for (const [taskId, run] of latestRunByTask) {
    const task = tasks.find((item) => item.id === taskId);
    if (
      !task ||
      ["pending", "needs_info", "ignored"].includes(task.review_status)
    )
      continue;
    if (run.status === "awaiting_approval") {
      actions.push({
        id: `approval-${run.id}`,
        workItemId: task.id,
        priority: 30,
        tone: "warning",
        kicker: "AI Patch 等待核准",
        title: task.title,
        detail: `${riskLabel(run.risk_level)} · 修改內容與檢查結果已就緒`,
        href: `/runs/${run.id}`,
        action: "查看 Diff",
      });
    } else if (run.status === "failed") {
      actions.push({
        id: `failed-${run.id}`,
        workItemId: task.id,
        priority: 50,
        tone: "critical",
        kicker: "Agent 執行失敗",
        title: task.title,
        detail: "需要查看失敗原因後決定是否重跑",
        href: `/runs/${run.id}`,
        action: "查看原因",
      });
    }
  }

  const seenTasks = new Set<string>();
  return actions
    .sort((left, right) => left.priority - right.priority)
    .filter((action) => {
      if (!action.workItemId) return true;
      if (seenTasks.has(action.workItemId)) return false;
      seenTasks.add(action.workItemId);
      return true;
    })
    .slice(0, 8);
}

function daysBetween(from: string, to: string) {
  return Math.max(
    1,
    Math.round(
      (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
        86_400_000,
    ),
  );
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function riskLabel(value: string | null) {
  return value === "high"
    ? "高風險"
    : value === "medium"
      ? "中風險"
      : value === "low"
        ? "低風險"
        : "風險待確認";
}
