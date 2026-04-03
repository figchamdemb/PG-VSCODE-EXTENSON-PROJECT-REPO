# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-13 04:05
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 43


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260313-034945.md` on 2026-03-13 03:49 UTC.

- Added new remediation planner command:
  - `pg db-index-fix-plan`
  - `pg db-index-remediate` (alias)
- Added script `scripts/db_index_fix_plan.ps1` that:
  - reads live PostgreSQL telemetry through Prisma raw SQL,
  - generates `Memory-bank/_generated/db-index-fix-plan-latest.md`,
  - includes exact SQL for `pg_stat_statements` enablement workflow,
  - emits candidate-specific guard/drop/rollback SQL for unused non-primary indexes.
- Updated `db_index_maintenance_check.ps1` to print quick remediation hint when findings exist.
- Validation:
  - `./pg.ps1 help` PASS
  - `./pg.ps1 db-index-fix-plan` PASS
  - `./pg.ps1 db-index-remediate` PASS
  - `./pg.ps1 db-index-check` PASS (blocked findings expected) with remediation hint
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `scripts/db_index_fix_plan.ps1`
- `scripts/pg.ps1`
- `scripts/db_index_maintenance_check.ps1`
- `Memory-bank/_generated/db-index-fix-plan-latest.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`
### [2026-02-27 02:02 UTC] - codex
Scope:
- Components: db-index-guidance-ux
- Files touched: pg help + db-index scripts + help center + memory docs

Summary:
- Added copy/paste DB-index remediation flow to `pg help` and `db-index-check` output.
- Added operator troubleshooting for common failures: global `pg.ps1` PATH resolution, wrong working directory, PowerShell `>>` continuation mode, and SQL run in shell instead of PostgreSQL.
- Updated DB fix-plan generator output/document with explicit SQL execution context and Prisma terminal examples.
- Updated Narrate Help Center content and tools documentation to mirror the same DB-index guidance.
- Verified with local commands: `./pg.ps1 help`, `./pg.ps1 db-index-check`, `./pg.ps1 db-index-fix-plan -DbMaxRows 5`.

Anchors:
- `scripts/pg.ps1`
- `scripts/db_index_maintenance_check.ps1`
