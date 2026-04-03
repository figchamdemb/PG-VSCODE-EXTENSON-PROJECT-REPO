# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-08 02:52
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 31


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260308-020016.md` on 2026-03-08 02:00 UTC.

  - `narrate.deadCodeScan.maxFiles`
  - `narrate.deadCodeScan.includeGlob`
  - `narrate.deadCodeScan.excludeGlob`
- Updated Help Center command table and Memory-bank planning/state docs.
- Verification:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/runDeadCodeScan.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 07:44 UTC] - codex
Scope:
- Components: dead-code-pg-push-gate, strict-relaxed-toggle-enforcement
- Files touched: dead-code scan shared API + pgPush gate wiring + package/help + memory docs

Summary:
- Extended dead-code scanner to expose reusable workspace-scan API for other command flows.
- Added Dead Code Gate to `Narrate: PG Push`:
  - setting `narrate.deadCodeScan.pgPushGateMode = off|relaxed|strict`.
