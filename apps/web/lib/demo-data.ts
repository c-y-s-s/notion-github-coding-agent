import type { AgentRun, WorkItem } from "./types";

export const demoTasks: WorkItem[] = [
  { id: "demo-1", source: "notion", type: "bug", title: "搜尋結果未清除舊篩選條件", description: "切換專案後仍保留上一個 query。", acceptance_criteria: "切換 project 後清空 filter 並通過現有測試。", review_status: "not_required", planning_status: "ready", agent_status: "awaiting_approval", deadline: null, sprint_id: null, github_issue_number: 42, github_issue_url: "https://github.com/example/repo/issues/42", notion_page_url: "https://notion.so/demo", updated_at: new Date().toISOString() },
  { id: "demo-2", source: "github", type: "bug", title: "缺少設定檔時 CLI 仍回傳成功狀態", description: "找不到設定檔時，CLI 應回傳非零的結束代碼。", acceptance_criteria: null, review_status: "pending", planning_status: "draft", agent_status: "idle", deadline: null, sprint_id: null, github_issue_number: 51, github_issue_url: "https://github.com/example/repo/issues/51", notion_page_url: null, updated_at: new Date().toISOString() }
];
export const demoRuns: AgentRun[] = [{ id: "run-demo", work_item_id: "demo-1", status: "awaiting_approval", risk_level: "low", branch_name: "agent/demo-1-search-filter", started_at: new Date().toISOString(), finished_at: null }];
