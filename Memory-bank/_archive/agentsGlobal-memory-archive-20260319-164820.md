# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 16:48
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 30


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-162258.md` on 2026-03-19 16:22 UTC.

Validation:
- Pending strict `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck` rerun after this doc/policy sync batch.

Anchors:
- `scripts/self_check.ps1`
- `scripts/pg_prod.ps1`
- `scripts/memory_bank_guard_self_check.py`
- `docs/TESTING_GUIDE.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`

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
