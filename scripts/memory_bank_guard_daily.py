from __future__ import annotations

import datetime as dt
import os
from pathlib import Path

DEFAULT_DAILY_KEEP_DAYS = 7


def _parse_positive_int(value: str, default: int) -> int:
    try:
        parsed = int(value)
    except ValueError:
        return default
    if parsed < 1:
        return default
    return parsed


def validate_daily_retention(*, repo_root: Path, today: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    daily_dir = repo_root / "Memory-bank" / "daily"
    if not daily_dir.exists():
        errors.append("Missing required folder: Memory-bank/daily")
        return errors, warnings

    keep_days = _parse_positive_int(
        os.getenv("MEMORY_BANK_DAILY_KEEP_DAYS", str(DEFAULT_DAILY_KEEP_DAYS)),
        DEFAULT_DAILY_KEEP_DAYS,
    )
    today_date = dt.date.fromisoformat(today)
    dated_files: list[tuple[dt.date, Path]] = []
    invalid_name_files: list[str] = []
    future_files: list[str] = []

    for path in daily_dir.glob("*.md"):
        if path.name == "LATEST.md":
            continue
        try:
            parsed_day = dt.date.fromisoformat(path.stem)
        except ValueError:
            invalid_name_files.append(path.name)
            continue
        dated_files.append((parsed_day, path))
        if parsed_day > today_date:
            future_files.append(path.name)

    dated_files.sort(key=lambda item: item[0], reverse=True)
    if len(dated_files) > keep_days:
        overflow = len(dated_files) - keep_days
        overflow_names = [item[1].name for item in dated_files[keep_days:]]
        preview = ", ".join(overflow_names[:8])
        if len(overflow_names) > 8:
            preview += ", ..."
        errors.append(
            f"Daily retention exceeded: {len(dated_files)} dated files (limit {keep_days}). "
            f"Prune oldest {overflow} file(s): {preview}. Run "
            f"'python scripts/generate_memory_bank.py --profile frontend --keep-days {keep_days}'."
        )

    if invalid_name_files:
        preview = ", ".join(sorted(invalid_name_files)[:8])
        if len(invalid_name_files) > 8:
            preview += ", ..."
        warnings.append(
            "Non-date files found under Memory-bank/daily (ignored by retention parser): "
            f"{preview}. Keep only YYYY-MM-DD.md plus LATEST.md."
        )

    if future_files:
        preview = ", ".join(sorted(future_files)[:8])
        if len(future_files) > 8:
            preview += ", ..."
        warnings.append(
            f"Future-dated daily files detected: {preview}. "
            "These can confuse retention ordering if the system date was incorrect."
        )

    return errors, warnings
