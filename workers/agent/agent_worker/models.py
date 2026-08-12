from typing import Literal

from pydantic import BaseModel, Field


class Analysis(BaseModel):
    summary: str
    complexity: Literal["small", "medium", "large"]
    risk_level: Literal["low", "medium", "high"]
    risk_reasons: list[str] = Field(default_factory=list)
    related_files: list[str] = Field(default_factory=list)
    proposed_changes: list[str] = Field(default_factory=list)
    acceptance_checks: list[str] = Field(default_factory=list)
    can_prepare_patch: bool


class FileEdit(BaseModel):
    path: str
    content: str


class PatchProposal(BaseModel):
    analysis: Analysis
    edits: list[FileEdit] = Field(default_factory=list, max_length=3)


class RepositoryConfig(BaseModel):
    local_path: str
    default_branch: str = "main"
    install_command: str | None = None
    lint_command: str | None = None
    typecheck_command: str | None = None
    test_command: str
