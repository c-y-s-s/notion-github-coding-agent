# Agent 重播端對端驗證紀錄

2026-08-13 以 Task「[E2E] retrying 狀態需顯示中文與黃色」在 commit `a8405392fc51c779d9a8bcb6ae7204fe0b0de2a6` 驗證。

| | Original | Exact Replay |
| --- | --- | --- |
| Run | `caddc399` | `c7a42341` |
| Prompt | v1 | v2 |
| Base commit | `a840539` | `a840539` |
| Context | 6 個 path，SHA-256 全部相同 | 6 個 path，SHA-256 全部相同 |
| Baseline | lint、typecheck、test 通過 | lint、typecheck、test 通過 |
| Attempts | 1 | 1 |
| 結果 | awaiting approval，後續人工 Reject | Evidence Gate 安全失敗 |
| Input／Output tokens | 20,097／1,606 | 20,128／1,683 |
| 預估成本 | $0.029733 | $0.030226 |

## 目的與程序

此實驗驗證 Exact Replay 能重建可控制的真實 Run 輸入，並確認 Evidence Gate fail closed；它不證明模型輸出逐字 deterministic。

1. 完成支援 Replay metadata 的 Original Run。
2. 確認 Task snapshot、base SHA 與 Context manifest 存在。
3. 從 Run Detail 以 Prompt v2 建立 Exact Replay。
4. 保持 Worker 運行至 child Run 終止。
5. 比較 lineage、mode、commit、manifest、Checks、tokens、cost 與 outcome。
6. Reject 任何 awaiting-approval artifact，避免驗證過程 push branch。

## 結果

Original 產生正確的單檔 `StatusBadge` patch 與兩筆通過驗證的 Evidence。Replay 重現相同 Task、commit 與 Context，但 Prompt v2 把檔案相對行號當成全域 Context 行號，兩筆引用都失敗，因此以 `PATCH_EVIDENCE_MISSING` 阻擋。

這只支持三個窄幅結論：

1. Exact Replay 保留了 Task、commit 與 Context 輸入。
2. Prompt 改變了此 Task 的結果，成本也略增。
3. Evidence Gate 阻止不可驗證 Patch 進入人工核准。

它不能證明 v1 普遍優於 v2、推論 deterministic，或系統已具 production reliability。

## 額外發現：Retrieval 污染

Original Run 發現 Evaluation fixtures 與 report 佔據 6 個 Context slot 中的 4 個。修正包含兩層：

- Index 時排除 `workers/agent/evals/` 與 `workers/agent/eval-results/`；
- Semantic 結果與目前允許的文件集合取交集，避免舊 vector 回流。

驗證過程沒有建立 branch 或 PR；Original 被 Reject，Replay 在核准前失敗。

## 重新驗證清單

- 執行 Web 與 Worker tests；
- 確認新 Original 保存 Task 與 Context snapshot；
- 建立 Exact Replay 並在 `/demo` 確認 lineage；
- 比較每個 manifest hash，不只比較 path 數量；
- 確認錯誤 Evidence 無法進入 `awaiting_approval`；
- 確認 Reject／failed Run 沒有留下 remote branch 或 PR。
