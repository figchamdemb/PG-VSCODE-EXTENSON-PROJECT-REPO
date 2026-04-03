# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-13 00:27
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 44


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260312-082708.md` on 2026-03-12 08:27 UTC.

  - `narrate.codebaseTour.maxFiles`
  - `narrate.codebaseTour.includeGlob`
  - `narrate.codebaseTour.excludeGlob`
- Refactored tour implementation into modular files to keep command code maintainable:
  - `generateCodebaseTour.ts` (orchestration),
  - `codebaseTourReport.ts` (markdown rendering),
  - `codebaseTourTypes.ts` (shared types/constants).
- Verification:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/generateCodebaseTour.ts`
- `extension/src/commands/codebaseTourReport.ts`
- `extension/src/commands/codebaseTourTypes.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 10:20 UTC] - codex
Scope:
- Components: api-contract-validator-baseline (milestone 15B)
- Files touched: new API contract validator modules + extension/package/help wiring + memory docs

Summary:
- Added command `Narrate: Run API Contract Validator`.
- Implemented baseline contract flow:
  - OpenAPI-first parsing (JSON specs),
  - backend route inference fallback,
  - frontend `fetch`/`axios` call extraction,
  - deterministic mismatch rules with IDs:
    - `API-REQ-001` required request field missing,
    - `API-REQ-002` naming mismatch,
    - `API-TYPE-001` request type mismatch,
    - `API-RES-001` frontend response-field read missing in backend contract.
- Added settings:
