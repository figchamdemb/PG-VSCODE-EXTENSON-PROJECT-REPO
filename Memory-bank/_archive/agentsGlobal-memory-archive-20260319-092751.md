# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 09:27
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 26


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-091449.md` on 2026-03-19 09:14 UTC.

### [2026-03-19 09:32 UTC] - copilot
Scope:
- Components: narrate-flow-check-alignment, closure-validation-consistency
- Files touched: verification script + tools/daily memory docs

Summary:
- Fixed a false `pg narrate-check` failure introduced by the intentional manifest cleanup.
- Root cause was `scripts/narrate_flow_check.ps1` still requiring explicit `onCommand:` activation events even though the repo had correctly moved to VS Code auto-generated activation from `contributes.commands`.
- The flow checker now treats contributed command declarations plus extension runtime registration as the source of truth when no explicit `onCommand:` activation events are configured.
- This restores `pg closure-check -ClosureMode local-core` to the documented behavior: public tunnel `530` failures stay non-blocking while local-core validation can still pass.

Validation:
- `npm run compile` (extension): PASS
- `./pg.ps1 narrate-check`: PASS
- `./pg.ps1 closure-check -ClosureMode local-core -ApiBase http://127.0.0.1:8787 -PublicBaseUrl https://pg-ext.addresly.com`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `scripts/narrate_flow_check.ps1`
- `extension/package.json`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/daily/2026-03-19.md`
