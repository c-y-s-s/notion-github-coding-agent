# 完整工作流程

GitHub Webhook 是即時同步入口。Vercel Cron 每天 16:05 UTC（台北時間隔日 00:05）執行 reconciliation，補回漏送的 Issue／PR 狀態，並處理最多 10 筆待回寫 Notion 的工作。Cron 是安全網，不取代 Webhook。

同一個每日 Cron 也會先執行 Sprint 輪替。系統以台北日期與 Notion 的 Start Date／End Date 計算 `Future → Next → Current → Last → Past`，同步更新 Notion 的 `Window`、`Status` 與 Supabase。每次至少保留一個 Next 與一個 Future Sprint；缺少時會在 Notion 建立下一個七日週期。輪替使用資料庫鎖避免重複執行，15 分鐘後會釋放失效鎖。

## Notion 來源

1. Notion Webhook 匯入 Task，但不自動建立 GitHub Issue。
2. 使用者在 Task Detail 明確選擇建立 Issue。
3. 系統保存 GitHub Issue 身分並連結原 Task。
4. Notion 頁面刪除時只標記來源已刪除，不刪除稽核歷史。

Sprint、Deadline 與 Agent Run 彼此獨立；規劃狀態改變不會自動觸發程式碼修改。

## 延續上個 Sprint 的未完成任務

進入「任務」頁面的「本週 Sprint」，系統會顯示「Sprint 延續檢視」。這是預覽與選取介面，不會在日期切換時自動搬動任務：勾選後按下「將選取的任務延續到本週」，才會把任務的 Sprint 改為 Current，並將 Deadline 更新為本週 Sprint 的結束日。

系統只會列出上個 Sprint 中狀態為「待處理」或「進行中」的 Notion 任務。已完成、Backlog、受阻、Agent 執行失敗、缺少 Notion 頁面，以及 GitHub 待審核項目都不會被自動納入，避免一次操作改壞不同工作流程的資料。

若 Supabase 的本週任務已正確，但 Notion 的狀態、Deadline 或 Sprint relation 仍是舊值，可在「任務 → 本週 Sprint」按下「重新同步本週至 Notion」。系統會以 Supabase 為準逐筆回寫，只處理有 Notion 頁面的本週 Notion 任務，並分別回報成功、略過與失敗筆數。

## GitHub 來源

外部 Issue 必須先進 Inbox：

| 決定 | 結果 |
| --- | --- |
| Accept | 建立 Notion sync job，轉為正式內部工作 |
| Link | 連結使用者選取的既有 Notion Task |
| Needs Info | 保持等待，不進入正式工作 |
| Ignore | 封存；後續更新不會自動重新出現 |

Issue 文字是不受信任的輸入，不能覆寫 Worker policy。

## Agent 修改狀態

```mermaid
stateDiagram-v2
  [*] --> queued: Prepare Patch
  queued --> running: Worker claim
  running --> failed: Gate 或 Check 失敗
  running --> awaiting_approval: 驗證完成
  awaiting_approval --> rejected: Reject
  awaiting_approval --> approved: Approve
  approved --> pushing
  pushing --> succeeded: Branch pushed
  pushing --> queued: STALE_BASE replacement
```

執行順序：

1. Snapshot Task 與 repository 設定。
2. 解析 remote default branch commit，建立隔離 worktree。
3. 執行 install、lint、typecheck、test baseline。
4. 以 Hybrid Retrieval 選取 Context；Embedding 失敗時降級為 Keyword。
5. 模型回傳結構化決定、計畫、risk、Evidence 與最多 3 個檔案替換。
6. 驗證路徑與實際 changed files。
7. 執行 Checks 與 Evidence Gate；最多嘗試 3 次。
8. 保存 diff 等待核准，或保存終止失敗。

Approve 只適用於指定 Run。Push 前若 remote SHA 已改變，系統產生 `STALE_BASE` 並從最新 commit 建立替代 Run，不會偷偷 rebase 已審核的 diff。

## PR 與同步完成

Worker push `agent/*` 後，由使用者手動建立與合併 PR。PR Webhook 更新 Dashboard；只有 merged 才代表工程工作完成，closed 不等於 done。

同步失敗會保存在 `sync_jobs`，可從 `/sync` 重試，或以 `INTERNAL_JOB_SECRET` 呼叫內部處理 API。所有重試都必須依穩定外部 ID 保持冪等。

## 常見錯誤

| 錯誤碼 | 意義 | 處理方式 |
| --- | --- | --- |
| `BASELINE_FAILED` | 修改前 repository 已失敗 | 修正環境或設定後建立新 Run |
| `PATCH_NOT_SAFE` | 模型或 policy 拒絕工作 | 縮小或澄清範圍 |
| `PATCH_EVIDENCE_MISSING` | 引用與 Context 不符 | 檢查 Prompt／結果，不可繞過 |
| `PATCH_SCOPE_VIOLATION` | 修改超過政策範圍 | 拆小 Task 或人工處理 |
| `NO_CHANGES` | 沒有有效 diff | 補充需求後重跑 |
| `STALE_BASE` | 核准後 main 已改變 | 審核新建立的替代 Run |

延伸閱讀：[架構](architecture.md)、[資料庫](database.md)、[Agent 安全](agent-safety.md)。
