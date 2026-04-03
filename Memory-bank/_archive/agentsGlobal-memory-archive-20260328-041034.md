# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-28 04:10
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 45


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260327-100920.md` on 2026-03-27 10:09 UTC.

- `npm run build` (server): PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS in warn mode (`coding blockers: 6`)
- `./pg.ps1 cloud-score -WorkloadSensitivity regulated`: blocked (`scanner blockers: 8`, `warnings: 105`)
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: FAIL in strict mode (remaining blockers + intermittent `DEP-REGISTRY-001` + DB host `91.98.162.101:5433` unreachable)

Anchors:
- `server/src/index.ts`
- `server/src/serverRuntimeSetup.ts`
- `server/src/adminRbacBootstrap.ts`
- `server/src/subscriptionGrant.ts`
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/project-details.md`
- `Memory-bank/daily/2026-02-28.md`

### [2026-03-19 16:20 UTC] - copilot
Scope:
- Components: integration-worker-stop-end-controls, runtime-control-minimization
- Files touched: integration scripts/router + operator/memory docs

Summary:
- Added clean lifecycle controls for persistent frontend/backend integration workers:
  - `backend-stop`
  - `frontend-stop`
  - `integration-stop`
  - `integration-end`
- Persistent workers now check for stop/end requests on the next heartbeat cycle and exit with final `stopped` or `completed` status instead of requiring an abrupt terminal kill.
- Kept the extra local runtime footprint minimal by storing only per-role stop/end control signals in `Memory-bank/_generated/frontend-integration-runtime.json`.
- Found and fixed a concurrency bug during validation where parallel stop requests could overwrite each other; runtime control updates are now serialized with a mutex.

Validation:
- `./pg.ps1 backend-stop`: PASS
- `./pg.ps1 integration-end -Role frontend`: PASS

Anchors:
- `scripts/frontend_integration.ps1`
- `scripts/pg.ps1`
- `docs/PG_FIRST_RUN_GUIDE.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/structure-and-db.md`

### [2026-02-28 14:19 UTC] - codex
Scope:
