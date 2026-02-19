from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROFILE = "frontend"
OUTPUT = ROOT / "Memory-bank" / "_generated" / f"{PROFILE}-summary.json"

IGNORE_DIRS = {
    ".git",
    ".idea",
    ".vscode",
    "node_modules",
    "target",
    "build",
    "dist",
    "coverage",
    ".gradle",
    ".next",
    ".venv",
    "venv",
}

MARKER_FILES = {
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "package.json",
    "pubspec.yaml",
}


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")


def top_level_entries() -> list[str]:
    items = []
    for entry in ROOT.iterdir():
        if entry.name in IGNORE_DIRS:
            continue
        items.append(entry.name)
    return sorted(items)


def component_roots() -> list[str]:
    components = set()
    for marker in MARKER_FILES:
        for file in ROOT.rglob(marker):
            if any(part in IGNORE_DIRS for part in file.parts):
                continue
            components.add(relative(file.parent))
    return sorted(components)


def migration_files(limit: int = 250) -> list[str]:
    files = []
    for path in ROOT.rglob("*.sql"):
        rel = relative(path).lower()
        if "migration" not in rel:
            continue
        files.append(rel)
        if len(files) >= limit:
            break
    return sorted(files)


def main() -> int:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "profile": PROFILE,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "repo_root": str(ROOT),
        "top_level_entries": top_level_entries(),
        "component_roots": component_roots(),
        "migration_files": migration_files(),
    }
    OUTPUT.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Summary written: {relative(OUTPUT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())