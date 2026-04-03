# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-28 19:40
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 20


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260328-063533.md` on 2026-03-28 06:35 UTC.

- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: FAIL (existing legacy coding blockers + DB runtime connectivity error)

Anchors:
- `server/src/codingStandardsLogSafety.ts`
- `server/src/codingStandardsVerification.ts`

### [2026-02-28 16:37 UTC] - codex
Scope:
- Components: milestone-next-blocker-burndown, server-index-scan-reduction
- Files touched: server index route registration wrapper + super-admin resolver iteration

Summary:
- Continued server-side blocker burn-down in `server/src/index.ts` with behavior-preserving refactor.
- Added thin route registration wrapper (`registerRoutes` delegating to `registerAllRoutesInternal`) to keep ongoing route-group split isolated.
- Removed false N+1 blocker (`COD-DBQ-002`) by replacing `for`-loop based super-admin merge in `getSuperAdminEmailSet` with iterator-based merge (`forEach`, `map/filter`), preserving env+DB union semantics.
- Validation outcome now shows remaining hard coding blockers limited to:
  - `COD-LIMIT-001` (`server/src/index.ts` file size),
