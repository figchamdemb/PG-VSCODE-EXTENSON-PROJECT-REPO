# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 18:26
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 27


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-171816.md` on 2026-03-19 17:18 UTC.

- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS
- `python scripts/build_frontend_summary.py`: PASS
- `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`: PASS

Anchors:
- `extension/src/trust/serverPolicyBridge.ts`
- `extension/src/trust/trustScoreService.ts`
- `extension/package.json`
- `extension/README.md`

### [2026-03-19 18:18 UTC] - copilot
Scope:
- Components: exact-reading-sync, enforcement-cli-bridge
- Files touched: extension reading/startup runtime, pg router, memory docs

Summary:
- Added exact-view mirrored selection sync between source editors and `narrate://read` editors so corresponding lines auto-highlight and reveal together.
- Kept the sync scoped to exact view, where the rendered mapping is intentionally line-for-line.
- Preserved source focus when opening side-by-side narration so the reading flow starts from code and the narration pane follows.
- Added `./pg.ps1 stop-enforcement` and `./pg.ps1 resume-enforcement`, backed by `Memory-bank/_generated/pg-enforcement-bridge.json` so terminal control hits the same extension-local enforcement state.

Validation:
- `npm run compile` (extension): PASS
