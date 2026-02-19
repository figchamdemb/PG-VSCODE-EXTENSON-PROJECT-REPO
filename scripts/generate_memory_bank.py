from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEMORY_BANK = ROOT / "Memory-bank"
DAILY_DIR = MEMORY_BANK / "daily"
GENERATED_DIR = MEMORY_BANK / "_generated"
DEFAULT_PROFILE = "frontend"
DEFAULT_KEEP_DAYS = 7


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def ensure_file(path: Path, content: str) -> None:
    ensure_dir(path.parent)
    if not path.exists():
        path.write_text(content, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate/update Memory-bank daily pointers")
    parser.add_argument("--profile", default=DEFAULT_PROFILE, choices=("backend", "frontend", "mobile"))
    parser.add_argument(
        "--keep-days",
        type=int,
        default=int(os.getenv("MEMORY_BANK_DAILY_KEEP_DAYS", str(DEFAULT_KEEP_DAYS))),
        help="How many daily reports to keep",
    )
    parser.add_argument("--author", default=os.getenv("MEMORY_BANK_AUTHOR", "agent"))
    return parser.parse_args()


def daily_report_content(day: str, now_utc: str, author: str) -> str:
    return (
        f"# End-of-Day Report - {day}\n\n"
        f"AUTHOR: {author}\n"
        f"LAST_UPDATED_UTC: {now_utc}\n\n"
        "## Work Summary\n"
        "- Session summary goes here.\n\n"
        "## Changes Index\n"
        "- Paths: \n"
        "- Symbols/anchors: \n\n"
        "## Documentation Updated\n"
        "- [ ] structure-and-db.md\n"
        "- [ ] db-schema/*.md\n"
        "- [ ] code-tree/*.md\n"
        "- [ ] agentsGlobal-memory.md\n"
        "- [ ] daily/LATEST.md\n"
    )


def latest_pointer_content(day: str) -> str:
    return (
        "# Latest Daily Report Pointer\n\n"
        f"Latest: {day}\n"
        f"File: Memory-bank/daily/{day}.md\n"
    )


def cleanup_daily_files(keep_days: int) -> list[str]:
    keep_days = max(1, keep_days)
    dated_files: list[tuple[dt.date, Path]] = []
    for path in DAILY_DIR.glob("*.md"):
        if path.name == "LATEST.md":
            continue
        try:
            dated_files.append((dt.date.fromisoformat(path.stem), path))
        except ValueError:
            continue

    dated_files.sort(key=lambda x: x[0], reverse=True)
    removed: list[str] = []
    for _, path in dated_files[keep_days:]:
        removed.append(path.name)
        path.unlink(missing_ok=True)
    return removed


def main() -> int:
    args = parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    day = now.strftime("%Y-%m-%d")
    now_utc = now.strftime("%Y-%m-%d %H:%M")

    ensure_dir(MEMORY_BANK)
    ensure_dir(DAILY_DIR)
    ensure_dir(MEMORY_BANK / "db-schema")
    ensure_dir(MEMORY_BANK / "code-tree")
    ensure_dir(GENERATED_DIR)

    daily_file = DAILY_DIR / f"{day}.md"
    ensure_file(daily_file, daily_report_content(day, now_utc, args.author))

    latest_file = DAILY_DIR / "LATEST.md"
    latest_file.write_text(latest_pointer_content(day), encoding="utf-8")

    removed = cleanup_daily_files(args.keep_days)

    generated_state = {
        "generated_at_utc": now_utc,
        "profile": args.profile,
        "keep_days": args.keep_days,
        "daily_file": f"Memory-bank/daily/{day}.md",
        "removed_daily_files": removed,
    }
    (GENERATED_DIR / "memory-bank-state.json").write_text(
        json.dumps(generated_state, indent=2),
        encoding="utf-8",
    )

    print("Memory-bank generation complete.")
    print(f"- profile: {args.profile}")
    print(f"- latest: Memory-bank/daily/{day}.md")
    if removed:
        print(f"- removed old daily files: {', '.join(removed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())