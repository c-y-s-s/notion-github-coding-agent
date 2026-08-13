export function statusTone(value) {
  return /failed|blocked|rejected/.test(value) ? "red" : /queued|pending/.test(value) ? "amber" : "green";
}

export function statusLabel(value) {
  return { cancelled: "已取消", failed: "失敗", succeeded: "成功" }[value] ?? value;
}
