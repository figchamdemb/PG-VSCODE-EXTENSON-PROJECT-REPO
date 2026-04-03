# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-12 06:55
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 44


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260311-090746.md` on 2026-03-11 09:07 UTC.

  - opens before/after report with changed/no-change/failed files and finding deltas.
- This is intentionally non-destructive (no auto deletion of symbols/functions).
- Verification:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/applySafeDeadCodeFixes.ts`
- `extension/src/commands/runDeadCodeScan.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 08:23 UTC] - codex
Scope:
- Components: pg-push-dead-code-remediation-ux
- Files touched: pgPush gate flow + memory docs

Summary:
- Enhanced PG Push dead-code gate interactions:
  - strict and relaxed modes now offer `Apply Safe Fixes + Recheck` directly in gate dialog.
  - gate reruns dead-code scan after autofix and only passes when high-confidence findings reach zero.
  - report-open and continue/cancel choices remain mode-appropriate.
- This keeps strict enforcement while reducing manual command switching during push workflow.
- Verification:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/pgPush.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 08:31 UTC] - codex
Scope:
- Components: pg-push-dead-code-gate-fix-recheck-loop
