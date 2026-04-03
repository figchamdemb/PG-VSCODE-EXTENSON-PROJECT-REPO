# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 07:29
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 56


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-062832.md` on 2026-03-19 06:28 UTC.

Scope:
- Components: dependency-policy-tuning, weekly-dependency-automation
- Files touched: server dependency evaluator + CI workflow + tooling docs

Summary:
- Tuned dependency policy strictness to reduce false hard blocks:
  - in `server/src/dependencyVerification.ts`, stale `@types/*` packages now emit warning (`DEP-MAINT-003`) instead of blocker, while CVE severity blockers remain strict.
- Added weekly dependency drift workflow:
  - `.github/workflows/dependency-drift-weekly.yml` runs on schedule + manual dispatch,
  - per-service `npm audit --audit-level=high` fail gate (`extension`, `server`),
  - per-service `npm outdated --json` output for upgrade planning,
  - optional policy dependency verification job when `PG_API_BASE` and `PG_ACCESS_TOKEN` secrets are configured.
- Synced tooling memory docs to reflect new command/automation behavior.

Validation:
- `npm run build` (server): PASS
- `powershell -ExecutionPolicy Bypass -File scripts/dependency_verify.ps1`: PASS aggregate (no blockers; stale `@types/*` now warning)
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS in warn mode
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: FAIL in strict mode due existing coding blockers + DB connectivity runtime error.

Anchors:
- `server/src/dependencyVerification.ts`
- `.github/workflows/dependency-drift-weekly.yml`
- `Memory-bank/code-tree/memory-bank-tooling-tree.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/daily/2026-02-28.md`

### [2026-02-28 04:42 UTC] - codex
Scope:
- Components: milestone-next-blocker-burndown, coding-policy-modularization

### [2026-03-17 22:15 UTC] - copilot
Scope:
- Components: frontend-integration-server-orchestration, strict-gate-cleanup
- Files touched: integration orchestration server modules + memory docs

Summary:
- Finished the server-backed frontend integration orchestration rollout by splitting route transport from validation/support logic.
- Kept endpoint behavior unchanged while moving workflow lookup, audit trimming, repo-key/state validation, stale-heartbeat checks, and protected transition rules into `server/src/integrationOrchestrationSupport.ts`.
- Cleared the remaining strict coding blocker so the repo now passes strict self-check with DB index enforcement enabled.

Validation:
- `npm run build` (server): PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `server/src/integrationOrchestrationRoutes.ts`
- `server/src/integrationOrchestrationSupport.ts`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/daily/2026-03-17.md`
