from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEMORY_BANK = ROOT / "Memory-bank"
GENERATED_DIR = MEMORY_BANK / "_generated"
DAILY_DIR = MEMORY_BANK / "daily"
SESSION_PATH = GENERATED_DIR / "session-state.json"
LAST_SESSION_PATH = GENERATED_DIR / "last-session.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="End Memory-bank session")
    parser.add_argument("--author", default="agent")
    parser.add_argument("--note", default="")
    parser.add_argument("--keep-state", action="store_true")
    return parser.parse_args()


def ensure_daily(day: str, now_utc: str) -> Path:
    DAILY_DIR.mkdir(parents=True, exist_ok=True)
    daily_file = DAILY_DIR / f"{day}.md"
    if not daily_file.exists():
        daily_file.write_text(
            (
                f"# End-of-Day Report - {day}\n\n"
                f"AUTHOR: session-end\n"
                f"LAST_UPDATED_UTC: {now_utc}\n\n"
                "## Work Summary\n"
                "- Session ended.\n"
            ),
            encoding="utf-8",
        )
    latest = DAILY_DIR / "LATEST.md"
    latest.write_text(
        (
            "# Latest Daily Report Pointer\n\n"
            f"Latest: {day}\n"
            f"File: Memory-bank/daily/{day}.md\n"
        ),
        encoding="utf-8",
    )
    return daily_file


def append_session_event(daily_file: Path, now_utc: str, author: str, note: str) -> None:
    existing = daily_file.read_text(encoding="utf-8")
    if "## Session Events" not in existing:
        existing = existing.rstrip() + "\n\n## Session Events\n"
    line = f"- [{now_utc} UTC] Session ended by `{author}`"
    if note.strip():
        line += f" - {note.strip()}"
    daily_file.write_text(existing.rstrip() + "\n" + line + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    now_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    now_utc = now.strftime("%Y-%m-%d %H:%M")
    day = now.strftime("%Y-%m-%d")

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    MEMORY_BANK.mkdir(parents=True, exist_ok=True)

    state: dict = {}
    if SESSION_PATH.exists():
        try:
            state = json.loads(SESSION_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            state = {}

    state["ended_at_utc"] = now_iso
    state["ended_by"] = args.author
    state["end_note"] = args.note

    LAST_SESSION_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")

    daily_file = ensure_daily(day, now_utc)
    append_session_event(daily_file, now_utc, args.author, args.note)

    if SESSION_PATH.exists() and not args.keep_state:
        SESSION_PATH.unlink(missing_ok=True)

    print("Memory-bank session ended.")
    print(f"- last_session: {LAST_SESSION_PATH.relative_to(ROOT)}")
    if not args.keep_state:
        print("- session-state: closed")
    else:
        print("- session-state: kept (--keep-state)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())