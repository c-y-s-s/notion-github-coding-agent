import { failure, ok } from "@/lib/http";
import { createNotionTask, updateNotionTask } from "@/lib/notion";
import { adminDb } from "@/lib/supabase";
import { canonicalSprintName } from "@/lib/sprint-rotation";

type Scenario = {
  title: string;
  type: "bug" | "feature" | "chore";
  description: string;
  acceptance: string;
  planning: "draft" | "ready" | "in_progress" | "blocked" | "done";
  agent: "idle" | "failed";
  slot: "current" | "last" | null;
  dayOffset?: number;
};

const scenarios: Scenario[] = [
  { title: "修正 Deadline 工作區空狀態提示", type: "bug", description: "日期區間沒有任務時，空狀態需要說明目前套用的篩選條件。", acceptance: "空狀態顯示日期區間並提供清除篩選操作。", planning: "ready", agent: "idle", slot: "current", dayOffset: 1 },
  { title: "優化 Diff Viewer 大型檔案閱讀體驗", type: "feature", description: "大型 Diff 需要更清楚的檔案區隔與捲動體驗。", acceptance: "大型 Diff 可依檔案摺疊，且不影響 evidence 行號。", planning: "ready", agent: "idle", slot: "current", dayOffset: 4 },
  { title: "補強 GitHub Webhook 去重測試", type: "chore", description: "同一 delivery 重送時不可建立重複事件或任務。", acceptance: "重送相同 delivery ID 時只處理一次。", planning: "in_progress", agent: "idle", slot: "current", dayOffset: 6 },
  { title: "新增 Agent Run 錯誤分類篩選", type: "feature", description: "目前失敗紀錄難以依錯誤原因篩選，且前次執行已失敗。", acceptance: "可依 baseline、retrieval、model、evidence 與 push 錯誤分類。", planning: "blocked", agent: "failed", slot: "current", dayOffset: 2 },
  { title: "DEMO：規劃 Slack 失敗通知", type: "feature", description: "尚在釐清通知對象、頻率與敏感資訊遮罩。", acceptance: "需求確認後才能排入 Sprint。", planning: "draft", agent: "idle", slot: null },
  { title: "DEMO：完成登入錯誤訊息修正", type: "bug", description: "登入失敗時提供可採取行動的錯誤訊息。", acceptance: "錯誤訊息不洩漏帳號是否存在，並通過既有測試。", planning: "done", agent: "idle", slot: "last", dayOffset: 5 },
];

const notionStatus = { draft: "草稿", ready: "可執行", in_progress: "進行中", blocked: "受阻", done: "已完成" } as const;

export async function POST(request: Request) {
  const expected = process.env.INTERNAL_JOB_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return failure("Unauthorized", 401);

  const db = adminDb();
  const { data: project, error: projectError } = await db.from("projects").select("id,default_repository_id,notion_data_source_id").limit(1).maybeSingle();
  if (projectError) return failure(projectError.message, 500);
  if (!project?.notion_data_source_id) return failure("Demo project 尚未設定 Notion Data Source", 409);
  const { data: sprints, error: sprintError } = await db.from("sprints").select("id,name,notion_page_id,start_date,end_date,sprint_window");
  if (sprintError) return failure(sprintError.message, 500);
  const slots = Object.fromEntries((sprints ?? []).map(sprint => [sprint.sprint_window, sprint]));
  if (!slots.current || !slots.last) return failure("缺少 Current 或 Last Sprint", 409);

  for (const sprint of sprints ?? []) {
    const name = canonicalSprintName(sprint.start_date, sprint.end_date);
    if (sprint.name === name) continue;
    await updateNotionTask(sprint.notion_page_id, { Name: { title: [{ text: { content: name } }] } });
    const renamed = await db.from("sprints").update({ name }).eq("id", sprint.id);
    if (renamed.error) return failure(`更新 Sprint 名稱失敗：${renamed.error.message}`, 500);
  }

  const results: Array<{ title: string; action: string }> = [];
  for (const scenario of scenarios) {
    const sprint = scenario.slot ? slots[scenario.slot] : null;
    const deadline = sprint && scenario.dayOffset !== undefined ? addDays(sprint.start_date, scenario.dayOffset) : null;
    const { data: existing } = await db.from("work_items").select("id,notion_page_id,notion_page_url").eq("source", "notion").eq("title", scenario.title).maybeSingle();
    let pageId = existing?.notion_page_id as string | null;
    let pageUrl = existing?.notion_page_url as string | null;
    let action = "updated";
    if (!pageId) {
      const page = await createNotionTask({ dataSourceId: project.notion_data_source_id, title: scenario.title, source: "Notion", deadline });
      pageId = page.id;
      pageUrl = page.url;
      action = "created";
    }
    await updateNotionTask(pageId, {
      Type: { select: { name: scenario.type[0].toUpperCase() + scenario.type.slice(1) } },
      Description: { rich_text: [{ text: { content: scenario.description } }] },
      "Acceptance Criteria": { rich_text: [{ text: { content: scenario.acceptance } }] },
      "Planning Status": { status: { name: notionStatus[scenario.planning] } },
      Deadline: deadline ? { date: { start: deadline } } : { date: null },
      Sprint: { relation: sprint ? [{ id: sprint.notion_page_id }] : [] },
      "Last Synced At": { date: { start: new Date().toISOString() } },
    });
    const row = {
      project_id: project.id,
      repository_id: project.default_repository_id,
      source: "notion" as const,
      type: scenario.type,
      title: scenario.title,
      description: scenario.description,
      acceptance_criteria: scenario.acceptance,
      review_status: "not_required" as const,
      planning_status: scenario.planning,
      agent_status: scenario.agent,
      notion_page_id: pageId,
      notion_page_url: pageUrl,
      deadline,
      sprint_id: sprint?.id ?? null,
    };
    const write = existing?.id
      ? await db.from("work_items").update(row).eq("id", existing.id)
      : await db.from("work_items").insert(row);
    if (write.error) return failure(`${scenario.title}: ${write.error.message}`, 500);
    results.push({ title: scenario.title, action });
  }
  return ok({ results });
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
