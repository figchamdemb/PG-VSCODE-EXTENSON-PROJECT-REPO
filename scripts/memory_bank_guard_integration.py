from __future__ import annotations

import json
from pathlib import Path

MAX_SCREEN_PAGE_LINES = 500
MAX_FRONTEND_INTEGRATION_SUMMARY_LINES = 250


def line_count(path: Path) -> int:
    try:
        return len(path.read_text(encoding="utf-8", errors="ignore").splitlines())
    except OSError:
        return 0


def validate_frontend_integration_artifacts(repo_root: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    summary_path = repo_root / "Memory-bank" / "frontend-integration.md"
    state_path = repo_root / "Memory-bank" / "frontend-integration" / "state.json"

    if not summary_path.exists():
        errors.append(
            "Missing frontend integration summary: Memory-bank/frontend-integration.md. "
            "Run '.\\pg.ps1 integration-init'."
        )
        return errors, warnings

    if not state_path.exists():
        errors.append(
            "Missing frontend integration state: Memory-bank/frontend-integration/state.json. "
            "Run '.\\pg.ps1 integration-init'."
        )
        return errors, warnings

    summary_lines = line_count(summary_path)
    if summary_lines > MAX_FRONTEND_INTEGRATION_SUMMARY_LINES:
        warnings.append(
            "Memory-bank/frontend-integration.md should remain a short summary/index. "
            f"Current line count: {summary_lines} (limit {MAX_FRONTEND_INTEGRATION_SUMMARY_LINES})."
        )

    try:
        payload = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        errors.append(
            "Frontend integration state.json is invalid JSON. Re-run '.\\pg.ps1 integration-init'."
        )
        return errors, warnings

    pages = payload.get("pages")
    if not isinstance(pages, list) or not pages:
        errors.append(
            "Frontend integration state.json must contain at least one page entry. "
            "Re-run '.\\pg.ps1 integration-init' or '.\\pg.ps1 backend-start'."
        )
        return errors, warnings

    for page in pages:
        page_id = str(page.get("page_id", "")).strip() or "unknown"
        page_file = str(page.get("page_file", "")).strip()
        if not page_file:
            errors.append(f"Frontend integration page '{page_id}' is missing page_file.")
            continue
        page_path = repo_root / page_file
        if not page_path.exists():
            errors.append(f"Frontend integration page file is missing: {page_file}")
            continue
        page_lines = line_count(page_path)
        if page_lines > MAX_SCREEN_PAGE_LINES:
            errors.append(
                f"Frontend integration page exceeds {MAX_SCREEN_PAGE_LINES} lines: {page_file} ({page_lines} lines)."
            )

        status = str(page.get("status", "")).strip().lower()
        validation = page.get("validation") or {}
        frontend_line_count = validation.get("frontend_page_line_count")
        self_check_status = str(validation.get("self_check_status", "")).strip().lower()
        trust_status = str(validation.get("trust_status", "")).strip().lower()
        if status == "done":
            try:
                frontend_line_count_value = int(frontend_line_count)
            except (TypeError, ValueError):
                frontend_line_count_value = 0
            if frontend_line_count_value > MAX_SCREEN_PAGE_LINES:
                errors.append(
                    f"Frontend completion for '{page_id}' recorded a screen/page line count above {MAX_SCREEN_PAGE_LINES}."
                )
            if self_check_status in {"", "pending", "invalid"}:
                errors.append(
                    f"Frontend completion for '{page_id}' is missing strict self-check status evidence."
                )
            if trust_status in {"", "pending", "invalid"}:
                errors.append(
                    f"Frontend completion for '{page_id}' is missing trust/post-write validation status evidence."
                )

    return errors, warnings