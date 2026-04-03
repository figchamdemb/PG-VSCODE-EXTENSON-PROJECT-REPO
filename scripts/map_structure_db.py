from __future__ import annotations

import re
from pathlib import Path

TABLE_PATTERN = re.compile(
    r"create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_`\"\[\]\.]+)",
    re.IGNORECASE,
)
ALTER_PATTERN = re.compile(
    r"alter\s+table\s+(?:if\s+exists\s+)?([a-zA-Z0-9_`\"\[\]\.]+)",
    re.IGNORECASE,
)
INDEX_PATTERN = re.compile(
    r"create\s+(?:unique\s+)?index\s+[a-zA-Z0-9_`\"\[\]\.]+\s+on\s+([a-zA-Z0-9_`\"\[\]\.]+)",
    re.IGNORECASE,
)
PRISMA_MODEL_PATTERN = re.compile(r"^\s*model\s+([A-Za-z][A-Za-z0-9_]*)\s*\{", re.MULTILINE)


def _rel_path(root: Path, path: Path) -> str:
    return str(path.relative_to(root)).replace("\\", "/")


def _is_ignored(path: Path, ignore_dirs: set[str]) -> bool:
    return any(part in ignore_dirs for part in path.parts)


def _normalize_identifier(raw: str) -> str:
    token = raw.strip().strip("`").strip('"').strip("[").strip("]").strip()
    if "." not in token:
        return token
    parts = [part.strip().strip("`").strip('"').strip("[").strip("]") for part in token.split(".")]
    return ".".join([part for part in parts if part])


def _collect_schema_sources(root: Path, ignore_dirs: set[str]) -> tuple[list[Path], list[Path]]:
    sql_files: list[Path] = []
    prisma_files: list[Path] = []

    for path in root.rglob("*.sql"):
        if _is_ignored(path, ignore_dirs):
            continue
        rel_lower = _rel_path(root, path).lower()
        if any(token in rel_lower for token in ("migration", "migrations", "schema", "prisma")):
            sql_files.append(path)

    for path in root.rglob("schema.prisma"):
        if not _is_ignored(path, ignore_dirs):
            prisma_files.append(path)

    sql_files = sorted(set(sql_files), key=lambda p: _rel_path(root, p).lower())
    prisma_files = sorted(set(prisma_files), key=lambda p: _rel_path(root, p).lower())
    return sql_files, prisma_files


def _build_table_index(root: Path, sql_files: list[Path], prisma_files: list[Path]) -> dict[str, dict[str, object]]:
    tables: dict[str, dict[str, object]] = {}

    def ensure_table(name: str) -> dict[str, object]:
        item = tables.get(name)
        if item is None:
            item = {"sources": set(), "create_count": 0, "alter_count": 0, "index_count": 0, "prisma_models": set()}
            tables[name] = item
        return item

    for sql_file in sql_files:
        rel = _rel_path(root, sql_file)
        raw = sql_file.read_text(encoding="utf-8", errors="ignore")
        for match in TABLE_PATTERN.finditer(raw):
            table = _normalize_identifier(match.group(1))
            if table:
                item = ensure_table(table)
                item["sources"].add(rel)
                item["create_count"] = int(item["create_count"]) + 1
        for match in ALTER_PATTERN.finditer(raw):
            table = _normalize_identifier(match.group(1))
            if table:
                item = ensure_table(table)
                item["sources"].add(rel)
                item["alter_count"] = int(item["alter_count"]) + 1
        for match in INDEX_PATTERN.finditer(raw):
            table = _normalize_identifier(match.group(1))
            if table:
                item = ensure_table(table)
                item["sources"].add(rel)
                item["index_count"] = int(item["index_count"]) + 1

    for prisma_file in prisma_files:
        rel = _rel_path(root, prisma_file)
        raw = prisma_file.read_text(encoding="utf-8", errors="ignore")
        for match in PRISMA_MODEL_PATTERN.finditer(raw):
            model_name = match.group(1)
            if model_name:
                table = model_name.lower()
                item = ensure_table(table)
                item["sources"].add(rel)
                item["prisma_models"].add(model_name)

    return tables


def write_db_schema_file(
    *,
    root: Path,
    db_schema_dir: Path,
    profile: str,
    now_utc: str,
    author: str,
    ignore_dirs: set[str],
) -> tuple[str, int]:
    sql_files, prisma_files = _collect_schema_sources(root, ignore_dirs)
    tables = _build_table_index(root, sql_files, prisma_files)

    output_path = db_schema_dir / "auto-discovered-schema.md"
    latest_migration = "none"
    if sql_files:
        latest_migration = _rel_path(root, max(sql_files, key=lambda path: path.stat().st_mtime))

    source_rows: list[str] = [f"- `{_rel_path(root, path)}`" for path in sql_files[:20]]
    source_rows.extend([f"- `{_rel_path(root, path)}`" for path in prisma_files[:10]])
    if not source_rows:
        source_rows = ["- _No SQL migration/schema files detected._"]

    table_rows: list[str] = []
    column_sections: list[str] = []
    for table_name in sorted(tables.keys())[:300]:
        item = tables[table_name]
        sources = sorted(item["sources"])
        source_preview = ", ".join([f"`{src}`" for src in sources[:2]])
        if len(sources) > 2:
            source_preview += ", ..."
        notes: list[str] = []
        prisma_models = sorted(item["prisma_models"])
        if prisma_models:
            notes.append("Prisma model: " + ", ".join(prisma_models[:3]))
        if int(item["index_count"]) > 0:
            notes.append(f"Index refs: {item['index_count']}")
        note_text = "; ".join(notes) if notes else "Auto-discovered from SQL/schema files."
        table_rows.append(
            f"| `{table_name}` | {source_preview or '-'} | {item['create_count']} | {item['alter_count']} | {item['index_count']} | {note_text} |"
        )
        column_sections.extend(
            [
                f"### table: {table_name}",
                "| column | type | constraints | description |",
                "|---|---|---|---|",
                "| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |",
                "",
            ]
        )

    if not table_rows:
        table_rows.append("| _none detected_ | - | - | - | - | No table signatures found in scanned schema files. |")

    content = [
        "# DB Schema - auto-discovered-schema",
        "",
        f"LAST_UPDATED_UTC: {now_utc}",
        f"UPDATED_BY: {author}",
        f"PROFILE: {profile}",
        "",
        "## Purpose",
        "Auto-generated schema map from repository migration/schema files (code artifacts only).",
        "",
        "## Migration Source",
        f"- SQL/schema files scanned: {len(sql_files)}",
        f"- Prisma schema files scanned: {len(prisma_files)}",
        f"- Latest migration/schema artifact: `{latest_migration}`",
        "",
        "## Source Files (Sample)",
        *source_rows,
        "",
        "## Tables (Index)",
        "| Table | Source | Create Statements | Alter Statements | Index References | Notes |",
        "|---|---|---:|---:|---:|---|",
        *table_rows,
        "",
        "## Tables (Columns)",
        *column_sections,
    ]
    output_path.write_text("\n".join(content).rstrip() + "\n", encoding="utf-8")
    return _rel_path(root, output_path), len(tables)

