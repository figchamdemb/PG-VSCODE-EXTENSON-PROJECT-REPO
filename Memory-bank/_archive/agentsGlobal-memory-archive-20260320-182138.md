# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 18:21
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 24


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-180418.md` on 2026-03-20 18:04 UTC.

- Fixed the repeated `PG Start Failed` startup state seen in the extension after ordinary repo edits.
- Root cause was startup order:
  - Memory-bank refresh ran first,
  - then the strict map-structure freshness gate saw stale generated map files,
  - and startup failed even though the repo only needed a normal map refresh.
- `scripts/start_memory_bank_session.ps1` now auto-runs `scripts/map_structure.py` with the default profile when stale/missing map files are detected, then continues startup if the refresh succeeds.
- Strict startup now fails only when the auto-refresh fails or the map gate still remains unresolved after refresh.

Validation:
- `./pg.ps1 start -Yes`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `scripts/start_memory_bank_session.ps1`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`

### [2026-03-19 08:04 UTC] - copilot
Scope:
- Components: manifest-activation-cleanup, editor-warning-reduction
