export function StatusBadge({ value }: { value: string }) {
  const tone = /failed|blocked|ignored|rejected|cancelled/.test(value) ? "red" : /pending|queued|awaiting|draft/.test(value) ? "amber" : "green";
  const labels: Record<string, string> = {
    not_required: "不需審核", pending: "待審核", accepted: "已接受", linked: "已連結",
    needs_info: "待補資訊", ignored: "已忽略", draft: "草稿", ready: "可執行",
    in_progress: "進行中", blocked: "受阻", done: "已完成", idle: "尚未分析",
    queued: "等待中", preparing: "準備修正", awaiting_approval: "待核准", approved: "已核准",
    rejected: "已拒絕", pushing: "推送中", branch_ready: "分支已就緒", running: "執行中",
    succeeded: "成功", failed: "失敗", cancelled: "已取消", low: "低風險",
    medium: "中風險", high: "高風險", notion: "Notion", github: "GitHub",
    completed: "已完成", open: "開啟", closed: "已關閉", merged: "已合併",
  };
  return <span className={`badge ${tone}`}>{labels[value] ?? value.replaceAll("_", " ")}</span>;
}
