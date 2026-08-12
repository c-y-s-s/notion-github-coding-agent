from pathlib import Path

MAX_CHANGED_FILES = 3
MAX_ATTEMPTS = 3
MAX_SECONDS = 600
DENIED_PARTS = {".env", ".github", "migrations", "supabase", "credentials", "secrets"}
DENIED_FILES = {"pnpm-lock.yaml", "package-lock.json", "yarn.lock", "Dockerfile"}


def validate_changed_files(files: list[str]) -> list[str]:
    reasons: list[str] = []
    if len(files) > MAX_CHANGED_FILES:
        reasons.append(f"patch changes {len(files)} files; maximum is {MAX_CHANGED_FILES}")
    for raw in files:
        path = Path(raw)
        if path.name in DENIED_FILES or any(part in DENIED_PARTS for part in path.parts):
            reasons.append(f"sensitive path is not allowed: {raw}")
        if path.is_absolute() or ".." in path.parts:
            reasons.append(f"path escapes worktree: {raw}")
    return reasons


def command_allowlist(config: dict) -> set[str]:
    return {
        command
        for key in ("install_command", "lint_command", "typecheck_command", "test_command")
        if (command := config.get(key))
    }
