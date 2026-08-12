export function StatusBadge({ value }: { value: string }) {
  const tone = /failed|blocked|ignored|rejected/.test(value) ? "red" : /pending|queued|awaiting|draft/.test(value) ? "amber" : "green";
  return <span className={`badge ${tone}`}>{value.replaceAll("_", " ")}</span>;
}
