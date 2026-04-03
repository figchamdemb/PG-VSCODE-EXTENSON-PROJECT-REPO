from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
from pathlib import Path

from map_structure_db import write_db_schema_file

ROOT = Path(__file__).resolve().parents[1]
MEMORY_BANK = ROOT / "Memory-bank"
CODE_TREE_DIR = MEMORY_BANK / "code-tree"
DB_SCHEMA_DIR = MEMORY_BANK / "db-schema"
GENERATED_DIR = MEMORY_BANK / "_generated"

IGNORE_DIRS = {
    ".git",
    ".github",
    ".idea",
    ".vscode",
    ".verificaton-before-production-folder",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "target",
    ".gradle",
    ".next",
    ".venv",
    "venv",
    "__pycache__",
    "Memory-bank",
    "logs",
    "test-results",
}

MARKER_PATTERNS = (
    "package.json",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "go.mod",
    "Cargo.toml",
    "pyproject.toml",
    "requirements.txt",
    "composer.json",
    "Gemfile",
    "*.csproj",
    "*.sln",
)

CODE_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".java",
    ".kt",
    ".go",
    ".rs",
    ".cs",
    ".php",
    ".rb",
    ".swift",
    ".sql",
    ".graphql",
    ".gql",
    ".yaml",
    ".yml",
    ".json",
    ".md",
    ".sh",
    ".ps1",
}

KEY_FILE_NAMES = {
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "schema.prisma",
    "openapi.json",
    "openapi.yaml",
    "openapi.yml",
    ".env",
    ".env.example",
    "tsconfig.json",
    "README.md",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Memory-bank code-tree and db-schema docs from an existing project."
    )
    parser.add_argument("--profile", choices=("auto", "backend", "frontend", "mobile"), default="auto")
    parser.add_argument("--max-depth", type=int, default=4)
    parser.add_argument("--max-entries", type=int, default=1400)
    parser.add_argument("--max-components", type=int, default=12)
    parser.add_argument("--author", default=os.getenv("MEMORY_BANK_AUTHOR", "agent"))
    return parser.parse_args()


def normalize_positive(value: int, default: int) -> int:
    return value if value >= 1 else default


def rel_path(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")


def is_ignored(path: Path) -> bool:
    return any(part in IGNORE_DIRS for part in path.parts)


def sanitize_slug(value: str) -> str:
    slug = value.replace("\\", "-").replace("/", "-").replace(" ", "-").lower().strip("-")
    slug = re.sub(r"[^a-z0-9._-]", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:70] if slug else "root"


def detect_profile() -> str:
    state_path = GENERATED_DIR / "session-state.json"
    if state_path.exists():
        try:
            payload = json.loads(state_path.read_text(encoding="utf-8"))
            profile = str(payload.get("profile", "")).strip().lower()
            if profile in {"backend", "frontend", "mobile"}:
                return profile
        except Exception:
            pass
    if (ROOT / "server").exists() or (ROOT / "pom.xml").exists() or (ROOT / "go.mod").exists():
        return "backend"
    return "frontend"


def discover_component_roots(max_components: int) -> list[Path]:
    candidates: set[Path] = {ROOT}
    for marker in MARKER_PATTERNS:
        for match in ROOT.rglob(marker):
            if match.is_file() and not is_ignored(match):
                candidates.add(match.parent)
    for child in ROOT.iterdir():
        if child.is_dir() and not is_ignored(child) and ((child / "src").exists() or (child / "app").exists()):
            candidates.add(child)

    def sort_key(path: Path) -> tuple[int, int, str]:
        if path == ROOT:
            return (0, 0, "")
        rel = path.relative_to(ROOT)
        return (1, len(rel.parts), str(rel).lower())

    ordered = sorted(candidates, key=sort_key)
    return [path for path in ordered if not is_ignored(path)][: max(1, max_components)]


def should_include_file(path: Path) -> bool:
    if path.name in KEY_FILE_NAMES:
        return True
    if path.suffix.lower() in CODE_EXTENSIONS:
        return True
    lowered = path.name.lower()
    return lowered.startswith("dockerfile") or lowered.endswith(".env.example")


def render_tree_lines(component_root: Path, max_depth: int, max_entries: int) -> tuple[list[str], bool]:
    lines, truncated = [f"- {component_root.name}/"], False
    max_depth = max(1, max_depth)
    max_entries = max(100, max_entries)

    def walk(directory: Path, depth: int) -> None:
        nonlocal truncated
        if truncated or depth > max_depth:
            return
        try:
            children = [child for child in directory.iterdir() if not is_ignored(child)]
        except Exception:
            return
        children.sort(key=lambda p: (p.is_file(), p.name.lower()))
        for child in children:
            if truncated:
                return
            if child.is_dir():
                lines.append(f"{'  ' * depth}- {child.name}/")
                if len(lines) >= max_entries:
                    truncated = True
                    return
                walk(child, depth + 1)
                continue
            if not should_include_file(child):
                continue
            lines.append(f"{'  ' * depth}- {child.name}")
            if len(lines) >= max_entries:
                truncated = True
                return

    walk(component_root, 1)
    return lines, truncated


def infer_file_purpose(relative_file: str) -> tuple[str, str]:
    lowered = relative_file.lower()
    if "controller" in lowered:
        return ("HTTP/API controller", "Auto-detected by filename pattern")
    if "route" in lowered or "router" in lowered:
        return ("Route or endpoint mapping", "Auto-detected by filename pattern")
    if "service" in lowered:
        return ("Business/service logic", "Auto-detected by filename pattern")
    if "repository" in lowered or "dao" in lowered:
        return ("Persistence access layer", "Auto-detected by filename pattern")
    if "schema" in lowered or lowered.endswith("schema.prisma"):
        return ("Schema definition", "Auto-detected schema artifact")
    if "migration" in lowered:
        return ("DB migration script", "Auto-detected migration artifact")
    if lowered.endswith((".yaml", ".yml", ".json")):
        return ("Configuration/spec file", "Auto-detected config artifact")
    return ("Source/config artifact", "Auto-detected")


def collect_key_files(component_root: Path, limit: int = 60) -> list[tuple[str, str, str]]:
    candidates: list[tuple[int, str, str, str]] = []
    count_scanned = 0
    for path in component_root.rglob("*"):
        if count_scanned >= 30000:
            break
        count_scanned += 1
        if not path.is_file() or is_ignored(path) or not should_include_file(path):
            continue

        rel_component = str(path.relative_to(component_root)).replace("\\", "/")
        rel_lower, score = rel_component.lower(), 10
        if "controller" in rel_lower:
            score += 70
        if "service" in rel_lower:
            score += 60
        if "repository" in rel_lower or "dao" in rel_lower:
            score += 60
        if "migration" in rel_lower:
            score += 55
        if "schema" in rel_lower:
            score += 55
        if "route" in rel_lower:
            score += 40
        if path.name in KEY_FILE_NAMES:
            score += 35
        if rel_lower.endswith((".md", ".json", ".yaml", ".yml")):
            score -= 5
        purpose, notes = infer_file_purpose(rel_component)
        candidates.append((score, rel_component, purpose, notes))

    candidates.sort(key=lambda row: (-row[0], row[1]))
    return [(row[1], row[2], row[3]) for row in candidates[:limit]]


def write_code_tree_file(
    component_root: Path,
    profile: str,
    now_utc: str,
    author: str,
    max_depth: int,
    max_entries: int,
) -> str:
    component_rel = "." if component_root == ROOT else rel_path(component_root)
    slug = "root" if component_root == ROOT else sanitize_slug(component_rel)
    output_path = CODE_TREE_DIR / f"auto-{slug}-tree.md"

    tree_lines, truncated = render_tree_lines(component_root, max_depth, max_entries)
    key_files = collect_key_files(component_root)
    key_rows = "\n".join([f"| `{f}` | {p} | {n} |" for f, p, n in key_files]) or "| _none detected_ | - | - |"

    content = [
        f"# Code Tree - auto-{slug}",
        "",
        f"LAST_UPDATED_UTC: {now_utc}",
        f"UPDATED_BY: {author}",
        f"PROFILE: {profile}",
        "",
        "## Root Path",
        f"- {component_rel}",
        "",
        "## Tree (Key Paths)",
        *tree_lines,
        "",
        "## Key Files",
        "| File | Purpose | Notes |",
        "|---|---|---|",
        key_rows,
    ]
    if truncated:
        content += ["", f"> Tree output truncated at {max_entries} lines. Re-run with higher `--max-entries` if needed."]
    output_path.write_text("\n".join(content).rstrip() + "\n", encoding="utf-8")
    return rel_path(output_path)


def main() -> int:
    args = parse_args()
    profile = args.profile if args.profile != "auto" else detect_profile()
    max_depth = normalize_positive(args.max_depth, 4)
    max_entries = normalize_positive(args.max_entries, 1400)
    max_components = normalize_positive(args.max_components, 12)
    now_utc = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M")

    CODE_TREE_DIR.mkdir(parents=True, exist_ok=True)
    DB_SCHEMA_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    roots = discover_component_roots(max_components)
    code_tree_outputs = [
        write_code_tree_file(
            component_root=component_root,
            profile=profile,
            now_utc=now_utc,
            author=args.author,
            max_depth=max_depth,
            max_entries=max_entries,
        )
        for component_root in roots
    ]

    db_schema_output, table_count = write_db_schema_file(
        root=ROOT,
        db_schema_dir=DB_SCHEMA_DIR,
        profile=profile,
        now_utc=now_utc,
        author=args.author,
        ignore_dirs=IGNORE_DIRS,
    )

    summary = {
        "generated_at_utc": now_utc,
        "profile": profile,
        "component_count": len(roots),
        "components": [rel_path(path) if path != ROOT else "." for path in roots],
        "code_tree_files": code_tree_outputs,
        "db_schema_file": db_schema_output,
        "detected_tables": table_count,
        "max_depth": max_depth,
        "max_entries": max_entries,
        "max_components": max_components,
    }
    summary_path = GENERATED_DIR / "map-structure-latest.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("Map structure complete.")
    print(f"- profile: {profile}")
    print(f"- component_roots_scanned: {len(roots)}")
    print(f"- code_tree_files_written: {len(code_tree_outputs)}")
    print(f"- db_schema_file: {db_schema_output}")
    print(f"- detected_tables: {table_count}")
    print(f"- summary: {rel_path(summary_path)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

