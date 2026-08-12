import shutil
import subprocess
from pathlib import Path


def run(args: list[str], cwd: Path, timeout: int = 600) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, timeout=timeout, check=False)


def shell(command: str, cwd: Path, timeout: int = 600) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
        shell=True,
        executable="/bin/sh",
    )


def base_sha(repo: Path, branch: str) -> str:
    result = run(["git", "rev-parse", branch], repo)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def changed_files(worktree: Path) -> list[str]:
    result = run(["git", "diff", "--name-only"], worktree)
    return [line for line in result.stdout.splitlines() if line]


def diff(worktree: Path) -> str:
    return run(["git", "diff", "--no-ext-diff"], worktree).stdout


def create_worktree(repo: Path, destination: Path, branch: str, sha: str) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        shutil.rmtree(destination)
    result = run(["git", "worktree", "add", "-b", branch, str(destination), sha], repo)
    if result.returncode:
        raise RuntimeError(result.stderr)


def remove_worktree(repo: Path, destination: Path) -> None:
    run(["git", "worktree", "remove", "--force", str(destination)], repo)
