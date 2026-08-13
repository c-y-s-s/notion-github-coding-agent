import argparse
import os
import re
import socket
import time
from datetime import UTC, datetime
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

from .git_ops import (
    base_sha,
    changed_files,
    create_branch,
    create_worktree,
    delete_local_branch,
    diff,
    fetch_branch,
    remove_worktree,
    run,
    shell,
)
from .llm import ModelAdapter
from .policy import MAX_ATTEMPTS, MAX_SECONDS, validate_changed_files
from .slack import notify_analysis_complete

PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / "apps/web/.env.local")
load_dotenv(PROJECT_ROOT / ".env", override=False)
now = lambda: datetime.now(UTC).isoformat()


def branch_slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:36] or "task"


def db():
    return create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def log_step(client, run_id: str, sequence: int, kind: str, status: str, attempt_number: int = 0, **fields):
    client.table("agent_run_steps").insert(
        {
            "agent_run_id": run_id,
            "sequence": sequence,
            "step_type": kind,
            "status": status,
            "attempt_number": attempt_number,
            "started_at": now(),
            "finished_at": now(),
            **fields,
        }
    ).execute()


def repository_context(root: Path, limit: int = 80_000) -> str:
    allowed = {".ts", ".tsx", ".js", ".jsx", ".json"}
    chunks: list[str] = []
    size = 0
    tracked = run(["git", "ls-files"], root)
    for name in tracked.stdout.splitlines():
        path = root / name
        if (
            path.suffix not in allowed
            or any(x in path.parts for x in ("node_modules", ".next"))
            or path.name.endswith("lock.json")
        ):
            continue
        try:
            content = path.read_text(errors="replace")
        except OSError:
            continue
        block = f"\n--- {name} ---\n{content}"
        if size + len(block) > limit:
            break
        chunks.append(block)
        size += len(block)
    return "".join(chunks)


def fail(client, run: dict, code: str, message: str, risk="medium"):
    client.table("agent_runs").update(
        {
            "status": "failed",
            "risk_level": risk,
            "error_code": code,
            "error_message": message,
            "finished_at": now(),
        }
    ).eq("id", run["id"]).execute()
    client.table("work_items").update({"agent_status": "failed"}).eq("id", run["work_item_id"]).execute()


def complete_without_changes(client, run: dict, task: dict, risk: str):
    client.table("agent_runs").update(
        {
            "status": "succeeded",
            "risk_level": risk,
            "error_code": "NO_CHANGES",
            "error_message": "目前程式碼已符合需求，無需修改或推送分支。",
            "finished_at": now(),
        }
    ).eq("id", run["id"]).execute()
    client.table("work_items").update({"agent_status": "idle"}).eq("id", run["work_item_id"]).execute()
    notify_analysis_complete(
        client, run, task, "無需修改", risk, "目前程式碼已符合需求，沒有建立可推送的 Patch。"
    )


def fail_after_analysis(client, run: dict, task: dict, code: str, message: str, risk="medium"):
    fail(client, run, code, message, risk)
    notify_analysis_complete(client, run, task, "分析完成但無法產生 Patch", risk, message)


def is_no_change_outcome(analysis, edits: list) -> bool:
    return (
        not analysis.can_prepare_patch
        and not analysis.risk_reasons
        and not analysis.proposed_changes
        and not edits
    )


def error_signature(command: str, output: str) -> str:
    normalized = re.sub(r"\s+", " ", output.strip())[-2000:]
    return f"{command}:{normalized}"


def apply_proposal(worktree: Path, proposal) -> tuple[list[str], list[str]]:
    paths = [edit.path for edit in proposal.edits]
    violations = validate_changed_files(paths)
    if violations:
        return [], violations
    for edit in proposal.edits:
        target = (worktree / edit.path).resolve()
        if not target.is_relative_to(worktree.resolve()) or not target.exists():
            return [], [f"invalid edit path: {edit.path}"]
        target.write_text(edit.content)
    actual = changed_files(worktree)
    return actual, validate_changed_files(actual)


def refresh_stale_run(client, run_row: dict, repo: dict, worktree: Path):
    client.table("agent_runs").update(
        {
            "status": "cancelled",
            "risk_level": "medium",
            "error_code": "STALE_BASE",
            "error_message": "Default branch changed; a replacement run was queued from the latest commit.",
            "finished_at": now(),
        }
    ).eq("id", run_row["id"]).execute()
    remove_worktree(Path(repo["local_path"]).resolve(), worktree)
    replacement = client.table("agent_runs").insert(
        {
            "work_item_id": run_row["work_item_id"],
            "repository_id": run_row["repository_id"],
            "status": "queued",
            "model": run_row["model"],
            "prompt_version": run_row["prompt_version"],
            "attempt_number": run_row.get("attempt_number", 0) + 1,
        }
    ).execute().data[0]
    client.table("work_items").update({"agent_status": "queued"}).eq("id", run_row["work_item_id"]).execute()
    return replacement


def cleanup_terminal_worktrees(client):
    terminal = ["succeeded", "failed", "rejected", "cancelled"]
    runs = (
        client.table("agent_runs")
        .select("id,status,repository_id,worktree_path,branch_name,error_code")
        .in_("status", terminal)
        .not_.is_("worktree_path", "null")
        .execute()
        .data
    )
    for run_row in runs:
        repo = (
            client.table("repositories")
            .select("local_path")
            .eq("id", run_row["repository_id"])
            .single()
            .execute()
            .data
        )
        root = Path(repo["local_path"]).resolve()
        worktree = Path(run_row["worktree_path"]).resolve()
        allowed_root = (root.parent / ".agent-worktrees").resolve()
        if worktree.parent != allowed_root:
            continue
        remove_worktree(root, worktree)
        if run_row.get("branch_name") and (
            run_row["status"] != "succeeded" or run_row.get("error_code") == "NO_CHANGES"
        ):
            delete_local_branch(root, run_row["branch_name"])
        client.table("agent_runs").update({"worktree_path": None}).eq("id", run_row["id"]).execute()


def cleanup_rejected_branches(client):
    runs = (
        client.table("agent_runs")
        .select("id,repository_id,branch_name")
        .eq("status", "rejected")
        .not_.is_("branch_name", "null")
        .execute()
        .data
    )
    for run_row in runs:
        repo = (
            client.table("repositories")
            .select("local_path")
            .eq("id", run_row["repository_id"])
            .single()
            .execute()
            .data
        )
        delete_local_branch(Path(repo["local_path"]).resolve(), run_row["branch_name"])


def process_queued(client, run_row: dict):
    task = client.table("work_items").select("*").eq("id", run_row["work_item_id"]).single().execute().data
    repo = client.table("repositories").select("*").eq("id", run_row["repository_id"]).single().execute().data
    root = Path(repo["local_path"]).resolve()
    if not (root / ".git").exists():
        return fail(client, run_row, "INVALID_REPOSITORY", "Configured path is not a Git repository")
    sha = fetch_branch(root, repo["default_branch"])
    worktree = root.parent / ".agent-worktrees" / run_row["id"]
    client.table("agent_runs").update(
        {
            "status": "running",
            "base_commit_sha": sha,
            "worktree_path": str(worktree),
            "started_at": now(),
        }
    ).eq("id", run_row["id"]).execute()
    client.table("work_items").update({"agent_status": "preparing"}).eq("id", task["id"]).execute()
    create_worktree(root, worktree, sha)
    sequence = 1
    install_command = repo.get("install_command")
    if install_command:
        result = shell(install_command, worktree, MAX_SECONDS)
        log_step(client, run_row["id"], sequence, "inspect", "completed" if result.returncode == 0 else "failed", command=install_command, exit_code=result.returncode, output_excerpt=(result.stdout + result.stderr)[-8000:])
        sequence += 1
        if result.returncode:
            return fail(client, run_row, "INSTALL_FAILED", "Repository dependencies could not be installed")
    checks = [repo.get("lint_command"), repo.get("typecheck_command"), repo.get("test_command")]
    for command in checks:
        if not command:
            continue
        result = shell(command, worktree, MAX_SECONDS)
        log_step(
            client,
            run_row["id"],
            sequence,
            "baseline",
            "completed" if result.returncode == 0 else "failed",
            command=command,
            exit_code=result.returncode,
            output_excerpt=(result.stdout + result.stderr)[-8000:],
        )
        sequence += 1
        if result.returncode:
            return fail(client, run_row, "BASELINE_FAILED", "Baseline checks failed; no patch was generated")
    adapter = ModelAdapter(run_row["model"])
    check_failure = None
    previous_signature = None
    final_proposal = None
    final_actual: list[str] = []
    completed_attempts = 0
    for attempt in range(1, MAX_ATTEMPTS + 1):
        client.table("agent_runs").update({"attempt_number": attempt}).eq("id", run_row["id"]).execute()
        proposal = adapter.prepare_patch(
            task,
            repository_context(worktree),
            attempt=attempt,
            check_failure=check_failure,
        )
        completed_attempts = attempt
        client.table("artifacts").insert(
            {
                "agent_run_id": run_row["id"],
                "type": "analysis",
                "content": proposal.analysis.model_dump_json(),
                "metadata": {"attempt": attempt},
            }
        ).execute()
        log_step(client, run_row["id"], sequence, "plan", "completed", attempt_number=attempt)
        sequence += 1
        if attempt == 1 and is_no_change_outcome(proposal.analysis, proposal.edits):
            return complete_without_changes(client, run_row, task, proposal.analysis.risk_level)
        if not proposal.analysis.can_prepare_patch or not proposal.edits:
            return fail_after_analysis(
                client,
                run_row,
                task,
                "PATCH_NOT_SAFE" if attempt == 1 else "REPAIR_DECLINED",
                "; ".join(proposal.analysis.risk_reasons) or "AI 無法提出安全、可驗證的修改。",
                proposal.analysis.risk_level,
            )
        actual, violations = apply_proposal(worktree, proposal)
        log_step(
            client,
            run_row["id"],
            sequence,
            "edit",
            "failed" if violations else "completed",
            attempt_number=attempt,
            output_excerpt="; ".join(violations) if violations else ", ".join(actual),
        )
        sequence += 1
        if violations:
            return fail_after_analysis(
                client, run_row, task, "PATCH_SCOPE_VIOLATION", "; ".join(violations), "high"
            )
        patch = diff(worktree)
        if not patch.strip():
            return complete_without_changes(client, run_row, task, proposal.analysis.risk_level)
        client.table("artifacts").insert(
            {
                "agent_run_id": run_row["id"],
                "type": "diff",
                "content": patch,
                "metadata": {"files": actual, "attempt": attempt, "verified": False},
            }
        ).execute()

        check_failure = None
        for command in checks:
            if not command:
                continue
            result = shell(command, worktree, MAX_SECONDS)
            output = (result.stdout + result.stderr)[-8000:]
            log_step(
                client,
                run_row["id"],
                sequence,
                "test",
                "completed" if result.returncode == 0 else "failed",
                attempt_number=attempt,
                command=command,
                exit_code=result.returncode,
                output_excerpt=output,
            )
            sequence += 1
            if result.returncode:
                check_failure = {"command": command, "exit_code": result.returncode, "output": output}
                client.table("artifacts").insert(
                    {
                        "agent_run_id": run_row["id"],
                        "type": "test_log",
                        "content": output,
                        "metadata": {"attempt": attempt, "command": command, "passed": False},
                    }
                ).execute()
                break
        if check_failure is None:
            final_proposal, final_actual = proposal, actual
            client.table("artifacts").insert(
                {
                    "agent_run_id": run_row["id"],
                    "type": "diff",
                    "content": patch,
                    "metadata": {"files": actual, "attempt": attempt, "verified": True},
                }
            ).execute()
            break
        signature = error_signature(check_failure["command"], check_failure["output"])
        if signature == previous_signature:
            return fail_after_analysis(
                client, run_row, task, "REPEATED_CHECK_FAILURE", "相同檢查錯誤連續出現兩次，已停止修正循環。"
            )
        previous_signature = signature
    if final_proposal is None:
        return fail_after_analysis(
            client, run_row, task, "CHECKS_FAILED", f"修正 {completed_attempts} 次後仍未通過必要檢查。"
        )
    client.table("agent_runs").update(
        {
            "status": "awaiting_approval",
            "risk_level": final_proposal.analysis.risk_level,
            "risk_reasons": final_proposal.analysis.risk_reasons,
            "attempt_number": completed_attempts,
        }
    ).eq("id", run_row["id"]).execute()
    client.table("work_items").update({"agent_status": "awaiting_approval"}).eq("id", task["id"]).execute()
    notify_analysis_complete(
        client,
        run_row,
        task,
        "等待人工核准",
        final_proposal.analysis.risk_level,
        f"已在第 {completed_attempts} 次嘗試通過檢查，修改 {len(final_actual)} 個檔案。",
    )


def process_approved(client, run_row: dict):
    repo = client.table("repositories").select("*").eq("id", run_row["repository_id"]).single().execute().data
    task = client.table("work_items").select("id,title").eq("id", run_row["work_item_id"]).single().execute().data
    root, worktree = Path(repo["local_path"]).resolve(), Path(run_row["worktree_path"])
    remote = fetch_branch(root, repo["default_branch"])
    if remote != run_row["base_commit_sha"]:
        return refresh_stale_run(client, run_row, repo, worktree)
    branch = run_row.get("branch_name") or f"agent/{task['id'][:8]}-{run_row['id'][:8]}-{branch_slug(task['title'])}"
    client.table("agent_runs").update({"status": "pushing", "branch_name": branch}).eq("id", run_row["id"]).execute()
    create_branch(worktree, branch)
    commit = run(["git", "add", "--all"], worktree)
    if commit.returncode:
        return fail(client, run_row, "GIT_ADD_FAILED", commit.stderr)
    commit = run(["git", "commit", "-m", f"fix: agent patch for {run_row['work_item_id'][:8]}"], worktree)
    if commit.returncode:
        return fail(client, run_row, "GIT_COMMIT_FAILED", commit.stderr)
    pushed = run(["git", "push", "-u", "origin", branch], worktree, 180)
    if pushed.returncode:
        return fail(client, run_row, "GIT_PUSH_FAILED", pushed.stderr)
    sha = base_sha(worktree, "HEAD")
    client.table("artifacts").insert(
        {"agent_run_id": run_row["id"], "type": "commit", "content": sha, "metadata": {}}
    ).execute()
    client.table("artifacts").insert(
        {"agent_run_id": run_row["id"], "type": "branch", "content": branch, "metadata": {}}
    ).execute()
    client.table("agent_runs").update({"status": "succeeded", "finished_at": now()}).eq(
        "id", run_row["id"]
    ).execute()
    client.table("work_items").update({"agent_status": "branch_ready", "planning_status": "in_progress"}).eq(
        "id", run_row["work_item_id"]
    ).execute()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Process at most one queued or approved run")
    args = parser.parse_args()
    client = db()
    worker_id = os.getenv("AGENT_WORKER_ID", socket.gethostname())
    poll = int(os.getenv("AGENT_POLL_SECONDS", "3"))
    while True:
        cleanup_terminal_worktrees(client)
        cleanup_rejected_branches(client)
        client.table("worker_heartbeats").upsert(
            {"worker_id": worker_id, "last_seen_at": now(), "metadata": {"pid": os.getpid()}}
        ).execute()
        rows = (
            client.table("agent_runs")
            .select("*")
            .in_("status", ["approved", "queued"])
            .order("created_at")
            .limit(1)
            .execute()
            .data
        )
        if rows:
            item = rows[0]
            try:
                process_approved(client, item) if item["status"] == "approved" else process_queued(
                    client, item
                )
            except (OSError, RuntimeError, ValueError, TimeoutError) as exc:
                fail(client, item, "WORKER_ERROR", str(exc))
        if args.once:
            return
        time.sleep(poll)


if __name__ == "__main__":
    main()
