import Link from "next/link";
import {
  getOverviewData,
} from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";
import { DeadlineWorkspace } from "@/components/deadline-workspace";
import { sprintLabel } from "@/lib/sprint-display";
import { buildTodayActions } from "@/lib/today-actions";

function taipeiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}
function formatCompactTime(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function formatToday(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)} 月 ${Number(day)} 日 · 今日工作台`;
}
function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}
function isDeletedNotionTask(task: {
  notion_page_id?: string | null;
  notion_page_url: string | null;
}) {
  return Boolean(task.notion_page_id && !task.notion_page_url);
}
function latestRuns<T extends { work_item_id: string }>(runs: T[]) {
  const seen = new Set<string>();
  return runs.filter((run) => {
    if (seen.has(run.work_item_id)) return false;
    seen.add(run.work_item_id);
    return true;
  });
}

export default async function Overview() {
  const { tasks, runs, sprints, syncJobs, syncEvents, heartbeat } = await getOverviewData();

  const failedJobs = syncJobs.filter((job) => job.status === "failed");
  const failedEvents = syncEvents.filter((event) => event.status === "failed");
  const formalTasks = tasks.filter(
    (task) =>
      !["pending", "needs_info", "ignored"].includes(task.review_status) &&
      !isDeletedNotionTask(task) &&
      task.title !== "Untitled",
  );
  const workerOnline = Boolean(
    heartbeat &&
    Date.now() - new Date(heartbeat.last_seen_at).getTime() < 15_000,
  );
  const today = taipeiDate();
  const todayActions = buildTodayActions({
    tasks,
    runs,
    failedJobs,
    failedEvents,
    today,
  });
  const metrics = [
    {
      label: "已逾期",
      value: formalTasks.filter(
        (task) =>
          task.deadline &&
          task.deadline < today &&
          task.planning_status !== "done",
      ).length,
      href: "/tasks",
      tone: "critical",
    },
    {
      label: "待核准 Patch",
      value: latestRuns(runs).filter(
        (run) => run.status === "awaiting_approval",
      ).length,
      href: "/runs",
      tone: "warning",
    },
    {
      label: "待審核 Issue",
      value: tasks.filter((task) => task.review_status === "pending").length,
      href: "/inbox",
      tone: "info",
    },
    {
      label: "同步失敗",
      value: failedJobs.length + failedEvents.length,
      href: "/sync",
      tone: "critical",
    },
  ];

  return (
    <>
      <div className="overview-heading">
        <div>
          <div className="eyebrow">{formatToday(today)}</div>
          <h1>
            {todayActions.length
              ? `今天有 ${todayActions.length} 件事情需要處理`
              : "今天沒有待處理事項"}
          </h1>
          <p className="lead">
            依目前任務狀態推定，優先處理阻塞、逾期與等待人工決定的工作。
          </p>
        </div>
        <div className="worker-compact">
          <span className={`health-dot ${workerOnline ? "healthy" : ""}`} />
          <div>
            <strong>Agent Worker {workerOnline ? "在線" : "離線"}</strong>
            <small>
              {heartbeat
                ? `最後回報 ${formatTime(heartbeat.last_seen_at)}`
                : "尚未收到心跳"}
            </small>
          </div>
        </div>
      </div>

      <div className="grid action-metrics">
        {metrics.map((metric) => (
          <Link
            className={`card action-metric ${metric.value ? metric.tone : "quiet"}`}
            href={metric.href}
            key={metric.label}
          >
            <span className="muted">{metric.label}</span>
            <div className="metric">{metric.value}</div>
            <small>查看詳情 →</small>
          </Link>
        ))}
      </div>

      <section className="section card today-panel">
        <div className="section-heading">
          <div>
            <h2>今日需要處理</h2>
            <p className="muted">
              依同步阻塞、期限與人工決策排序，最多顯示 8 項。
            </p>
          </div>
        </div>
        {todayActions.length ? (
          <div className="today-action-list">
            {todayActions.map((item) => (
              <Link
                href={item.href}
                className={`today-action ${item.tone}`}
                key={item.id}
              >
                <span className="action-indicator" />
                <div className="today-action-copy">
                  <small>{item.kicker}</small>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <span className="action-link">{item.action} →</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty compact">
            <strong>目前沒有需要立即處理的工作</strong>
            <span>你可以查看本週排程，或前往任務頁規劃下一件工作。</span>
          </div>
        )}
      </section>

      {!workerOnline && (
        <section className="section card alert-card">
          <div>
            <h2>Agent Worker 目前離線</h2>
            <p className="muted">
              同步仍可運作，但 AI 分析與 Evaluation 不會開始。
            </p>
          </div>
          <Link className="button secondary" href="/settings">
            查看啟動方式
          </Link>
        </section>
      )}

      <DeadlineWorkspace
        tasks={formalTasks.filter((task) => task.planning_status !== "done")}
        sprints={sprints}
        today={today}
      />

      <section className="section card">
        <div className="section-heading">
          <div>
            <h2>近期工作</h2>
            <p className="muted">
              補充掌握最近更新的正式任務；需要行動的項目已優先顯示在上方。
            </p>
          </div>
          <Link className="button secondary" href="/tasks">
            查看全部
          </Link>
        </div>
        {formalTasks.length ? (
          <div className="table-scroll">
            <table className="table recent-work">
              <thead>
                <tr>
                  <th>任務</th>
                  <th>時程</th>
                  <th>工程進度</th>
                  <th>AI</th>
                  <th>更新</th>
                </tr>
              </thead>
              <tbody>
                {formalTasks.slice(0, 6).map((task) => {
                  const sprint = sprints.find(
                    (item) => item.id === task.sprint_id,
                  );
                  return (
                    <tr key={task.id}>
                      <td>
                        <Link href={`/tasks/${task.id}`}>
                          <strong>{task.title}</strong>
                          <small className="task-subline">
                            <StatusBadge value={task.type} />
                            <StatusBadge value={task.source} />
                          </small>
                        </Link>
                      </td>
                      <td>
                        <strong className="cell-primary">
                          {task.deadline ? shortDate(task.deadline) : "未排程"}
                        </strong>
                        <small>
                          {sprint ? sprintLabel(sprint, sprints) : "Backlog"}
                        </small>
                      </td>
                      <td>
                        <StatusBadge value={task.planning_status} />
                        {task.github_issue_number ? (
                          <a
                            className="issue-link"
                            href={task.github_issue_url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Issue #{task.github_issue_number}
                          </a>
                        ) : null}
                      </td>
                      <td>
                        <StatusBadge value={task.agent_status} />
                      </td>
                      <td>{formatCompactTime(task.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">目前沒有任務。</div>
        )}
      </section>
    </>
  );
}
