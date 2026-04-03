# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 01:05
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 25


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-010317.md` on 2026-03-19 01:03 UTC.


### [2026-03-18 03:54 UTC] - copilot
Scope:
- Components: canonical-postgres-target, legacy-schema-retirement-docs
- Files touched: server DB docs/env example + Memory-bank DB records

Summary:
- Re-verified that active repo wiring already targets the dedicated `narate-enterprise` database with `narate_enterprise` schema.
- Documented that the old `egov.narrate` schema was a retired empty subset and is no longer a supported runtime/tool target.
- Tightened schema docs so Prisma-managed core tables remain distinguished from any additional runtime-managed tables created in the same enterprise schema.

Validation:
- Repo search for active DB target strings: PASS (`schema=narate_enterprise` present, `schema=narrate` absent in active server docs/config)

Anchors:
- `server/README.md`
- `server/.env.example`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/db-schema/narrate-postgres-prisma-schema.md`
- `Memory-bank/daily/2026-03-18.md`

### [2026-02-28 03:54 UTC] - codex
