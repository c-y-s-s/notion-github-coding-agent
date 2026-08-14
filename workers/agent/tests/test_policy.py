import subprocess
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

from agent_worker.models import CodeEvidence
from agent_worker.policy import validate_changed_files
from agent_worker.worker import (
    branch_slug,
    build_context_manifest,
    error_signature,
    is_no_change_outcome,
    is_stale_run,
    repository_context,
    verify_evidence,
)


def test_accepts_small_source_patch():
    assert validate_changed_files(["src/a.ts", "src/a.test.ts"]) == []


def test_rejects_too_many_files():
    assert "maximum is 3" in validate_changed_files(["a.ts", "b.ts", "c.ts", "d.ts"])[0]


def test_rejects_sensitive_paths():
    assert validate_changed_files([".env"])
    assert validate_changed_files(["supabase/migrations/x.sql"])


def test_rejects_path_escape():
    assert validate_changed_files(["../secret.txt"])


def test_branch_slug_falls_back_for_non_latin_title():
    assert branch_slug("修正取消狀態顯示成綠色") == "task"
    assert branch_slug("Fix cancelled badge") == "fix-cancelled-badge"


def test_distinguishes_no_changes_from_safety_rejection():
    no_change = SimpleNamespace(can_prepare_patch=False, risk_reasons=[], proposed_changes=[])
    unsafe = SimpleNamespace(can_prepare_patch=False, risk_reasons=["migration is not allowed"], proposed_changes=[])
    assert is_no_change_outcome(no_change, [])
    assert not is_no_change_outcome(unsafe, [])


def test_error_signature_ignores_whitespace_but_keeps_command():
    assert error_signature("pnpm test", "failed\n  expected  red") == error_signature(
        "pnpm test", "failed expected red"
    )
    assert error_signature("pnpm typecheck", "failed expected red") != error_signature(
        "pnpm test", "failed expected red"
    )


def test_repository_context_prioritizes_task_related_component_and_types(tmp_path: Path):
    repo = tmp_path / "repo"
    component = repo / "apps/web/components/status-badge.tsx"
    types = repo / "apps/web/lib/types.ts"
    component.parent.mkdir(parents=True)
    types.parent.mkdir(parents=True)
    component.write_text("export function StatusBadge() { return 'cancelled' }\n")
    types.write_text("export type AgentStatus = 'queued' | 'cancelled'\n")
    for index in range(10):
        filler = repo / f"apps/web/a-filler-{index}.tsx"
        filler.write_text("export const filler = '" + ("x" * 120) + "'\n")
    subprocess.run(["git", "init", "-b", "main"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "add", "."], cwd=repo, check=True, capture_output=True)

    context = repository_context(
        repo,
        {
            "title": "Add retrying AgentStatus",
            "description": "Update StatusBadge for retrying",
            "acceptance_criteria": "AgentStatus and StatusBadge are updated",
        },
        limit=300,
    )

    assert "--- apps/web/components/status-badge.tsx ---" in context
    assert "--- apps/web/lib/types.ts ---" in context


def test_repository_context_can_force_include_requested_file(tmp_path: Path):
    repo = tmp_path / "repo"
    requested = repo / "apps/web/lib/rare-contract.ts"
    requested.parent.mkdir(parents=True)
    requested.write_text("export type RareContract = 'required'\n")
    relevant = repo / "apps/web/retrying.ts"
    relevant.write_text("export const retrying = true\n" + ("x" * 180))
    subprocess.run(["git", "init", "-b", "main"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "add", "."], cwd=repo, check=True, capture_output=True)

    context = repository_context(
        repo,
        {"title": "retrying", "description": "", "acceptance_criteria": ""},
        limit=140,
        preferred_paths=["apps/web/lib/rare-contract.ts"],
    )

    assert "--- apps/web/lib/rare-contract.ts ---" in context


def test_verify_evidence_checks_path_lines_and_exact_quote():
    context = "\n--- src/status.ts ---\nexport const state = 'queued'\nexport const color = 'amber'\n"
    valid = CodeEvidence(path="src/status.ts", line_start=2, line_end=2, quote="color = 'amber'", reason="Current mapping")
    wrong_line = CodeEvidence(path="src/status.ts", line_start=1, line_end=1, quote="color = 'amber'", reason="Wrong line")
    missing = CodeEvidence(path="src/missing.ts", line_start=1, line_end=1, quote="anything", reason="Missing")

    checked = verify_evidence(context, [valid, wrong_line, missing])

    assert [item.verified for item in checked] == [True, False, False]


def test_context_manifest_detects_source_changes(tmp_path: Path):
    source = tmp_path / "src.js"
    source.write_text("export const value = 1\n")
    before = build_context_manifest(tmp_path, ["src.js"])
    source.write_text("export const value = 2\n")
    after = build_context_manifest(tmp_path, ["src.js"])
    assert before[0]["path"] == after[0]["path"]
    assert before[0]["sha256"] != after[0]["sha256"]


def test_run_without_lease_is_stale():
    assert is_stale_run({"lease_expires_at": None})


def test_run_with_future_lease_is_not_stale():
    current = datetime(2026, 8, 14, 8, 0, tzinfo=UTC)
    assert not is_stale_run(
        {"lease_expires_at": "2026-08-14T08:01:00+00:00"},
        current,
    )


def test_run_with_expired_lease_is_stale():
    current = datetime(2026, 8, 14, 8, 2, tzinfo=UTC)
    assert is_stale_run(
        {"lease_expires_at": "2026-08-14T08:01:00Z"},
        current,
    )
