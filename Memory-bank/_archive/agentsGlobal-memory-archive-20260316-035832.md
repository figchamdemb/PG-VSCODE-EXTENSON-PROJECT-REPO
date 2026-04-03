# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-16 03:58
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 31


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260316-033222.md` on 2026-03-16 03:32 UTC.

Summary:
- Implemented self-hosted observability adapter baseline with default PG-hosted posture and enterprise BYOC option.
- Server-side additions:
  - added `server/src/observabilityHealth.ts` evaluator for deterministic adapter readiness findings.
  - supports adapter scaffold: `otlp`, `sentry`, `signoz` (plus implicit none when all disabled).
  - supports deployment ownership profiles: `pg-hosted` (default), `customer-hosted`, `hybrid`.
  - added authenticated route: `POST /account/policy/observability/check`.
- CLI/command additions:
  - added `scripts/observability_check.ps1` bridge script with profile + adapter evidence flags.
  - wired new command in router/help: `.\pg.ps1 observability-check`.
  - command supports explicit adapter ownership/evidence submission for PG-hosted and BYOC scenarios.
- Docs/memory updates:
  - updated server README env + endpoint docs for observability bridge.
  - updated extension help quickstart command table.
  - updated Memory-bank spec/details/structure/tools/code-tree/mastermind to capture milestone and architecture boundary.
  - updated architecture planning doc milestone alignment section.
- Validation:
  - `npm run build` (server): PASS
  - `npm run compile` (extension): PASS
  - `.\pg.ps1 help`: PASS (observability command listed)
  - `.\pg.ps1 observability-check`: expected fail without backend running (health unreachable), confirms command path executes.

Anchors:
- `server/src/observabilityHealth.ts`
- `server/src/index.ts`
- `scripts/observability_check.ps1`
- `scripts/pg.ps1`
- `server/README.md`
