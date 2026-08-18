# Agent 評估設計

系統使用三層互補評估：真實 Run 的人工標記、版本化 Agent Benchmark，以及獨立的 Retrieval Evaluation。

## 人工評估

Dashboard 可標記已完成 Run 的分析正確性、Patch 可用性與主要失敗類別。真實 Task 有代表性，但標記主觀且輸入會改變，因此不能單獨作為可重現比較。

## 版本化 Benchmark

`workers/agent/evals/dataset.json` 目前為 v1.1.0：

| 類別 | 數量 | 目的 |
| --- | ---: | --- |
| Patch | 5 | 小型確定性 bug，包含雙檔修改與 hidden acceptance checks |
| Safety | 5 | Migration、auth bypass、dependency、CI、prompt injection 拒絕 |
| Quality | 2 | 資訊不足與過大重構拒絕 |

每個案例在暫存 Git repository 執行。模型只看到 tracked fixture，修改完成後才注入 hidden test。Patch 案例必須同時通過 decision、risk、exact changed files、policy、repository checks 與 acceptance check。Refusal 案例必須不修改檔案並以正確理由拒絕。

主要指標：

- `pass_rate`：所有 grader 都通過的案例比例；
- `patch_success_rate`：Patch 案例的嚴格成功率；
- `safe_refusal_rate`：危險或資訊不足案例的正確拒絕率。

## 執行方式

在 `workers/agent/` 啟用 virtualenv：

```bash
# 只驗證 Dataset，不呼叫模型
python -m agent_worker.eval_runner --validate-only

# 執行指定案例
python -m agent_worker.eval_runner --case patch-normalize-email

# 指定模型、Prompt 並保存 Report
python -m agent_worker.eval_runner \
  --model gpt-5-mini \
  --prompt-version v2 \
  --output eval-results/latest.json

# 僅比較 Retrieval
python -m agent_worker.retrieval_eval
```

`agent-eval` 與 `retrieval-eval` 是等價 entrypoint。Dashboard 也能排程完整 Dataset 或單一案例，但必須保持 Worker 運行至所有 case 終止。

## 比較規則

比較模型時必須固定 Dataset、cases 與 Prompt；比較 Prompt 時必須固定 Dataset、cases 與 model。比較 Retrieval 時必須固定 corpus version 與 K。Latency 比較最好使用相同硬體。

必須同時顯示成功數與比例。12 個案例中一個結果會改變總成功率 8.3 個百分點，只列百分比容易誤導。

Exact Replay 適合研究單一真實 Task：它有真實性但 coverage 弱。Benchmark 提供受控 coverage，但 fixture 比 production 簡單；兩者不能互相取代。

## Retrieval 評估

Retrieval Dataset 1.0.0 對同一 fixture corpus 比較 Keyword 與 Hybrid，使用明確的 `retrieval_files` ground truth，回報 Recall@K、Precision@K、MRR、Context size 與 latency。

Policy-only refusal 與刻意資訊不足案例沒有客觀 repository target，因此不硬指定 ground truth。Production index 會排除 Evaluation corpus 與 generated reports。

Retrieval 指標不能直接推論 Patch 成功率，因為加入模型會多一個混雜變數。目前 Keyword 與 Hybrid 品質相同，而 Hybrid 較慢，所以沒有證據宣稱 Embedding 一定更好。

## 本機模型

`ollama:` 前綴使用 Ollama structured output。它只允許 Evaluation，不能建立正式 Task Patch。16 GB M2 的既有 smoke test 使用 0.5B、1.5B、3B 模型、2,048-token Context、單一 loaded model 與單一 parallel request。

三個模型在兩案例 smoke test 都為 0/2。這是部分結果，不是完整 Dataset 分數；它支持維持 Evaluation-only Gate，但不能推論所有 local model 都不可用。

## 新增案例

1. 在 `evals/fixtures/` 建立最小 fixture repository。
2. 在 Dataset 定義 Task、預期 decision、risk 與 exact paths。
3. Patch case 加入模型執行後才注入的 hidden acceptance check。
4. 只有存在客觀程式碼目標時才設定 `retrieval_files`。
5. 執行 `--validate-only`、新 case 與完整 Dataset。
6. Grading 改變時提升 Agent Dataset version；corpus 或 relevance 改變時提升 Retrieval Dataset version。

## 限制

- 12 cases 無法估計 production reliability 或罕見失敗率。
- Fixture 比真實 repository 小且乾淨。
- Hidden tests 只驗證選定行為，不保證維護性。
- 人工 label 可能有 reviewer disagreement。
- 模型 latency 與成本會隨 provider、時間與硬體改變。

有效的負面結果必須保留。刪除失敗會造成 selection bias，也會削弱 regression gate 的可信度。
