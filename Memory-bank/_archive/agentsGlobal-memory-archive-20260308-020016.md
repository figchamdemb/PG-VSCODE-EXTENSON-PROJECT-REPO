# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-08 02:00
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 29


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260307-232920.md` on 2026-03-07 23:29 UTC.

- This increases mismatch coverage for projects using API wrapper clients instead of direct `axios.*` calls.
- Verification:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/apiContractCodeScan.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/mastermind.md`
- `Memory-bank/daily/2026-02-26.md`

### [2026-02-27 07:28 UTC] - codex
Scope:
- Components: dead-code-scan-baseline, candidate-confidence-model
- Files touched: new dead-code command + extension wiring + package/help + memory docs

Summary:
- Added command `Narrate: Run Dead Code Scan`.
- Implemented confidence-tiered candidate detection:
  - `high`: explicit TypeScript unused diagnostics (`TS6133/TS6192` style signals).
  - `medium`: exported modules with no inbound local imports in workspace graph.
  - `low`: files with no inbound local imports that may still be dynamically loaded.
- Scan is report-only (no auto-delete) to avoid destructive false positives.
- Added settings:
