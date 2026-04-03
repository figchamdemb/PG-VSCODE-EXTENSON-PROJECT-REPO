# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-27 10:09
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 32


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260327-084135.md` on 2026-03-27 08:41 UTC.

- Integrated log-safety evaluator into `server/src/codingStandardsVerification.ts` so it runs in `coding-verify`, `pg self-check`, and `pg prod` paths.
- Validation confirms new blocker rule is active (`COD-LOG-002`) on remaining direct runtime logger usage in `server/src/index.ts`.

Validation:
- `npm run build` (server): PASS
- `npm run compile` (extension): PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS in warn mode (blockers reported)
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: FAIL (existing coding blockers + DB runtime connectivity error)

Anchors:
- `server/src/codingStandardsLogSafety.ts`
- `server/src/codingStandardsVerification.ts`

### [2026-02-28 15:59 UTC] - codex
Scope:
- Components: milestone-next-blocker-burndown, server-index-modularization, cloud-score-followup
- Files touched: server runtime/bootstrap/admin/subscription modules + memory docs

Summary:
- Reduced hard coding blockers by extracting over-limit server helper flows from `server/src/index.ts` into dedicated modules (no behavior change):
  - `server/src/serverRuntimeSetup.ts` (plugin/parser/security bootstrap setup),
  - `server/src/adminRbacBootstrap.ts` (admin RBAC baseline seeding),
  - `server/src/subscriptionGrant.ts` (subscription + entitlement grant mutation helper).
- `server/src/index.ts` line count reduced from `7563` to `7287`.
- Hard blocker impact:
  - removed `bootstrap`, `ensureAdminRbacBaseline`, and `applySubscriptionGrant` hard function-body blockers.
  - coding hard blockers improved `9 -> 6` (remaining blockers are `server/src/index.ts` file-size, `registerRoutes`, N+1 signal, and three large anonymous handlers).

Validation:
