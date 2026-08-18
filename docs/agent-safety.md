# Agent 安全設計

外部 Issue 與 Notion 內容一律視為不受信任資料。模型只提出修改，不能授權自己執行、核准或推送。

## 主要威脅與控制

| 威脅 | 範例 | 控制 |
| --- | --- | --- |
| Prompt injection | Issue 要求忽略政策或洩漏 secrets | 固定 system policy；Task 只當資料 |
| 路徑逃逸 | 修改 `../`、credential 或敏感檔 | 正規化 worktree 路徑並套用封鎖規則 |
| 過大修改 | 小 Task 被擴成全面重構 | 最多 3 個既有檔案、最多 3 次嘗試 |
| 假 Evidence | 引用不存在或無關程式碼 | 驗證檔案、1-based 行號與原文 |
| 原始狀態失敗 | 把既有紅燈誤認成 AI 造成 | 模型修改前 Baseline 必須通過 |
| 過期核准 | 審核後 main 已更新 | Push 前重新比較 remote base SHA |
| 任意指令 | 模型要求執行危險 shell | 模型不能選指令，只跑預先設定 Checks |
| 重複處理 | 多個 Worker 同時 claim | Active Run 唯一限制與 lease |
| 原始碼外洩 | Cloud vector index 保存全文 | 只保存 path、hash、vector |

## 分層防護

推論前，repository 與指令只能來自可信任設定；Context 只包含允許的 tracked files，並排除 Evaluation fixture 與產出。Baseline 失敗會直接停止。

模型以 schema 回傳 decision、summary、risk、plan、Evidence 與完整檔案替換。結構化輸出可降低歧義，但不是安全邊界，所有欄位仍由 Worker 驗證。

推論後，Worker 會：

- 證明每個路徑都在 worktree 內；
- 比較要求修改與 Git 實際修改的檔案；
- 阻擋敏感、未追蹤、刪除或超量變更；
- 對實際送入模型的 Context 驗證 Evidence；
- 每次嘗試後重跑所有 Checks；
- 從 Git 產生 review diff，不採信模型描述。

## 人工核准

`awaiting_approval` 只代表自動 Gate 通過，不代表 production-ready。Reviewer 仍須檢查需求理解、Evidence、diff 範圍、測試覆蓋與風險。

Approve 只授權該 Run 的 exact diff，不授權不同 commit、建立 PR 或 merge。Base SHA 改變時，舊核准立即失效。

## Replay、資料與失敗行為

Exact Replay 固定 Task snapshot、commit、Context paths 與 hashes；任何內容無法重建時 fail closed。Latest Main Rerun 改變了程式碼輸入，不能宣稱為受控 Prompt 實驗。

`.env.local`、token、Webhook Secret、SSH material 與 service role key 不得進入 Context 或 Artifact。失敗與 Reject Run 保留供稽核，只清除 worktree 或放棄的 branch。

Path、Evidence、Baseline、Scope 與 stale-base Gate 都 fail closed。唯一降級是 Embedding 失敗時改用相同允許檔案集合的 Keyword Retrieval，並記錄錯誤。

## V1 範圍外

- 多租戶與 per-user authorization；
- 對惡意 build script 的完整 sandbox；
- 自動 PR、review、merge 或 deployment；
- 證明通過測試的 AI 程式碼必然語意正確。

因此本系統是受控的本機工作流程，不是自主 production coding service。
