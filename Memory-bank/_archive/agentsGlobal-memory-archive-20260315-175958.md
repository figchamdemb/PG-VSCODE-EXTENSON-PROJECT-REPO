# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-15 17:59
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 37


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260313-040500.md` on 2026-03-13 04:05 UTC.

- `scripts/db_index_fix_plan.ps1`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/tools-and-commands.md`

### [2026-02-27 14:22 UTC] - codex
Scope:
- Components: help-center-agent-first-self-check-guidance
- Files touched: command help content + memory docs

Summary:
- Added explicit `pg self-check` guidance to the in-extension Help Center so users can copy:
  - warn-as-you-go command (`-WarnOnly -EnableDbIndexMaintenanceCheck`),
  - UI-task variant (adds `-EnablePlaywrightSmokeCheck`),
  - strict final command (no warn mode).
- Added troubleshooting row for "self-check reports blockers while coding" with rule-ID-first remediation guidance.
- Re-validated:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS
  - `./pg.ps1 db-index-check` PASS (status + counts render correctly)
  - `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck` PASS

Anchors:
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`

### [2026-02-27 14:48 UTC] - codex
Scope:
- Components: db-index-safe-cleanup-and-warning-scope-tuning
- Files touched: db maintenance scripts + memory docs

Summary:
- Executed safe DB index cleanup against live project DB:
  - dropped 11 unused indexes only when all guards passed (`idx_scan=0`, non-primary, non-unique, no dependent constraints).
