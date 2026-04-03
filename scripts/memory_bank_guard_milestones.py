from __future__ import annotations

from pathlib import Path
import re

PROJECT_SPEC_RELATIVE = "Memory-bank/project-spec.md"
PROJECT_DETAILS_RELATIVE = "Memory-bank/project-details.md"
PROJECT_MASTERMIND_RELATIVE = "Memory-bank/mastermind.md"

REQ_ID_RE = re.compile(r"\[(REQ-[A-Za-z0-9._:-]+)\]")
PLAN_DONE_PREFIXES = (
    "done",
    "completed",
    "closed",
    "cancelled",
    "canceled",
)


def _read_text_or_empty(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def _extract_req_ids(text: str) -> set[str]:
    return {match.group(1) for match in REQ_ID_RE.finditer(text)}


def _parse_current_plan_rows(project_details_text: str) -> list[dict[str, str]]:
    marker = "## Current Plan (Rolling)"
    start = project_details_text.find(marker)
    if start < 0:
        return []
    section = project_details_text[start + len(marker):]
    next_heading = section.find("\n## ")
    if next_heading >= 0:
        section = section[:next_heading]

    rows: list[dict[str, str]] = []
    for raw_line in section.splitlines():
        line = raw_line.strip()
        if not line.startswith("|"):
            continue
        if line.startswith("|---"):
            continue
        if "| Plan Item |" in line:
            continue
        parts = [part.strip() for part in line.strip("|").split("|")]
        if len(parts) < 5:
            continue
        rows.append(
            {
                "plan_item": parts[0],
                "status": parts[1],
                "owner": parts[2],
                "target_date": parts[3],
                "notes": parts[4],
            }
        )
    return rows


def _is_done_status(status: str) -> bool:
    normalized = status.strip().lower()
    return any(normalized.startswith(prefix) for prefix in PLAN_DONE_PREFIXES)


def validate_milestone_alignment(
    *,
    repo_root: Path,
    today: str,
    staged: list[str],
    code_changes: list[str],
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if not code_changes:
        return errors, warnings

    spec_path = repo_root / PROJECT_SPEC_RELATIVE
    details_path = repo_root / PROJECT_DETAILS_RELATIVE

    spec_text = _read_text_or_empty(spec_path)
    details_text = _read_text_or_empty(details_path)

    if not details_text:
        errors.append("Missing required planning file: Memory-bank/project-details.md")
        return errors, warnings

    if "## Current Plan (Rolling)" not in details_text:
        errors.append(
            "project-details.md missing '## Current Plan (Rolling)' section."
        )
        return errors, warnings

    rows = _parse_current_plan_rows(details_text)
    if not rows:
        errors.append(
            "project-details.md has no valid plan rows under 'Current Plan (Rolling)'."
        )
        return errors, warnings

    active_rows = [row for row in rows if not _is_done_status(row["status"])]
    completion_marker = "PROJECT_COMPLETE: true" in details_text
    if not active_rows and not completion_marker:
        warnings.append(
            "No active/planned milestone row found. Add at least one non-done row or set "
            "'PROJECT_COMPLETE: true' in project-details.md."
        )

    if f"### Session Update - {today}" not in details_text:
        errors.append(
            f"project-details.md missing today's session update section: "
            f"'### Session Update - {today} ...'"
        )

    req_ids_in_spec = _extract_req_ids(spec_text)
    req_ids_in_details = _extract_req_ids(details_text)
    missing_req_mappings = sorted(req_ids_in_spec - req_ids_in_details)
    if missing_req_mappings:
        preview = ", ".join(missing_req_mappings[:8])
        if len(missing_req_mappings) > 8:
            preview += ", ..."
        errors.append(
            "Spec-to-milestone mapping missing in project-details.md for request IDs: "
            f"{preview}. Add these REQ tags into milestone rows/session updates."
        )

    spec_staged = PROJECT_SPEC_RELATIVE in staged
    if spec_staged and not req_ids_in_spec:
        warnings.append(
            "project-spec.md changed without REQ tags. Add request IDs like "
            "[REQ-2026-03-05-01] so spec items can be enforced against milestones."
        )

    if spec_staged and PROJECT_MASTERMIND_RELATIVE not in staged:
        warnings.append(
            "project-spec.md changed but mastermind.md is not staged. Add a decision/notes entry "
            "for major scope changes."
        )

    return errors, warnings
