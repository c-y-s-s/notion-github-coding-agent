import argparse
import json
import os
import shutil
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from .costs import estimate_cost_usd
from .git_ops import run, shell
from .llm import ModelAdapter
from .models import PatchProposal
from .worker import apply_proposal, repository_context

AGENT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = AGENT_ROOT.parents[1]
EVAL_ROOT = AGENT_ROOT / "evals"


class EvalTask(BaseModel):
    title: str
    description: str
    acceptance_criteria: str


class EvalExpected(BaseModel):
    can_prepare_patch: bool
    changed_files: list[str] = Field(default_factory=list)
    risk_levels: list[Literal["low", "medium", "high"]]
    check_command: str | None = None
    hidden_test: str | None = None


class EvalCase(BaseModel):
    id: str
    name: str
    category: Literal["patch", "safety", "quality"]
    fixture: str
    task: EvalTask
    expected: EvalExpected


class EvalDataset(BaseModel):
    version: str
    cases: list[EvalCase]


def load_dataset(path: Path = EVAL_ROOT / "dataset.json") -> EvalDataset:
    return EvalDataset.model_validate_json(path.read_text())


def validate_dataset(dataset: EvalDataset) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for case in dataset.cases:
        if case.id in seen:
            errors.append(f"{case.id}: duplicate id")
        seen.add(case.id)
        fixture = EVAL_ROOT / "fixtures" / case.fixture
        if not fixture.is_dir():
            errors.append(f"{case.id}: fixture does not exist")
            continue
        for name in case.expected.changed_files:
            if not (fixture / name).is_file():
                errors.append(f"{case.id}: expected file does not exist: {name}")
        if case.expected.can_prepare_patch != (case.category == "patch"):
            errors.append(f"{case.id}: patch category and expected decision disagree")
        if case.expected.hidden_test and not (EVAL_ROOT / "hidden-tests" / case.expected.hidden_test).is_file():
            errors.append(f"{case.id}: hidden test does not exist")
    return errors


def prepare_fixture(case: EvalCase, destination: Path) -> None:
    shutil.copytree(EVAL_ROOT / "fixtures" / case.fixture, destination)
    run(["git", "init", "-b", "main"], destination)
    run(["git", "config", "user.name", "Agent Eval"], destination)
    run(["git", "config", "user.email", "eval@example.invalid"], destination)
    run(["git", "add", "."], destination)
    commit = run(["git", "commit", "-m", "fixture"], destination)
    if commit.returncode:
        raise RuntimeError(commit.stderr)


def grade_case(case: EvalCase, proposal: PatchProposal, fixture: Path) -> dict:
    expected = case.expected
    checks: dict[str, dict] = {
        "decision": {
            "passed": proposal.analysis.can_prepare_patch == expected.can_prepare_patch,
            "expected": expected.can_prepare_patch,
            "actual": proposal.analysis.can_prepare_patch,
        },
        "risk": {
            "passed": proposal.analysis.risk_level in expected.risk_levels,
            "expected": expected.risk_levels,
            "actual": proposal.analysis.risk_level,
        },
    }
    actual_files: list[str] = []
    violations: list[str] = []
    if proposal.edits:
        actual_files, violations = apply_proposal(fixture, proposal)
    checks["files"] = {
        "passed": sorted(actual_files) == sorted(expected.changed_files) and not violations,
        "expected": expected.changed_files,
        "actual": actual_files,
        "violations": violations,
    }
    if expected.check_command:
        hidden_test = EVAL_ROOT / "hidden-tests" / str(expected.hidden_test)
        shutil.copy2(hidden_test, fixture / ".eval.test.js")
        result = shell(expected.check_command, fixture, 60)
        checks["acceptance"] = {
            "passed": result.returncode == 0,
            "command": expected.check_command,
            "exit_code": result.returncode,
            "output": (result.stdout + result.stderr)[-2000:],
        }
    passed = all(check["passed"] for check in checks.values())
    return {"passed": passed, "checks": checks}


def run_case(case: EvalCase, adapter: ModelAdapter) -> dict:
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix=f"agent-eval-{case.id}-") as temporary:
        fixture = Path(temporary) / "repo"
        prepare_fixture(case, fixture)
        baseline = shell("node --test", fixture, 60)
        if baseline.returncode:
            raise RuntimeError(f"fixture baseline failed: {(baseline.stdout + baseline.stderr)[-2000:]}")
        task = {**case.task.model_dump(), "type": "bug"}
        context = repository_context(fixture, task)
        proposal = adapter.prepare_patch(task, context)
        grade = grade_case(case, proposal, fixture)
        context_files = [line[4:-4] for line in context.splitlines() if line.startswith("--- ") and line.endswith(" ---")]
        return {
            "id": case.id,
            "name": case.name,
            "category": case.category,
            "duration_ms": round((time.monotonic() - started) * 1000),
            "analysis": proposal.analysis.model_dump(),
            "edited_files": [edit.path for edit in proposal.edits],
            "usage": adapter.last_call.get("usage", {}),
            "model_duration_ms": adapter.last_call.get("duration_ms"),
            "context_files": context_files,
            "context_chars": len(context),
            **grade,
            "failure_category": failure_category(grade),
        }


def build_report(dataset: EvalDataset, model: str, results: list[dict], prompt_version: str = "v1") -> dict:
    patch = [result for result in results if result["category"] == "patch"]
    refusals = [result for result in results if result["category"] != "patch"]
    passed = sum(result["passed"] for result in results)
    return {
        "dataset_version": dataset.version,
        "model": model,
        "prompt_version": prompt_version,
        "created_at": datetime.now(UTC).isoformat(),
        "summary": {
            "total": len(results),
            "passed": passed,
            "pass_rate": round(passed / len(results), 4) if results else 0,
            "patch_success_rate": rate(patch),
            "safe_refusal_rate": rate(refusals),
        },
        "results": results,
    }


def rate(results: list[dict]) -> float | None:
    return round(sum(result["passed"] for result in results) / len(results), 4) if results else None


def token_totals(results: list[dict]) -> dict:
    totals: dict[str, int] = {}
    for result in results:
        for key, value in result.get("usage", {}).items():
            if isinstance(value, int):
                totals[key] = totals.get(key, 0) + value
    return totals


def failure_category(grade: dict) -> str | None:
    if grade["passed"]:
        return None
    checks = grade["checks"]
    if not checks["decision"]["passed"]:
        return "wrong_decision"
    if not checks["risk"]["passed"]:
        return "risk_mismatch"
    if not checks["files"]["passed"]:
        return "file_scope"
    if "acceptance" in checks and not checks["acceptance"]["passed"]:
        return "acceptance_failed"
    return "runtime_error"


def process_benchmark_run(client, row: dict) -> dict:
    dataset = load_dataset()
    selected_ids = set(row.get("selected_case_ids") or [])
    selected = [case for case in dataset.cases if not selected_ids or case.id in selected_ids]
    client.table("benchmark_runs").update(
        {"status": "running", "started_at": datetime.now(UTC).isoformat(), "total": len(selected)}
    ).eq("id", row["id"]).execute()
    adapter = ModelAdapter(row["model"], row["prompt_version"])
    results: list[dict] = []
    for case in selected:
        try:
            result = run_case(case, adapter)
        except Exception as error:  # noqa: BLE001 - preserve every case result in a batch
            result = {
                "id": case.id,
                "name": case.name,
                "category": case.category,
                "passed": False,
                "failure_category": "runtime_error",
                "error": str(error),
            }
        results.append(result)
        client.table("benchmark_case_results").upsert(
            {
                "benchmark_run_id": row["id"],
                "case_id": case.id,
                "name": case.name,
                "category": case.category,
                "passed": result["passed"],
                "failure_category": result.get("failure_category"),
                "duration_ms": result.get("duration_ms"),
                "model_duration_ms": result.get("model_duration_ms"),
                "analysis": result.get("analysis"),
                "edited_files": result.get("edited_files", []),
                "checks": result.get("checks", {}),
                "token_usage": result.get("usage", {}),
                "context_files": result.get("context_files", []),
                "context_chars": result.get("context_chars", 0),
                "error_message": result.get("error"),
            },
            on_conflict="benchmark_run_id,case_id",
        ).execute()
    report = build_report(dataset, row["model"], results, row["prompt_version"])
    totals = token_totals(results)
    estimated_cost = estimate_cost_usd(row["model"], totals)
    client.table("benchmark_runs").update(
        {
            "status": "succeeded",
            **report["summary"],
            "token_usage": {**totals, "estimated_cost_usd": estimated_cost},
            "finished_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", row["id"]).execute()
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the versioned local Agent evaluation dataset")
    parser.add_argument("--case", action="append", dest="case_ids", help="Run only this case id; repeatable")
    parser.add_argument("--model", default=os.getenv("OPENAI_MODEL", "gpt-5-mini"))
    parser.add_argument("--prompt-version", choices=["v1", "v2"], default="v1")
    parser.add_argument("--output", type=Path, help="Optional JSON report path")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    load_dotenv(REPO_ROOT / "apps/web/.env.local")
    load_dotenv(REPO_ROOT / ".env", override=False)
    dataset = load_dataset()
    errors = validate_dataset(dataset)
    if errors:
        raise SystemExit("\n".join(errors))
    selected = [case for case in dataset.cases if not args.case_ids or case.id in args.case_ids]
    if args.case_ids and len(selected) != len(set(args.case_ids)):
        known = {case.id for case in dataset.cases}
        raise SystemExit(f"Unknown cases: {sorted(set(args.case_ids) - known)}")
    if args.validate_only:
        print(json.dumps({"dataset_version": dataset.version, "cases": len(selected), "status": "valid"}))
        return
    if not os.getenv("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is required unless --validate-only is used")

    adapter = ModelAdapter(args.model, args.prompt_version)
    results: list[dict] = []
    for case in selected:
        try:
            result = run_case(case, adapter)
        except Exception as error:  # noqa: BLE001 - one failed case must not hide the remaining benchmark results
            result = {
                "id": case.id,
                "name": case.name,
                "category": case.category,
                "passed": False,
                "error": str(error),
            }
        results.append(result)
        print(f"{'PASS' if result['passed'] else 'FAIL'} {case.id}")
    report = build_report(dataset, args.model, results, args.prompt_version)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report["summary"], ensure_ascii=False))
    raise SystemExit(0 if report["summary"]["passed"] == report["summary"]["total"] else 1)


if __name__ == "__main__":
    main()
