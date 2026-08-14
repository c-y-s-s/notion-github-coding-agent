import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { StatusBadge } from "@/components/status-badge";
import { getTaskDetail } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/supabase";
import { AnalysisPanel } from "@/components/analysis-panel";
import { DiffViewer } from "@/components/diff-viewer";
import { PageHeader } from "@/components/ui";
import { TaskLifecycle } from "@/components/task-lifecycle";

export default async function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configured = hasSupabaseEnv();
  const { task, pullRequests, latestRun, artifacts } = await getTaskDetail(id);
  if (!task) notFound();

  const analysis = artifacts.filter(artifact => artifact.type === "analysis").at(-1);
  const diff = artifacts.filter(artifact => artifact.type === "diff" && artifact.metadata?.verified).at(-1);
  const testLogs = artifacts.filter(artifact => artifact.type === "test_log");
  const activeRun = latestRun && ["queued", "running", "awaiting_approval", "approved", "pushing"].includes(latestRun.status);
  const noChanges = latestRun?.error_code === "NO_CHANGES";
  const notionDeleted = Boolean(task.notion_page_id && !task.notion_page_url);
  const latestPr = pullRequests[0];

  return <>
    <PageHeader eyebrow="任務詳情" title={task.title} description="需求以來源平台為準；工程狀態、Agent 與 PR 在此整合。" actions={<div className="actions"><StatusBadge value={task.source} /><StatusBadge value={task.planning_status} /><StatusBadge value={task.agent_status} />{notionDeleted ? <StatusBadge value="notion_deleted" /> : null}</div>} />
    <TaskLifecycle issue={Boolean(task.github_issue_number)} agentStatus={task.agent_status} branch={Boolean(latestRun?.branch_name)} prState={latestPr?.state} />
    {notionDeleted && <div className="notice">原始 Notion Task 已被刪除。系統保留 GitHub、PR 與 Agent 稽核紀錄，但不再回寫該 Notion Page。</div>}
    {!configured && <div className="notice">目前為示範模式。設定 Supabase 後即可建立 Issue 或執行程式碼分析。</div>}

    <div className="split section">
      <section className="card">
        <h2>需求說明</h2>
        <p>{task.description || "尚未提供需求說明。"}</p>
        <h2>驗收條件</h2>
        <p className="muted">{task.acceptance_criteria || "尚未提供驗收條件。"}</p>
        <div className="actions task-primary-actions">
          {task.notion_page_url && <a className="button secondary" href={task.notion_page_url} target="_blank" rel="noreferrer">開啟 Notion</a>}
          {task.github_issue_url && <a className="button secondary" href={task.github_issue_url} target="_blank" rel="noreferrer">開啟 GitHub Issue</a>}
          {!notionDeleted && !task.github_issue_number && task.source === "notion" ? <ActionButton endpoint={`/api/tasks/${task.id}/create-github-issue`} label="下一步：建立 GitHub Issue" disabled={!configured} /> : null}
          {!notionDeleted && (task.github_issue_number || task.source === "github") && !activeRun && task.planning_status !== "done" ? <ActionButton endpoint={`/api/tasks/${task.id}/prepare-patch`} label="下一步：分析並準備修正" disabled={!configured} /> : null}
        </div>
      </section>

      <section className="card">
        <h2>最近一次 Agent 執行</h2>
        {latestRun ? <>
          <p><StatusBadge value={latestRun.status} /> {latestRun.risk_level && <StatusBadge value={latestRun.risk_level} />}</p>
          <p className="muted">模型：{latestRun.model}<br />分支：{latestRun.branch_name ?? "尚未建立"}</p>
          {latestRun.error_message && <p className={noChanges ? "muted" : "error-text"}>{latestRun.error_message}</p>}
          {noChanges && <p><StatusBadge value="no_changes" /></p>}
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
      <AnalysisPanel content={analysis?.content} />
    </section>

    <section className="section card">
      <h2>程式碼修改</h2>
      <DiffViewer content={diff?.content} />
    </section>

    <section className="section card">
      <h2>測試結果</h2>
      {testLogs.length ? testLogs.map(log => <div className="attempt-log" key={log.id}><strong>Attempt {log.metadata?.attempt ?? "—"} · {log.metadata?.command ?? "check"}</strong><pre className="code">{log.content}</pre></div>) : <p className="muted">最終檢查已通過，沒有失敗紀錄。</p>}
    </section>
  </>;
}
