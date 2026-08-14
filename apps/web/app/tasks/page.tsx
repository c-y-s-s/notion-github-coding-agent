import { listSprints, listTasks } from "@/lib/data";
import { TaskBoard } from "@/components/task-board";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function Tasks() {
  const [allTasks, sprints] = await Promise.all([listTasks(), listSprints()]);
  const tasks = allTasks.filter(
    (x) => !["pending", "needs_info", "ignored"].includes(x.review_status),
  );

  return (
    <>
      <PageHeader
        eyebrow="正式工作項目"
        title="任務"
        description="依 Sprint 安排工作；狀態與 Deadline 會同步回 Notion。"
      />

      {tasks.length === 0 ? (
        <section className="section card">
          <EmptyState
            title="目前沒有正式任務"
            description="先從 GitHub 收件匣審核 Issue，或在 Notion 建立任務。"
            actionHref="/inbox"
            actionLabel="前往 GitHub 收件匣"
          />
        </section>
      ) : (
        <TaskBoard tasks={tasks} sprints={sprints} today={taipeiDate()} />
      )}
    </>
  );
}

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
