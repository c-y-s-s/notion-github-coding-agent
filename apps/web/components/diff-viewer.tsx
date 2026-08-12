export function DiffViewer({ content }: { content?: string | null }) {
  if (!content) return <p className="muted">目前沒有產生程式碼 Diff。</p>;
  return <div className="diff-viewer" role="region" aria-label="程式碼修改差異">
    {content.split("\n").map((line, index) => {
      const kind = line.startsWith("+++") || line.startsWith("---") ? "file" : line.startsWith("+") ? "added" : line.startsWith("-") ? "removed" : line.startsWith("@@") ? "hunk" : line.startsWith("diff ") || line.startsWith("index ") ? "meta" : "context";
      return <div className={`diff-line ${kind}`} key={index}><span className="diff-marker">{kind === "added" ? "+" : kind === "removed" ? "−" : ""}</span><code>{line || " "}</code></div>;
    })}
  </div>;
}
