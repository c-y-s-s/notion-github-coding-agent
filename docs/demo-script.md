# 五分鐘面試 Demo 腳本

開啟 `/demo`。頁面讀取 Supabase 中最新的真實 Original Run + Replay lineage，不產生展示專用假資料。

## 錄影前檢查

- Web、Worker 與 provider 連線正常。
- `/demo` 已選到預期的 Original + Exact Replay。
- 畫面不顯示 `.env`、token、私人 URL 或通知。
- Run 具備 Baseline、Context、Diff、Evidence 與成本資料。
- Replay 已到終止狀態，不要在錄影中等待模型。

## 0:00–0:40｜來源與人工控制

- Notion 管理內部規劃，外部 GitHub Issue 必須先進 Inbox。
- 不是每個 Notion Task 都會成為 GitHub Issue。
- Agent 在人工核准前不能 push。

## 0:40–1:25｜Context Retrieval

- 程式碼依 commit 建立 path、hash 與 embedding 索引，Supabase 不保存原文。
- Hybrid 結合 Keyword 與 Semantic rank。
- Production Context 排除 Evaluation fixture 與產出。
- Embedding 失敗會降級為 Keyword 並留下紀錄。

## 1:25–2:25｜Patch 流程

- 修改前執行 install、lint、typecheck、test Baseline。
- 模型最多替換 3 個完整檔案。
- 每次修改後重跑 Checks，Error Analysis 最多重試 3 次。
- 真正審核的是 Git 產生且通過檢查的 Diff，不是模型文字。

## 2:25–3:10｜Evidence Gate

- Patch 必須引用檔案、行號、原文與理由。
- Worker 對送入模型的 exact Context 驗證引用。
- 模型不能宣告自己的 Evidence 可信。

## 3:10–4:15｜Exact Replay

- Replay 固定 Task、commit、Context paths 與 hashes。
- 保留案例中 Prompt v1 通過，v2 因錯誤行號被 Gate 阻擋。
- 這證明更強的 Prompt 措辭不必然更好。

## 4:15–5:00｜Evaluation 與取捨

- Agent Benchmark 評估 Patch、Safe Refusal、Hidden Tests 與 Regression。
- Retrieval Dataset 使用明確 ground truth 排名 20–21 個檔案。
- Keyword 與 Hybrid 品質相同，但 Hybrid 延遲較高。
- 結論不是「Embedding 一定比較好」，而是保存證據供工程決策。

## 備援與說法限制

若 Demo 頁失敗，依序改用 Original Run Detail、Replay child、[E2E 紀錄](e2e-agent-replay.md)，最後才使用 README 架構圖。

不要宣稱 Hybrid 更準、Replay 輸出完全 deterministic、通過的 Run 已可上 production、12-case 具有統計代表性，或 Agent 會自動建立／合併 PR。
