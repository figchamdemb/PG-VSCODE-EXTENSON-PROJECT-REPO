# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-17 15:54
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 31


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260316-041841.md` on 2026-03-16 04:18 UTC.


### [2026-02-27 21:45 UTC] - codex
Scope:
- Components: command-alias-ergonomics-cloud-db
- Files touched: pg command router/help + extension help quickstart + memory commands doc

Summary:
- Added additional simple aliases for student/operator command ergonomics:
  - `.\pg.ps1 cloud-score` -> alias of `.\pg.ps1 mcp-cloud-score`
  - `.\pg.ps1 db-check` -> alias of `.\pg.ps1 db-index-check`
  - `.\pg.ps1 db-fix` -> alias of `.\pg.ps1 db-index-fix-plan`
- Updated `pg help` output so short aliases are visible directly in copy/paste examples.
- Updated extension Help Center quickstart rows to include short cloud/db aliases.
- Updated Memory-bank command documentation to include the new short aliases.
- Validation:
  - `.\pg.ps1 help` PASS (shows `cloud-score`, `db-check`, `db-fix`)
  - `.\pg.ps1 db-check` PASS
  - `.\pg.ps1 db-fix -DbMaxRows 1 -DbPlanOutputPath Memory-bank\_generated\db-index-fix-plan-next1.md` PASS
  - `npm run compile` (extension) PASS

Anchors:
- `scripts/pg.ps1`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/tools-and-commands.md`

### [2026-02-27 22:25 UTC] - codex
Scope:
- Components: db-index-remediation-batch1 + prisma-v7-db-execute-compatibility
