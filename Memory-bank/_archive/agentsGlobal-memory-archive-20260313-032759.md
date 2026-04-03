# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-13 03:27
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 38


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260313-020142.md` on 2026-03-13 02:01 UTC.

- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 11:22 UTC] - codex
Scope:
- Components: api-contract-server-gate-and-pg-prod-optional-enforcement
- Files touched: server policy route/evaluator + pg scripts + memory docs

Summary:
- Added server-side API contract verification baseline endpoint: `POST /account/policy/api-contract/verify`.
- Added server evaluator modules under `server/src/apiContract/*` and orchestrator `server/src/apiContractVerification.ts`.
- Added local command bridge `scripts/api_contract_verify.ps1` and CLI command surface `pg api-contract-verify`.
- Added optional production gate wiring: `pg prod -EnableApiContractCheck`.
- Kept rollout opt-in for prod gate to avoid immediate false-positive blocking while teams calibrate.
- Verification:
  - `npm run build` (server) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS
  - `./pg.ps1 help` confirms command wiring for `api-contract-verify` and prod flag usage.

Anchors:
- `server/src/apiContractVerification.ts`
- `server/src/apiContract/codeScan.ts`
- `server/src/apiContract/openApi.ts`
- `server/src/apiContract/compare.ts`
- `server/src/apiContract/path.ts`
- `server/src/apiContract/types.ts`
- `server/src/index.ts`
- `scripts/api_contract_verify.ps1`
- `scripts/pg.ps1`
- `scripts/pg_prod.ps1`
- `server/package.json`
