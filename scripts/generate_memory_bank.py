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
ARCHIVE_DIR = MEMORY_BANK / "_archive"
DEFAULT_PROFILE = "frontend"
DEFAULT_KEEP_DAYS = 7
DEFAULT_AGENTS_GLOBAL_MAX_LINES = 2500
DEFAULT_MASTERMIND_MAX_LINES = 1800
HEADER_FALLBACK_LINES = 12


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


def parse_positive_int(value: str | int, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    if parsed < 1:
        return default
    return parsed


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


def cleanup_daily_files(keep_days: int, today: dt.date) -> list[str]:
    keep_days = max(1, keep_days)
    dated_files: list[tuple[dt.date, Path]] = []
    removed: list[str] = []
    for path in DAILY_DIR.glob("*.md"):
        if path.name == "LATEST.md":
            continue
        try:
            parsed_day = dt.date.fromisoformat(path.stem)
        except ValueError:
            continue
        # Future-dated files can happen from incorrect system clock.
        # Remove them so retention remains deterministic for real history.
        if parsed_day > today:
            removed.append(path.name)
            path.unlink(missing_ok=True)
            continue
        dated_files.append((parsed_day, path))

    dated_files.sort(key=lambda x: x[0], reverse=True)
    for _, path in dated_files[keep_days:]:
        removed.append(path.name)
        path.unlink(missing_ok=True)
    return removed


def split_header_and_body(lines: list[str]) -> tuple[list[str], list[str]]:
    for index, line in enumerate(lines):
        if line.strip() == "---":
            return lines[: index + 1], lines[index + 1 :]
    return lines[:HEADER_FALLBACK_LINES], lines[HEADER_FALLBACK_LINES:]


def rotate_append_only_file(
    *,
    file_path: Path,
    max_lines: int,
    now: dt.datetime,
) -> dict[str, object] | None:
    if not file_path.exists():
        return None

    raw = file_path.read_text(encoding="utf-8", errors="ignore")
    lines = raw.splitlines()
    if len(lines) <= max_lines:
        return None

    header, body = split_header_and_body(lines)
    note_lines = [
        "",
        f"> Older entries archived to `Memory-bank/_archive/{file_path.stem}-archive-{now.strftime('%Y%m%d-%H%M%S')}.md` on {now.strftime('%Y-%m-%d %H:%M UTC')}.",
        "",
    ]
    head_len = len(header)
    tail_budget = max(1, max_lines - head_len - len(note_lines))
    if len(body) <= tail_budget:
        # Fallback: simple keep-last strategy when split cannot reduce.
        removed_lines = lines[:-max_lines]
        kept_tail = lines[-max_lines:]
        header = []
        body = kept_tail
    else:
        removed_lines = body[:-tail_budget]
        body = body[-tail_budget:]

    ensure_dir(ARCHIVE_DIR)
    stamp = now.strftime("%Y%m%d-%H%M%S")
    archive_name = f"{file_path.stem}-archive-{stamp}.md"
    archive_path = ARCHIVE_DIR / archive_name
    archive_header = [
        f"# Archive from {file_path.name}",
        "",
        f"GENERATED_UTC: {now.strftime('%Y-%m-%d %H:%M')}",
        f"SOURCE_FILE: Memory-bank/{file_path.name}",
        f"REMOVED_LINES: {len(removed_lines)}",
        "",
    ]
    archive_path.write_text(
        "\n".join(archive_header + removed_lines).rstrip() + "\n",
        encoding="utf-8",
    )

    note_lines[1] = (
        f"> Older entries archived to `Memory-bank/_archive/{archive_name}` "
        f"on {now.strftime('%Y-%m-%d %H:%M UTC')}."
    )
    updated = header + note_lines + body
    if len(updated) > max_lines:
        overflow = len(updated) - max_lines
        if overflow < len(body):
            body = body[overflow:]
            updated = header + note_lines + body
        else:
            updated = updated[-max_lines:]
    file_path.write_text("\n".join(updated).rstrip() + "\n", encoding="utf-8")

    return {
        "file": f"Memory-bank/{file_path.name}",
        "limit_lines": max_lines,
        "previous_lines": len(lines),
        "new_lines": len(updated),
        "archived_lines": len(removed_lines),
        "archive_file": f"Memory-bank/_archive/{archive_name}",
    }


def main() -> int:
    args = parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    day = now.strftime("%Y-%m-%d")
    now_utc = now.strftime("%Y-%m-%d %H:%M")

    ensure_dir(MEMORY_BANK)
    ensure_dir(DAILY_DIR)
    ensure_dir(ARCHIVE_DIR)
    ensure_dir(MEMORY_BANK / "db-schema")
    ensure_dir(MEMORY_BANK / "code-tree")
    ensure_dir(GENERATED_DIR)

    daily_file = DAILY_DIR / f"{day}.md"
    ensure_file(daily_file, daily_report_content(day, now_utc, args.author))

    latest_file = DAILY_DIR / "LATEST.md"
    latest_file.write_text(latest_pointer_content(day), encoding="utf-8")

    removed = cleanup_daily_files(args.keep_days, now.date())

    agents_global_limit = parse_positive_int(
        os.getenv("MEMORY_BANK_AGENTS_GLOBAL_MAX_LINES", str(DEFAULT_AGENTS_GLOBAL_MAX_LINES)),
        DEFAULT_AGENTS_GLOBAL_MAX_LINES,
    )
    mastermind_limit = parse_positive_int(
        os.getenv("MEMORY_BANK_MASTERMIND_MAX_LINES", str(DEFAULT_MASTERMIND_MAX_LINES)),
        DEFAULT_MASTERMIND_MAX_LINES,
    )
    rotations = []
    for target_file, target_limit in (
        (MEMORY_BANK / "agentsGlobal-memory.md", agents_global_limit),
        (MEMORY_BANK / "mastermind.md", mastermind_limit),
    ):
        rotation = rotate_append_only_file(
            file_path=target_file,
            max_lines=target_limit,
            now=now,
        )
        if rotation:
            rotations.append(rotation)

    generated_state = {
        "generated_at_utc": now_utc,
        "profile": args.profile,
        "keep_days": args.keep_days,
        "daily_file": f"Memory-bank/daily/{day}.md",
        "removed_daily_files": removed,
        "long_file_rotations": rotations,
        "agents_global_max_lines": agents_global_limit,
        "mastermind_max_lines": mastermind_limit,
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
    if rotations:
        for rotation in rotations:
            print(
                "- rotated long file: {file} -> {archive_file} "
                "({previous_lines} -> {new_lines})".format(**rotation)
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
