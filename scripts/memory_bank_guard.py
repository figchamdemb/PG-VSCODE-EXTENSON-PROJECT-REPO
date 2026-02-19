from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEMORY_BANK = ROOT / "Memory-bank"
DEFAULT_MODE = "warn"
DEFAULT_PROFILE = "frontend"
SESSION_STATE = MEMORY_BANK / "_generated" / "session-state.json"
DEFAULT_MAX_SESSION_COMMITS = 5
DEFAULT_MAX_SESSION_HOURS = 12

COMMON_CODE_EXT = {
    ".java", ".kt", ".kts", ".xml", ".yml", ".yaml", ".properties", ".sql",
    ".js", ".jsx", ".ts", ".tsx", ".css", ".scss", ".sass", ".less", ".html",
    ".json", ".mdx", ".vue", ".svelte", ".dart", ".swift", ".m", ".mm",
    ".gradle", ".rb", ".go", ".py", ".sh", ".ps1",
}

CONFIG_FILE_NAMES = {
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Dockerfile",
}

TOOLING_HINTS = (
    "docker-compose",
    "gradle",
    "mvnw",
    "pom.xml",
    "package.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    ".tool-versions",
    ".nvmrc",
    "application.yml",
    "application.yaml",
    "application.properties",
)

MAX_SCREEN_PAGE_LINES = 500


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


def staged_files() -> list[str]:
    out = run_git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
    if not out:
        return []
    prefix = run_git(["rev-parse", "--show-prefix"]).strip().replace("\\", "/")
    if prefix and not prefix.endswith("/"):
        prefix += "/"
    staged: list[str] = []
    for raw in out.splitlines():
        path = raw.strip().replace("\\", "/")
        if not path:
            continue
        if prefix:
            if not path.startswith(prefix):
                continue
            path = path[len(prefix):]
        if path.startswith("../") or not path:
            continue
        staged.append(path)
    return staged


def is_code_change(path: str) -> bool:
    if path.startswith("Memory-bank/") or path.startswith(".github/") or path.startswith(".githooks/"):
        return False
    p = Path(path)
    if p.name in CONFIG_FILE_NAMES:
        return True
    return p.suffix.lower() in COMMON_CODE_EXT


def is_migration_change(path: str) -> bool:
    lower = path.lower()
    return lower.endswith(".sql") and ("db/migration/" in lower or "migrations/" in lower)


def is_tooling_change(path: str) -> bool:
    lower = path.lower()
    name = Path(path).name.lower()
    if name in {x.lower() for x in CONFIG_FILE_NAMES}:
        return True
    return any(hint in lower for hint in TOOLING_HINTS)


def is_screen_or_page_file(path: str) -> bool:
    lower = path.lower()
    name = Path(path).name.lower()
    if "/screens/" in lower or "/screen/" in lower or "/pages/" in lower:
        return True
    if name in {"page.tsx", "page.jsx", "page.ts", "page.js", "page.kt", "page.swift"}:
        return True
    if name.endswith("screen.kt") or name.endswith("screen.tsx") or name.endswith("screen.jsx"):
        return True
    return False


def line_count(path: Path) -> int:
    try:
        return len(path.read_text(encoding="utf-8", errors="ignore").splitlines())
    except OSError:
        return 0


def parse_mode(cli_mode: str | None) -> str:
    if cli_mode:
        return cli_mode
    env_mode = os.getenv("MB_ENFORCEMENT_MODE", "").strip().lower()
    if env_mode in {"warn", "strict"}:
        return env_mode
    git_mode = run_git(["config", "--get", "memorybank.mode"]).strip().lower()
    if git_mode in {"warn", "strict"}:
        return git_mode
    return DEFAULT_MODE


def today_utc() -> str:
    return dt.datetime.now(dt.UTC).strftime("%Y-%m-%d")


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


def load_session_state() -> dict:
    if not SESSION_STATE.exists():
        return {}
    try:
        return json.loads(SESSION_STATE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def parse_positive_int(value: object, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    if parsed < 1:
        return default
    return parsed


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


def validate_session() -> list[str]:
    errors: list[str] = []
    state = load_session_state()
    command = ".\\pg.ps1 start -Yes"

    if not state:
        errors.append(
            "Session is not started. Run start session command before coding:\n"
            f"- {command}"
        )
        return errors

    started_at = parse_iso_utc(str(state.get("started_at_utc", "")).strip())
    if started_at is None:
        errors.append(
            "Session state is invalid (missing/invalid started_at_utc). Re-run:\n"
            f"- {command}"
        )
        return errors

    max_hours = parse_positive_int(state.get("max_hours"), DEFAULT_MAX_SESSION_HOURS)
    age_hours = (dt.datetime.now(dt.UTC) - started_at).total_seconds() / 3600.0
    if age_hours > max_hours:
        errors.append(
            f"Session is stale ({age_hours:.1f}h old, limit {max_hours}h). Re-run:\n"
            f"- {command}"
        )

    anchor = str(state.get("anchor_commit", "")).strip()
    max_commits = parse_positive_int(state.get("max_commits"), DEFAULT_MAX_SESSION_COMMITS)
    commits_used = commits_since_anchor(anchor)
    if commits_used is None:
        errors.append(
            "Session anchor commit is invalid (history changed). Re-run:\n"
            f"- {command}"
        )
    elif commits_used >= max_commits:
        errors.append(
            f"Session commit budget reached ({commits_used}/{max_commits}). Re-run:\n"
            f"- {command}"
        )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Memory-bank pre-commit guard")
    parser.add_argument("--mode", choices=("warn", "strict"), default=None)
    args = parser.parse_args()

    mode = parse_mode(args.mode)
    if os.getenv("SKIP_MEMORY_BANK_GUARD") == "1":
        print("[memory-bank-guard] bypassed via SKIP_MEMORY_BANK_GUARD=1")
        return 0

    if not MEMORY_BANK.exists():
        message = "[memory-bank-guard] Memory-bank folder is missing."
        if mode == "strict":
            print(message)
            return 1
        print(f"{message} WARN mode allows commit.")
        return 0

    staged = staged_files()
    if not staged:
        return 0

    code_changes = [p for p in staged if is_code_change(p)]
    if not code_changes:
        return 0

    migration_changes = [p for p in staged if is_migration_change(p)]
    tooling_changes = [p for p in staged if is_tooling_change(p)]
    errors: list[str] = []
    warnings: list[str] = []
    session_errors = validate_session()
    errors.extend(session_errors)

    if not any(p.startswith("Memory-bank/") for p in staged):
        errors.append("Code changed but no Memory-bank file is staged.")

    if migration_changes and not any(
        p.startswith("Memory-bank/db-schema/") and p.endswith(".md") for p in staged
    ):
        errors.append("Migration changed but no db-schema markdown file is staged.")

    if "Memory-bank/agentsGlobal-memory.md" not in staged:
        errors.append("Missing staged update: Memory-bank/agentsGlobal-memory.md")

    today = today_utc()
    if f"Memory-bank/daily/{today}.md" not in staged:
        errors.append(f"Missing staged update: Memory-bank/daily/{today}.md")
    if "Memory-bank/daily/LATEST.md" not in staged:
        errors.append("Missing staged update: Memory-bank/daily/LATEST.md")

    if "Memory-bank/project-details.md" not in staged:
        errors.append(
            "Missing staged update: Memory-bank/project-details.md "
            "(track plan/feature status or note 'no plan changes')."
        )

    if tooling_changes and "Memory-bank/tools-and-commands.md" not in staged:
        errors.append("Tooling/runtime/start-command changes detected but Memory-bank/tools-and-commands.md is not staged.")

    oversized_screen_files: list[tuple[str, int]] = []
    for path in code_changes:
        if not is_screen_or_page_file(path):
            continue
        abs_path = ROOT / path
        lines = line_count(abs_path)
        if lines > MAX_SCREEN_PAGE_LINES:
            oversized_screen_files.append((path, lines))

    for path, lines in oversized_screen_files:
        warnings.append(
            f"Screen/Page file exceeds {MAX_SCREEN_PAGE_LINES} lines: {path} ({lines} lines). Refactor to <= {MAX_SCREEN_PAGE_LINES}."
        )

    if mode == "strict" and warnings:
        errors.extend(warnings)

    if not errors and not warnings:
        print(f"[memory-bank-guard] PASS ({mode})")
        return 0

    print(f"[memory-bank-guard] POLICY ISSUES ({mode})")
    for idx, err in enumerate(errors, start=1):
        print(f"{idx}. {err}")
    if warnings and mode != "strict":
        print("\nWarnings:")
        for idx, warning in enumerate(warnings, start=1):
            print(f"{idx}. {warning}")

    print("\nQuick fix:")
    print("0) .\\pg.ps1 start -Yes")
    print("1) python scripts/build_frontend_summary.py")
    print("2) python scripts/generate_memory_bank.py --profile frontend --keep-days 7")
    print("3) stage Memory-bank updates and commit again")

    if session_errors:
        print("Session policy is blocking in all modes. Start a fresh session first.")
        return 1

    if mode == "strict":
        return 1

    print("WARN mode active: commit is allowed, but update Memory-bank immediately.")
    return 0


if __name__ == "__main__":
    sys.exit(main())