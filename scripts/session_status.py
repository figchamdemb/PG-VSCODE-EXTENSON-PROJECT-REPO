from __future__ import annotations

import datetime as dt
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "Memory-bank" / "_generated" / "session-state.json"


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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())