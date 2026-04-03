# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 19:56
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 21


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-182138.md` on 2026-03-20 18:21 UTC.

- Files touched: extension manifest + memory docs

Summary:
- Removed redundant `onCommand:` and `onView:` activation events from `extension/package.json`.
- These were only editor warnings, not runtime failures: VS Code already generates those activation hooks automatically from contributed commands/views.
- Kept explicit startup activation intact with `onStartupFinished`.
- Result: the large block of package.json activation warnings should clear after the editor refreshes diagnostics.

Validation:
- `npm run compile` (extension): PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `extension/package.json`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
