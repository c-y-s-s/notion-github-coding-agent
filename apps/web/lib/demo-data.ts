import type { AgentRun, WorkItem } from "./types";

export const demoTasks: WorkItem[] = [
  { id: "demo-1", source: "notion", type: "bug", title: "搜尋結果未清除舊篩選條件", description: "切換專案後仍保留上一個 query。", acceptance_criteria: "切換 project 後清空 filter 並通過現有測試。", review_status: "not_required", planning_status: "ready", agent_status: "awaiting_approval", deadline: null, sprint_id: null, github_issue_number: 42, github_issue_url: "https://github.com/example/repo/issues/42", notion_page_url: "https://notion.so/demo", updated_at: new Date().toISOString() },
  { id: "demo-2", source: "github", type: "bug", title: "缺少設定檔時 CLI 仍回傳成功狀態", description: "找不到設定檔時，CLI 應回傳非零的結束代碼。", acceptance_criteria: null, review_status: "pending", planning_status: "draft", agent_status: "idle", deadline: null, sprint_id: null, github_issue_number: 51, github_issue_url: "https://github.com/example/repo/issues/51", notion_page_url: null, updated_at: new Date().toISOString() }
];
export const demoRuns: AgentRun[] = [{ id: "run-demo", work_item_id: "demo-1", status: "awaiting_approval", risk_level: "low", branch_name: "agent/demo-1-search-filter", started_at: new Date().toISOString(), finished_at: null }];

export function getRecordingDemoStory() {
  const originalId = "demo-original-v1";
  const replayId = "demo-replay-v2";
  const task = { ...demoTasks[0], id: "demo-recording-task", title: "切換專案後應清除舊搜尋條件", description: "使用者切換專案後，畫面仍套用上一個專案的 query，導致搜尋結果不正確。", acceptance_criteria: "切換 project 時清空 filter，並通過 lint、typecheck 與 test。" };
  const original = { id: originalId, work_item_id: task.id, status: "awaiting_approval", model: "gpt-5-mini", prompt_version: "v1", base_commit_sha: "a8405392fc51c779d9a8bcb6ae7204fe0b0de2a6", attempt_number: 2, risk_level: "low", error_code: null, token_usage: { totals: { input_tokens: 12840, output_tokens: 1180, total_tokens: 14020 } } };
  const replay = { id: replayId, work_item_id: task.id, parent_run_id: originalId, replay_mode: "exact", status: "failed", model: "gpt-5-mini", prompt_version: "v2", base_commit_sha: original.base_commit_sha, attempt_number: 1, risk_level: "low", error_code: "PATCH_EVIDENCE_MISSING", token_usage: { totals: { input_tokens: 12910, output_tokens: 1215, total_tokens: 14125 } } };
  const analysis = JSON.stringify({ summary: "問題來自專案切換時只更新 projectId，沒有重設既有搜尋條件。修改事件處理函式即可，不需要改動 API 或資料模型。", complexity: "small", risk_level: "low", can_prepare_patch: true, proposed_changes: ["切換專案時將搜尋條件重設為空字串", "保留同一專案內的搜尋行為"], acceptance_checks: ["切換專案後 query 為空", "lint、typecheck、test 全部通過"], risk_reasons: ["修改集中在單一 UI state handler", "不影響 API 與資料庫"], related_files: ["apps/web/components/task-board.tsx", "apps/web/lib/today-actions.test.ts"], evidence: [{ path: "apps/web/components/task-board.tsx", line_start: 48, line_end: 51, quote: "setProjectId(nextProjectId);\nrefreshTasks();", reason: "切換 project 時沒有清除 query。", verified: true }] });
  const replayAnalysis = JSON.stringify({ summary: "Replay 找到相同修改位置，但引用的行號與 Exact Context 不一致。", complexity: "small", risk_level: "low", can_prepare_patch: true, proposed_changes: ["在 project change handler 清除 query"], acceptance_checks: ["切換專案後 query 為空"], evidence: [{ path: "apps/web/components/task-board.tsx", line_start: 81, line_end: 84, quote: "setProjectId(nextProjectId);", reason: "宣稱是切換處理函式，但行號不符。", verified: false }] });
  const makeSteps = (runId: string, failedEvidence = false) => [
    [1, "inspect", "completed", 0], [2, "baseline", "completed", 0], [3, "plan", "completed", 1], [4, "edit", "completed", 1], [5, "test", "completed", 1], [6, "edit", "completed", 2], [7, "test", "completed", 2], [8, "review", failedEvidence ? "failed" : "completed", failedEvidence ? 1 : 2],
  ].map(([sequence, step_type, status, attempt_number]) => ({ agent_run_id: runId, sequence, step_type, status, attempt_number }));
  return { recordingMode: true, original, replay, task, runs: [original, replay], steps: [...makeSteps(originalId), ...makeSteps(replayId, true)], artifacts: [
    { agent_run_id: originalId, type: "analysis", content: analysis, metadata: { retrieval: { method: "hybrid_embedding", duration_ms: 842 }, context_files: ["apps/web/components/task-board.tsx", "apps/web/lib/today-actions.ts", "apps/web/lib/today-actions.test.ts", "apps/web/components/ui.tsx"], context_chars: 11842 } },
    { agent_run_id: originalId, type: "diff", content: "diff --git a/apps/web/components/task-board.tsx b/apps/web/components/task-board.tsx\n@@ -48,2 +48,3 @@\n setProjectId(nextProjectId);\n+setQuery(\"\");\n refreshTasks();", metadata: { verified: true } },
    { agent_run_id: replayId, type: "analysis", content: replayAnalysis, metadata: {} },
  ] };
}
