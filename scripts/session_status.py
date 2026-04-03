from __future__ import annotations

import datetime as dt
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "Memory-bank" / "_generated" / "session-state.json"
MAP_SUMMARY_PATH = ROOT / "Memory-bank" / "_generated" / "map-structure-latest.json"
SELF_CHECK_SUMMARY_PATH = ROOT / "Memory-bank" / "_generated" / "self-check-latest.json"
DAILY_DIR = ROOT / "Memory-bank" / "daily"
DEFAULT_KEEP_DAYS = 7
DEFAULT_AGENTS_GLOBAL_MAX_LINES = 2500
DEFAULT_MASTERMIND_MAX_LINES = 1800
MAP_IGNORE_DIRS = {
    ".git", ".github", ".vscode", "Memory-bank", "node_modules", "dist", "build", "coverage", "target", ".next", ".venv", "venv", "__pycache__", "logs", "test-results"
}
MAP_CODE_EXTS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".java", ".kt", ".go", ".rs", ".cs", ".php", ".rb", ".swift", ".sql", ".graphql", ".gql", ".yaml", ".yml"
}
MAP_NAME_HINTS = {"schema.prisma", "Dockerfile", "docker-compose.yml", "docker-compose.yaml"}


def run_git(args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


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


def parse_map_generated_utc(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        parsed = dt.datetime.strptime(value.strip(), "%Y-%m-%d %H:%M")
    except ValueError:
        return None
    return parsed.replace(tzinfo=dt.UTC)


def get_latest_code_like_mtime() -> dt.datetime | None:
    latest = None
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in MAP_IGNORE_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in MAP_CODE_EXTS and path.name not in MAP_NAME_HINTS:
            continue
        modified = dt.datetime.fromtimestamp(path.stat().st_mtime, tz=dt.UTC)
        if latest is None or modified > latest:
            latest = modified
    return latest


def get_map_structure_status(now_utc: dt.datetime) -> tuple[str, str]:
    if not MAP_SUMMARY_PATH.exists():
        return ("MISSING", "run .\\pg.ps1 map-structure")
    try:
        payload = json.loads(MAP_SUMMARY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ("INVALID", "regenerate via .\\pg.ps1 map-structure")
    generated = parse_map_generated_utc(str(payload.get("generated_at_utc", "")).strip())
    if generated is None:
        return ("INVALID", "regenerate via .\\pg.ps1 map-structure")
    latest_code = get_latest_code_like_mtime()
    if latest_code and generated + dt.timedelta(seconds=120) < latest_code:
        return ("STALE", "source files are newer than map docs; run .\\pg.ps1 map-structure")
    return ("OK", f"generated_at_utc={generated.strftime('%Y-%m-%d %H:%M:%S')}")


def get_self_check_status() -> tuple[str, str]:
    if not SELF_CHECK_SUMMARY_PATH.exists():
        return ("MISSING", "run .\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck")
    try:
        payload = json.loads(SELF_CHECK_SUMMARY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ("INVALID", "re-run strict self-check")
    status = str(payload.get("status", "")).strip().lower()
    if status == "pass":
        db_enabled = bool(payload.get("enable_db_index_maintenance_check"))
        playwright = bool(payload.get("enable_playwright_smoke_check"))
        return ("PASS", f"db_index={db_enabled} playwright={playwright}")
    if status:
        return (status.upper(), "re-run strict self-check before commit")
    return ("UNKNOWN", "re-run strict self-check before commit")


def commits_since_anchor(anchor: str) -> int | None:
    if not anchor:
        return 0
    head = run_git(["rev-parse", "HEAD"]).strip()
    if not head:
        return 0
    if head == anchor:
        return 0
    if not run_git(["rev-parse", "--verify", anchor]).strip():
        return None
    out = run_git(["rev-list", "--count", f"{anchor}..HEAD"]).strip()
    if not out:
        return None
    try:
        return int(out)
    except ValueError:
        return None


def parse_positive_int(value: str, default: int) -> int:
    try:
        parsed = int(value)
    except ValueError:
        return default
    if parsed < 1:
        return default
    return parsed


def get_daily_retention_summary(today_utc: dt.date) -> tuple[int, int, list[str], list[str]]:
    keep_days = parse_positive_int(
        os.getenv("MEMORY_BANK_DAILY_KEEP_DAYS", str(DEFAULT_KEEP_DAYS)),
        DEFAULT_KEEP_DAYS,
    )
    if not DAILY_DIR.exists():
        return keep_days, 0, [], []

    dated_files: list[tuple[dt.date, str]] = []
    future_files: list[str] = []
    for path in DAILY_DIR.glob("*.md"):
        if path.name == "LATEST.md":
            continue
        try:
            day = dt.date.fromisoformat(path.stem)
        except ValueError:
            continue
        dated_files.append((day, path.name))
        if day > today_utc:
            future_files.append(path.name)

    dated_files.sort(key=lambda item: item[0], reverse=True)
    overflow_files = [name for _, name in dated_files[keep_days:]]
    return keep_days, len(dated_files), overflow_files, sorted(future_files)


def get_long_file_line_count(relative_path: str) -> int:
    path = ROOT / relative_path
    if not path.exists():
        return 0
    try:
        return len(path.read_text(encoding="utf-8", errors="ignore").splitlines())
    except OSError:
        return 0


def main() -> int:
    if not STATE_PATH.exists():
        print("Session status: NONE")
        print("Run: .\\pg.ps1 start -Yes")
        return 1

    try:
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print("Session status: INVALID (JSON parse error)")
        return 2

    started_at = parse_iso_utc(str(state.get("started_at_utc", "")).strip())
    expires_at = parse_iso_utc(str(state.get("expires_at_utc", "")).strip())
    max_commits = int(state.get("max_commits", 5))
    anchor = str(state.get("anchor_commit", "")).strip()
    commits_used = commits_since_anchor(anchor)

    print("Session status: ACTIVE")
    print(f"- state_file: {STATE_PATH.relative_to(ROOT)}")
    if started_at:
        age_hours = (dt.datetime.now(dt.UTC) - started_at).total_seconds() / 3600.0
        print(f"- started_at_utc: {started_at.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"- age_hours: {age_hours:.2f}")
    if expires_at:
        print(f"- expires_at_utc: {expires_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"- max_commits: {max_commits}")
    if commits_used is None:
        print("- commits_used: unknown (anchor not found)")
    else:
        remaining = max_commits - commits_used
        print(f"- commits_used: {commits_used}")
        print(f"- commits_remaining: {remaining}")

    keep_days, dated_count, overflow_files, future_files = get_daily_retention_summary(dt.datetime.now(dt.UTC).date())
    print(f"- daily_reports_count: {dated_count}")
    print(f"- daily_keep_days: {keep_days}")
    if overflow_files:
        preview = ", ".join(overflow_files[:8])
        if len(overflow_files) > 8:
            preview += ", ..."
        print(f"- daily_retention: OVER_LIMIT ({len(overflow_files)} extra): {preview}")
        print(
            f"- daily_fix: python scripts/generate_memory_bank.py --profile frontend --keep-days {keep_days}"
        )
    else:
        print("- daily_retention: OK")
    if future_files:
        preview = ", ".join(future_files[:8])
        if len(future_files) > 8:
            preview += ", ..."
        print(f"- daily_future_files: {preview}")

    agents_limit = parse_positive_int(
        os.getenv("MEMORY_BANK_AGENTS_GLOBAL_MAX_LINES", str(DEFAULT_AGENTS_GLOBAL_MAX_LINES)),
        DEFAULT_AGENTS_GLOBAL_MAX_LINES,
    )
    mastermind_limit = parse_positive_int(
        os.getenv("MEMORY_BANK_MASTERMIND_MAX_LINES", str(DEFAULT_MASTERMIND_MAX_LINES)),
        DEFAULT_MASTERMIND_MAX_LINES,
    )
    agents_lines = get_long_file_line_count("Memory-bank/agentsGlobal-memory.md")
    mastermind_lines = get_long_file_line_count("Memory-bank/mastermind.md")
    print(f"- agents_global_lines: {agents_lines} (limit {agents_limit})")
    print(f"- mastermind_lines: {mastermind_lines} (limit {mastermind_limit})")
    if agents_lines > agents_limit or mastermind_lines > mastermind_limit:
        print("- memory_log_retention: OVER_LIMIT")
        print(
            "- memory_log_fix: python scripts/generate_memory_bank.py --profile frontend --keep-days "
            f"{keep_days}"
        )
    else:
        print("- memory_log_retention: OK")

    map_state, map_detail = get_map_structure_status(dt.datetime.now(dt.UTC))
    print(f"- map_structure: {map_state}")
    print(f"- map_structure_detail: {map_detail}")

    self_check_state, self_check_detail = get_self_check_status()
    print(f"- self_check: {self_check_state}")
    print(f"- self_check_detail: {self_check_detail}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
