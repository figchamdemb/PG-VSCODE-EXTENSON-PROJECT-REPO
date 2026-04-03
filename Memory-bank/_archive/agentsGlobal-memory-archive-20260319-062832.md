# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 06:28
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 32


### [2026-03-19 06:32 UTC] - copilot
Scope:
- Components: startup-resilience, agents-integrity-protection
- Files touched: startup/hook scripts, admin refund route, Prisma schema, memory docs

Summary:
- Cleared the recurring startup popup by removing the two strict blockers that were failing `pg start`:
  - extracted refund-approval mutation logic out of the route handler in `server/src/adminRoutes.ts`
  - reduced `server/prisma/schema.prisma` below the hard 500-line file limit
- Added local AGENTS protection with `scripts/agents_integrity.ps1`:
  - seals `AGENTS.md` to `Memory-bank/_generated/agents-integrity.json`
  - marks the file read-only locally
  - verifies the seal during `scripts/start_memory_bank_session.ps1`
  - reseals during `scripts/install_memory_bank_hooks.ps1`
- Kept startup fail-closed for unexpected AGENTS content changes while allowing automatic repair only when the sealed hash still matches and only the read-only bit was lost.

Validation:
- `npm run build` (server): PASS
- `./pg.ps1 map-structure`: PASS
- `./pg.ps1 start -Yes`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `scripts/agents_integrity.ps1`
- `scripts/start_memory_bank_session.ps1`
- `scripts/install_memory_bank_hooks.ps1`
- `server/src/adminRoutes.ts`
- `server/prisma/schema.prisma`

> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-053043.md` on 2026-03-19 05:30 UTC.
