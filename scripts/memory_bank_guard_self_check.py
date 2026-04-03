from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

UI_CODE_EXT = {".tsx", ".jsx", ".css", ".scss", ".sass", ".less", ".html", ".vue", ".svelte"}


def parse_iso_utc(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.UTC)
    return parsed.astimezone(dt.UTC)


def is_ui_impacting_change(path: str) -> bool:
    lower = path.lower()
    suffix = Path(path).suffix.lower()
    if suffix in UI_CODE_EXT:
        return True
    if lower.startswith("server/public/"):
        return True
    if lower.startswith("extension/src/ui/"):
        return True
    if "/screen" in lower or "/screens/" in lower or "/pages/" in lower:
        return True
    if lower.endswith("page.tsx") or lower.endswith("page.jsx"):
        return True
    return False


def validate_self_check(
    repo_root: Path,
    summary_path: Path,
    staged: list[str],
    code_changes: list[str],
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not code_changes:
        return errors, warnings

    if not summary_path.exists():
        errors.append(
            "Missing self-check summary: Memory-bank/_generated/self-check-latest.json. "
            "Run '.\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck' before updating Memory-bank docs."
        )
        return errors, warnings

    try:
        payload = json.loads(summary_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        errors.append(
            "Invalid self-check summary JSON. Re-run '.\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck'."
        )
        return errors, warnings

    summary_status = str(payload.get("status", "")).strip().lower()
    if summary_status != "pass":
        errors.append(
            "Latest self-check did not pass. Re-run strict self-check and fix blockers:\n"
            "- .\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck"
        )

    if bool(payload.get("warn_only")):
        errors.append(
            "Latest self-check was run in warn-only mode. Final Memory-bank update requires strict mode:\n"
            "- .\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck"
        )

    if not bool(payload.get("enable_db_index_maintenance_check")):
        errors.append(
            "Latest self-check missed DB index maintenance enforcement. Run:\n"
            "- .\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck"
        )

    ui_changes = [path for path in code_changes if is_ui_impacting_change(path)]
    if not bool(payload.get("enable_playwright_smoke_check")):
        errors.append(
            "Latest self-check did not enforce mandatory Playwright smoke. Run:\n"
            "- .\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck"
        )

    generated_at = parse_iso_utc(str(payload.get("generated_at_utc", "")).strip())
    if generated_at is None:
        errors.append(
            "self-check summary timestamp is invalid. Re-run strict self-check before commit."
        )
    else:
        latest_code_mtime = None
        for relative in code_changes:
            absolute = repo_root / relative
            if not absolute.exists():
                continue
            try:
                modified = dt.datetime.fromtimestamp(absolute.stat().st_mtime, tz=dt.UTC)
            except OSError:
                continue
            if latest_code_mtime is None or modified > latest_code_mtime:
                latest_code_mtime = modified
        if latest_code_mtime and generated_at + dt.timedelta(seconds=60) < latest_code_mtime:
            errors.append(
                "Code changed after the latest self-check. Re-run strict self-check before Memory-bank update."
            )

    if "Memory-bank/_generated/self-check-latest.json" not in staged:
        warnings.append(
            "Stage Memory-bank/_generated/self-check-latest.json for audit visibility."
        )

    return errors, warnings

