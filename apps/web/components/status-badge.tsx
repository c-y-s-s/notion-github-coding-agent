export function StatusBadge({ value }: { value: string }) {
  const isIdle = value === "idle";
  const isPaused = value === "paused";
  const tone = /failed|blocked|ignored|rejected|cancelled|notion_deleted|incorrect|unusable/.test(value)
    ? "red"
    : /pending|queued|awaiting|draft|running|preparing|pushing/.test(value)
      ? "amber"
      : isIdle
        ? "gray"
        : isPaused
          ? "purple"
          : "green";
  const labels: Record<string, string> = {
    not_required: "不需審核", pending: "待審核", accepted: "已接受", linked: "已連結",
    needs_info: "待補資訊", ignored: "已忽略", draft: "草稿", ready: "可執行",
    in_progress: "進行中", blocked: "受阻", done: "已完成", idle: "待命",
    queued: "等待中", preparing: "準備修正", awaiting_approval: "待核准", approved: "已核准",
    rejected: "已拒絕", pushing: "推送中", branch_ready: "分支已就緒", running: "執行中",
    succeeded: "成功", failed: "失敗", cancelled: "已取消", low: "低風險",
    medium: "中風險", high: "高風險", notion: "Notion", github: "GitHub",
    completed: "已完成", open: "開啟", closed: "已關閉", merged: "已合併",
    patch_ready: "可準備修正", patch_blocked: "禁止修正",
    no_changes: "無需修改", stale_base: "Diff 已過期", correct: "正確", incorrect: "不正確", usable: "可用", unusable: "不可用",
    notion_deleted: "Notion 已刪除",
    planned: "已規劃", active: "進行中",
    paused: "已暫停",
  };
  return <span className={`badge ${tone}`} style={
    isPaused
      ? { backgroundColor: "#f3e8ff", borderColor: "#d8b4fe", color: "#7e22ce" }
      : isIdle
        ? { backgroundColor: "#e5e7eb", borderColor: "#d1d5db", color: "#4b5563" }
        : undefined
  }>{labels[value] ?? value.replaceAll("_", " ")}</span>;
}
