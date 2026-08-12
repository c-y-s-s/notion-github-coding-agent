import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { StatusBadge } from "@/components/status-badge";
import { getTaskDetail } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/supabase";

export default async function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configured = hasSupabaseEnv();
  const { task, pullRequests, latestRun, artifacts } = await getTaskDetail(id);
  if (!task) notFound();

  const analysis = artifacts.find(artifact => artifact.type === "analysis");
  const diff = artifacts.find(artifact => artifact.type === "diff");
  const testLog = artifacts.find(artifact => artifact.type === "test_log");
  const activeRun = latestRun && ["queued", "running", "awaiting_approval", "approved", "pushing"].includes(latestRun.status);

  return <>
    <div className="eyebrow">任務詳情</div>
    <h1>{task.title}</h1>
    <div className="actions detail-status"><StatusBadge value={task.source} /><StatusBadge value={task.planning_status} /><StatusBadge value={task.agent_status} /></div>
    {!configured && <div className="notice">目前為示範模式。設定 Supabase 後即可建立 Issue 或執行程式碼分析。</div>}

    <div className="split section">
      <section className="card">
        <h2>需求說明</h2>
        <p>{task.description || "尚未提供需求說明。"}</p>
        <h2>驗收條件</h2>
        <p className="muted">{task.acceptance_criteria || "尚未提供驗收條件。"}</p>
        <div className="actions">
          {task.notion_page_url && <a className="button secondary" href={task.notion_page_url} target="_blank" rel="noreferrer">開啟 Notion</a>}
          {task.github_issue_url && <a className="button secondary" href={task.github_issue_url} target="_blank" rel="noreferrer">開啟 GitHub Issue</a>}
          {!task.github_issue_number && task.source === "notion" && <ActionButton endpoint={`/api/tasks/${task.id}/create-github-issue`} label="建立 GitHub Issue" tone="secondary" disabled={!configured} />}
          {!activeRun && task.planning_status !== "done" && <ActionButton endpoint={`/api/tasks/${task.id}/prepare-patch`} label="分析並準備修正" disabled={!configured} />}
        </div>
      </section>

      <section className="card">
        <h2>最近一次 Agent 執行</h2>
        {latestRun ? <>
          <p><StatusBadge value={latestRun.status} /> {latestRun.risk_level && <StatusBadge value={latestRun.risk_level} />}</p>
          <p className="muted">模型：{latestRun.model}<br />分支：{latestRun.branch_name ?? "尚未建立"}</p>
          {latestRun.error_message && <p className="error-text">{latestRun.error_message}</p>}
          <Link className="button secondary" href={`/runs/${latestRun.id}`}>查看完整執行紀錄</Link>
        </> : <p className="muted">尚未執行程式碼分析。</p>}
      </section>
    </div>

    <section className="section card">
      <h2>Pull Request</h2>
      {pullRequests.length ? <div className="record-list">{pullRequests.map(pr => <a key={pr.id} href={pr.github_pr_url} target="_blank" rel="noreferrer" className="record-row"><span>PR #{pr.github_pr_number}</span><StatusBadge value={pr.state} /></a>)}</div> : <p className="muted">目前沒有關聯的 Pull Request。</p>}
    </section>

    <section className="section card">
      <h2>AI 分析</h2>
      {analysis?.content ? <pre className="code">{analysis.content}</pre> : <p className="muted">Agent 完成分析後會在這裡顯示摘要與風險。</p>}
    </section>

    <section className="section card">
      <h2>程式碼修改</h2>
      {diff?.content ? <pre className="code">{diff.content}</pre> : <p className="muted">目前沒有產生程式碼 Diff。</p>}
    </section>

    <section className="section card">
      <h2>測試結果</h2>
      {testLog?.content ? <pre className="code">{testLog.content}</pre> : <p className="muted">目前沒有測試紀錄。</p>}
    </section>
  </>;
}
