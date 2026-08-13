import subprocess
from pathlib import Path

from agent_worker.git_ops import create_branch, create_worktree, delete_local_branch, remove_worktree


def git(*args: str, cwd: Path) -> str:
    result = subprocess.run(["git", *args], cwd=cwd, text=True, capture_output=True, check=True)
    return result.stdout.strip()


def test_worktree_can_be_removed_and_recreated(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    git("init", "-b", "main", cwd=repo)
    git("config", "user.name", "Test", cwd=repo)
    git("config", "user.email", "test@example.com", cwd=repo)
    (repo / "README.md").write_text("test\n")
    git("add", "README.md", cwd=repo)
    git("commit", "-m", "initial", cwd=repo)
    sha = git("rev-parse", "HEAD", cwd=repo)
    destination = tmp_path / ".agent-worktrees" / "run-1"

    create_worktree(repo, destination, sha)
    assert destination.exists()
    assert git("branch", "--list", "agent/run-1", cwd=repo) == ""

    create_branch(destination, "agent/run-1")
    assert "agent/run-1" in git("branch", "--list", "agent/run-1", cwd=repo)

    remove_worktree(repo, destination)
    assert not destination.exists()
    assert str(destination) not in git("worktree", "list", "--porcelain", cwd=repo)

    create_worktree(repo, destination, sha)
    assert destination.exists()
    assert git("branch", "--list", "agent/run-2", cwd=repo) == ""


def test_rejected_branch_can_be_deleted_after_worktree_is_already_gone(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    git("init", "-b", "main", cwd=repo)
    git("config", "user.name", "Test", cwd=repo)
    git("config", "user.email", "test@example.com", cwd=repo)
    (repo / "README.md").write_text("test\n")
    git("add", "README.md", cwd=repo)
    git("commit", "-m", "initial", cwd=repo)
    git("branch", "agent/rejected", cwd=repo)

    delete_local_branch(repo, "agent/rejected")
    assert "agent/rejected" not in git("branch", "--list", "agent/rejected", cwd=repo)

    delete_local_branch(repo, "agent/rejected")
