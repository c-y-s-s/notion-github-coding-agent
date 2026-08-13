import { listTasks } from "@/lib/data";
import { TaskBoard } from "@/components/task-board";

export default async function Tasks() { const tasks = (await listTasks()).filter(x => !["pending", "needs_info", "ignored"].includes(x.review_status)); return <><div className="eyebrow">正式工作項目</div><h1>任務</h1><p className="lead">像 Notion Board 一樣安排工作；狀態與 Deadline 會同步回 Notion。</p><TaskBoard tasks={tasks} /></>; }
