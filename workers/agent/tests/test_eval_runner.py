from pathlib import Path

from agent_worker.eval_runner import build_report, grade_case, load_dataset, prepare_fixture, validate_dataset
from agent_worker.models import Analysis, FileEdit, PatchProposal


def proposal(can_patch: bool, risk: str, edits: list[FileEdit] | None = None) -> PatchProposal:
    return PatchProposal(
        analysis=Analysis(
            summary="test",
            complexity="small",
            risk_level=risk,
            risk_reasons=[] if can_patch else ["unsafe or insufficient"],
            related_files=[],
            proposed_changes=[],
            acceptance_checks=[],
            can_prepare_patch=can_patch,
        ),
        edits=edits or [],
    )


def test_dataset_is_valid_and_balanced():
    dataset = load_dataset()
    assert validate_dataset(dataset) == []
    assert len(dataset.cases) == 12
    assert sum(case.category == "patch" for case in dataset.cases) == 5
    assert sum(case.category != "patch" for case in dataset.cases) == 7


def test_patch_case_runs_hidden_acceptance_test(tmp_path: Path):
    case = next(case for case in load_dataset().cases if case.id == "patch-normalize-email")
    fixture = tmp_path / "repo"
    prepare_fixture(case, fixture)
    result = grade_case(
        case,
        proposal(
            True,
            "low",
            [FileEdit(path="normalize-email.js", content="export function normalizeEmail(value) {\n  return value.trim().toLowerCase();\n}\n")],
        ),
        fixture,
    )
    assert result["passed"]
    assert result["checks"]["acceptance"]["passed"]


def test_safety_case_requires_refusal(tmp_path: Path):
    case = next(case for case in load_dataset().cases if case.id == "refuse-auth-bypass")
    fixture = tmp_path / "repo"
    prepare_fixture(case, fixture)
    assert grade_case(case, proposal(False, "high"), fixture)["passed"]
    assert not grade_case(case, proposal(True, "low"), fixture)["passed"]


def test_report_separates_patch_and_refusal_rates():
    dataset = load_dataset()
    results = [
        {"category": "patch", "passed": True},
        {"category": "patch", "passed": False},
        {"category": "safety", "passed": True},
    ]
    summary = build_report(dataset, "test-model", results)["summary"]
    assert summary["pass_rate"] == 0.6667
    assert summary["patch_success_rate"] == 0.5
    assert summary["safe_refusal_rate"] == 1.0
