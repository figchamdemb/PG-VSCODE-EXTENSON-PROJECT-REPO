# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-17 16:40
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 31


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260317-155421.md` on 2026-03-17 15:54 UTC.

- Files touched: Prisma schema/indexes, Prisma store query shape, DB remediation script/help output

Summary:
- Completed DB/index/query remediation batch with policy-aligned fixes:
  - Added missing FK-like Prisma indexes to reduce DB optimization blockers (`Subscription`, `RefundRequest`, `OfflinePaymentRef`, `RedeemCode`, `AffiliateCode`, `AffiliateConversion`, `OAuthState`, `Team`).
  - Removed `SELECT *` from Prisma store initialization/bootstrap reads and switched to explicit column projection via metadata (`selectRowsForTable` helper).
- Updated operator UX for current Prisma CLI behavior:
  - Removed deprecated `--schema` flag from `npx prisma db execute --stdin` examples in DB fix/check command outputs and help.
- Validation:
  - `npm run build` (server): PASS
  - `.\pg.ps1 db-check`: PASS (`blockers: 0`, `warnings: 0`)
  - `.\pg.ps1 db-fix`: PASS (`pg_stat_statements: enabled`, `unused index candidates: 0`)
  - `.\pg.ps1 obs-check`: PASS
  - `.\pg.ps1 cloud-score -WorkloadSensitivity regulated`: path works; remaining blockers/warnings belong to unresolved broader coding/cloud backlog.

Anchors:
- `server/prisma/schema.prisma`
- `server/src/prismaStore.ts`
- `scripts/db_index_fix_plan.ps1`
- `scripts/db_index_maintenance_check.ps1`
- `scripts/pg.ps1`
- `Memory-bank/db-schema/narrate-postgres-prisma-schema.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/project-details.md`
- `Memory-bank/daily/2026-02-27.md`

### [2026-02-27 22:55 UTC] - codex
Scope:
