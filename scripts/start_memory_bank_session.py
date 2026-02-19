from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEMORY_BANK = ROOT / "Memory-bank"
DAILY_DIR = MEMORY_BANK / "daily"
GENERATED_DIR = MEMORY_BANK / "_generated"
DEFAULT_PROFILE = "frontend"
DEFAULT_KEEP_DAYS = 7
DEFAULT_MAX_COMMITS = 5
DEFAULT_MAX_HOURS = 12

START_DOCS = [
    "Memory-bank/daily/LATEST.md",
    "Memory-bank/project-spec.md",
    "Memory-bank/project-details.md",
    "Memory-bank/structure-and-db.md",
    "Memory-bank/tools-and-commands.md",
    "Memory-bank/agentsGlobal-memory.md",
    "Memory-bank/mastermind.md",
]


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start Memory-bank session")
    parser.add_argument("--profile", default=DEFAULT_PROFILE, choices=("backend", "frontend", "mobile"))
    parser.add_argument("--max-commits", type=int, default=DEFAULT_MAX_COMMITS)
    parser.add_argument("--max-hours", type=int, default=DEFAULT_MAX_HOURS)
    parser.add_argument("--author", default="agent")
    parser.add_argument("--ack-read", action="store_true", help="Non-interactive read acknowledgment")
    return parser.parse_args()


def ensure_daily(day: str, now_utc: str) -> None:
    DAILY_DIR.mkdir(parents=True, exist_ok=True)
    today_file = DAILY_DIR / f"{day}.md"
    if not today_file.exists():
        today_file.write_text(
            (
                f"# End-of-Day Report - {day}\n\n"
                f"AUTHOR: session-start\n"
                f"LAST_UPDATED_UTC: {now_utc}\n\n"
                "## Work Summary\n"
                "- Session initialized.\n\n"
                "## Documentation Updated\n"
                "- [ ] agentsGlobal-memory.md\n"
                "- [ ] daily/LATEST.md\n"
            ),
            encoding="utf-8",
        )
    latest_file = DAILY_DIR / "LATEST.md"
    latest_file.write_text(
        (
            "# Latest Daily Report Pointer\n\n"
            f"Latest: {day}\n"
            f"File: Memory-bank/daily/{day}.md\n"
        ),
        encoding="utf-8",
    )


def confirm_read(assume_yes: bool) -> bool:
    print("Read these before coding:")
    for doc in START_DOCS:
        print(f"- {doc}")
    if assume_yes:
        return True
    try:
        answer = input("Type 'yes' to confirm you will read/start from these docs: ").strip().lower()
    except EOFError:
        return False
    return answer in {"y", "yes"}


def main() -> int:
    args = parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    day = now.strftime("%Y-%m-%d")
    now_utc = now.strftime("%Y-%m-%d %H:%M")

    if args.max_commits < 1:
        print("max-commits must be >= 1")
        return 1
    if args.max_hours < 1:
        print("max-hours must be >= 1")
        return 1

    if not confirm_read(args.ack_read):
        print("Session start cancelled. Memory-bank read acknowledgment is required.")
        return 1

    MEMORY_BANK.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    ensure_daily(day, now_utc)

    anchor_commit = run_git(["rev-parse", "HEAD"])
    expires_at = (now + dt.timedelta(hours=args.max_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    state = {
        "started_at_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "expires_at_utc": expires_at,
        "profile": args.profile,
        "author": args.author,
        "max_commits": args.max_commits,
        "max_hours": args.max_hours,
        "anchor_commit": anchor_commit,
        "required_start_docs": START_DOCS,
        "daily_keep_days": DEFAULT_KEEP_DAYS,
    }
    session_path = GENERATED_DIR / "session-state.json"
    session_path.write_text(json.dumps(state, indent=2), encoding="utf-8")

    print("Memory-bank session started.")
    print(f"- state: {session_path.relative_to(ROOT)}")
    print(f"- expires_utc: {expires_at}")
    print(f"- commit_budget: {args.max_commits}")
    print("- next: start coding, then keep Memory-bank docs updated before commit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())