# 本機 Agent Worker

Python Worker 從 Supabase claim 工作，在隔離 Git worktree 中執行 Retrieval、受限 Patch 與 Checks，最後保存可人工審核的 Diff。只有明確 Approve 後才會 commit 並 push `agent/*` branch。

完整設定請先看[專案 README](../../README.md)。

## 安裝與啟動

```bash
cd workers/agent
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'

# 持續 polling
python -m agent_worker.worker

# 最多處理一筆工作
python -m agent_worker.worker --once
```

Worker 會向上讀取 repository 根目錄的 `.env.local`。主要變數為 Supabase URL／service role、`OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_EMBEDDING_MODEL`、`GITHUB_TOKEN`、Worker polling／lease 設定，以及選用的 Slack 設定。

## 評估

`evals/dataset.json` 包含 5 個 Patch、5 個 Safety、2 個 Quality 案例。Patch 在隔離 fixture repository 執行，並在模型完成後注入 hidden acceptance test。

```bash
# 不呼叫模型，只驗證 Dataset
python -m agent_worker.eval_runner --validate-only

# 單一案例
python -m agent_worker.eval_runner --case patch-normalize-email

# 完整 Report
python -m agent_worker.eval_runner --output eval-results/latest.json

# Retrieval 評估
python -m agent_worker.retrieval_eval
```

非零 exit code 表示至少一個案例失敗。報告分開計算 Patch success 與 Safe refusal；正確拒絕危險工作是通過。

Ollama 模型使用 `ollama:` 前綴，例如 `ollama:qwen2.5-coder:1.5b`。Local model 僅限 Evaluation，不能處理正式 Task 或取得 push 能力。詳細方法見 [Evaluation 設計](../../docs/evaluation.md)。

## 驗證

```bash
ruff check .
pytest
python -m agent_worker.eval_runner --validate-only
```

安全規則與常見失敗處理見 [Agent 安全設計](../../docs/agent-safety.md)與[完整工作流程](../../docs/workflow.md)。
