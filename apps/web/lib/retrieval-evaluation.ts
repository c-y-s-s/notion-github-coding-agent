import report from "../../../workers/agent/eval-results/retrieval-latest.json";

export function getRetrievalEvaluation() { return report; }

export function retrievalVerdict() {
  const keyword = report.summary.keyword;
  const hybrid = report.summary.hybrid;
  const qualityDelta = hybrid.recall_at_k - keyword.recall_at_k;
  if (qualityDelta > 0) return { tone: "positive", title: "Hybrid 提高檢索召回率", detail: `Recall@K 提升 ${percent(qualityDelta)}。` };
  if (qualityDelta < 0) return { tone: "negative", title: "Hybrid 檢索品質退步", detail: `Recall@K 下降 ${percent(Math.abs(qualityDelta))}。` };
  return { tone: "neutral", title: "品質持平，Hybrid 增加延遲", detail: "目前小型 fixture 中 Keyword 已達到 100% Recall，沒有證據支持全面改用 embedding。" };
}

function percent(value: number) { return `${Math.round(value * 100)}%`; }
