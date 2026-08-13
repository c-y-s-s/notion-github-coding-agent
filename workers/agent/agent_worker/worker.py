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
    create_worktree,
    delete_local_branch,
    diff,
    fetch_branch,
    remove_worktree,
    run,
    shell,
)
from .llm import ModelAdapter
from .policy import MAX_SECONDS, validate_changed_files

PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / "apps/web/.env.local")
load_dotenv(PROJECT_ROOT / ".env", override=False)
now = lambda: datetime.now(UTC).isoformat()


def branch_slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:36] or "task"


def db():
    return create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def log_step(client, run_id: str, sequence: int, kind: str, status: str, **fields):
    client.table("agent_run_steps").insert(
        {
            "agent_run_id": run_id,
            "sequence": sequence,
            "step_type": kind,
            "status": status,
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


def complete_without_changes(client, run: dict, risk: str):
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


def is_no_change_outcome(analysis, edits: list) -> bool:
    return (
        not analysis.can_prepare_patch
        and not analysis.risk_reasons
        and not analysis.proposed_changes
        and not edits
    )


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
        .select("id,status,repository_id,worktree_path,branch_name")
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
    slug = branch_slug(task["title"])
    branch = f"agent/{task['id'][:8]}-{run_row['id'][:8]}-{slug}"
    worktree = root.parent / ".agent-worktrees" / run_row["id"]
    client.table("agent_runs").update(
        {
            "status": "running",
            "base_commit_sha": sha,
            "worktree_path": str(worktree),
            "branch_name": branch,
            "started_at": now(),
        }
    ).eq("id", run_row["id"]).execute()
    client.table("work_items").update({"agent_status": "preparing"}).eq("id", task["id"]).execute()
    create_worktree(root, worktree, branch, sha)
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
    proposal = ModelAdapter(run_row["model"]).prepare_patch(task, repository_context(worktree))
    client.table("artifacts").insert(
        {
            "agent_run_id": run_row["id"],
            "type": "analysis",
            "content": proposal.analysis.model_dump_json(),
            "metadata": {},
        }
    ).execute()
    if is_no_change_outcome(proposal.analysis, proposal.edits):
        return complete_without_changes(client, run_row, proposal.analysis.risk_level)
    if not proposal.analysis.can_prepare_patch or not proposal.edits:
        return fail(
            client,
            run_row,
            "PATCH_NOT_SAFE",
            "; ".join(proposal.analysis.risk_reasons) or "Model declined patch",
            proposal.analysis.risk_level,
        )
    paths = [edit.path for edit in proposal.edits]
    violations = validate_changed_files(paths)
    if violations:
        return fail(client, run_row, "POLICY_VIOLATION", "; ".join(violations), "high")
    for edit in proposal.edits:
        target = (worktree / edit.path).resolve()
        if not target.is_relative_to(worktree.resolve()) or not target.exists():
            return fail(client, run_row, "INVALID_EDIT_PATH", edit.path, "high")
        target.write_text(edit.content)
    actual = changed_files(worktree)
    violations = validate_changed_files(actual)
    if violations or set(actual) - set(paths):
        return fail(
            client,
            run_row,
            "PATCH_SCOPE_VIOLATION",
            "; ".join(violations or ["unexpected changed files"]),
            "high",
        )
    for command in checks:
        if not command:
            continue
        result = shell(command, worktree, MAX_SECONDS)
        log_step(
            client,
            run_row["id"],
            sequence,
            "test",
            "completed" if result.returncode == 0 else "failed",
            command=command,
            exit_code=result.returncode,
            output_excerpt=(result.stdout + result.stderr)[-8000:],
        )
        sequence += 1
        if result.returncode:
            return fail(client, run_row, "CHECKS_FAILED", "Generated patch did not pass required checks")
    patch = diff(worktree)
    client.table("artifacts").insert(
        {"agent_run_id": run_row["id"], "type": "diff", "content": patch, "metadata": {"files": actual}}
    ).execute()
    client.table("agent_runs").update(
        {
            "status": "awaiting_approval",
            "risk_level": proposal.analysis.risk_level,
            "risk_reasons": proposal.analysis.risk_reasons,
        }
    ).eq("id", run_row["id"]).execute()
    client.table("work_items").update({"agent_status": "awaiting_approval"}).eq("id", task["id"]).execute()


def process_approved(client, run_row: dict):
    repo = client.table("repositories").select("*").eq("id", run_row["repository_id"]).single().execute().data
    root, worktree = Path(repo["local_path"]).resolve(), Path(run_row["worktree_path"])
    remote = fetch_branch(root, repo["default_branch"])
    if remote != run_row["base_commit_sha"]:
        return refresh_stale_run(client, run_row, repo, worktree)
    client.table("agent_runs").update({"status": "pushing"}).eq("id", run_row["id"]).execute()
    commit = run(["git", "add", "--all"], worktree)
    if commit.returncode:
        return fail(client, run_row, "GIT_ADD_FAILED", commit.stderr)
    commit = run(["git", "commit", "-m", f"fix: agent patch for {run_row['work_item_id'][:8]}"], worktree)
    if commit.returncode:
        return fail(client, run_row, "GIT_COMMIT_FAILED", commit.stderr)
    pushed = run(["git", "push", "-u", "origin", run_row["branch_name"]], worktree, 180)
    if pushed.returncode:
        return fail(client, run_row, "GIT_PUSH_FAILED", pushed.stderr)
    sha = base_sha(worktree, "HEAD")
    client.table("artifacts").insert(
        {"agent_run_id": run_row["id"], "type": "commit", "content": sha, "metadata": {}}
    ).execute()
    client.table("artifacts").insert(
        {"agent_run_id": run_row["id"], "type": "branch", "content": run_row["branch_name"], "metadata": {}}
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
