from types import SimpleNamespace

from agent_worker.policy import validate_changed_files
from agent_worker.worker import branch_slug, error_signature, is_no_change_outcome


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
