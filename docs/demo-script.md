# 六分鐘面試 Demo 腳本

錄影時先在 `.env.local` 設定 `DEMO_RECORDING_MODE=true`，再開啟 `/demo`。此模式會固定 Original Run、Replay、Diff、Evidence 與 Evaluation 畫面，避免錄製途中受到模型延遲或外部服務波動影響；正式模式則讀取 Supabase 中最新的真實 Original Run + Replay lineage。

## 錄影前檢查

- Web 可正常啟動，且 `.env.local` 的 `DEMO_RECORDING_MODE=true`。
- 若不展示即時 Agent 執行，錄影前先停止 Worker，避免背景工作改變畫面。
- `/demo` 頂端顯示「錄影資料模式」，並完整呈現 Original + Exact Replay。
- Notion、GitHub 與 Supabase 的示範資料已預先整理；錄影中不等待 webhook 或模型執行。
- 畫面不顯示 `.env`、token、私人 URL 或通知。
- Run 具備 Baseline、Context、Diff、Evidence 與成本資料。
- Replay 已到終止狀態，不要在錄影中等待模型。
- 執行 `pnpm demo:prepare`，確認 Notion 與 Dashboard 都有草稿、可執行、進行中、受阻、完成等情境。
- 本週 Sprint 的「延續檢視」應顯示「DEMO：延續搜尋效能優化」；上週已完成任務不應出現在延續清單。

## 建議錄影動線

錄影只保留 Dashboard、Notion 與 GitHub 三個分頁。先開 Dashboard `/`，再依序前往 `/tasks`、GitHub Inbox 與 `/demo`；不要開啟環境變數或終端機。

## 0:00–0:45｜今日總覽：先說明問題

**畫面：** Dashboard 今日總覽。

**口白：**「團隊的需求同時來自 Notion 與 GitHub，但不是每一筆工作都能直接交給 Agent。首頁把逾期、待審核與執行失敗集中成可採取行動的清單。」

帶到逾期、GitHub 待審核與 Agent 失敗三種卡片，但不要在這裡執行修改。

## 0:45–1:40｜Sprint 與 Notion 雙向同步

**畫面：** `/tasks` 本週 Sprint，再切到 Notion Task database。

**口白：**「Sprint 會依日期自動輪替，但任務不會被系統偷偷搬動。未完成工作先經過延續預覽；若 Notion 顯示舊資料，可以用重新同步功能，以 Supabase 的規劃資料為準回寫狀態、Deadline 與 Sprint。」

展示可執行、進行中、受阻；再切到 Backlog 展示草稿，最後切上個 Sprint 展示已完成。

## 1:40–2:30｜GitHub Intake 與人工決策

**畫面：** GitHub repository 的 Issue #31、#32，再切 Dashboard GitHub 收件匣。

**口白：**「外部 Issue 不會直接污染內部工作。描述完整的 Issue 可以接受或連結 Notion；缺少重現步驟的 Issue 標記為需要更多資訊。這個決策點刻意保留給人。」

錄影時不要真的按接受，避免改變後續畫面。

## 2:30–3:05｜來源與人工控制

- Notion 管理內部規劃，外部 GitHub Issue 必須先進 Inbox。
- 不是每個 Notion Task 都會成為 GitHub Issue。
- Agent 在人工核准前不能 push。

## 3:05–3:35｜Context Retrieval

- 程式碼依 commit 建立 path、hash 與 embedding 索引，Supabase 不保存原文。
- Hybrid 結合 Keyword 與 Semantic rank。
- Production Context 排除 Evaluation fixture 與產出。
- Embedding 失敗會降級為 Keyword 並留下紀錄。

## 3:35–4:20｜Patch 流程

- 修改前執行 install、lint、typecheck、test Baseline。
- 模型最多替換 3 個完整檔案。
- 每次修改後重跑 Checks，Error Analysis 最多重試 3 次。
- 真正審核的是 Git 產生且通過檢查的 Diff，不是模型文字。

## 4:20–4:50｜Evidence Gate

- Patch 必須引用檔案、行號、原文與理由。
- Worker 對送入模型的 exact Context 驗證引用。
- 模型不能宣告自己的 Evidence 可信。

## 4:50–5:30｜Exact Replay

- Replay 固定 Task、commit、Context paths 與 hashes。
- 保留案例中 Prompt v1 通過，v2 因錯誤行號被 Gate 阻擋。
- 這證明更強的 Prompt 措辭不必然更好。

## 5:30–6:00｜Evaluation 與取捨

- Agent Benchmark 評估 Patch、Safe Refusal、Hidden Tests 與 Regression。
- Retrieval Dataset 使用明確 ground truth 排名 20–21 個檔案。
- Keyword 與 Hybrid 品質相同，但 Hybrid 延遲較高。
- 結論不是「Embedding 一定比較好」，而是保存證據供工程決策。

## 備援與說法限制

若 Demo 頁失敗，依序改用 Original Run Detail、Replay child、[E2E 紀錄](e2e-agent-replay.md)，最後才使用 README 架構圖。

不要宣稱 Hybrid 更準、Replay 輸出完全 deterministic、通過的 Run 已可上 production、12-case 具有統計代表性，或 Agent 會自動建立／合併 PR。
