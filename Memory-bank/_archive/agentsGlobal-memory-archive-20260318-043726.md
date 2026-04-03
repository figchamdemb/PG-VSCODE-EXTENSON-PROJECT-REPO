# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-18 04:37
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 26


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260318-035802.md` on 2026-03-18 03:58 UTC.


### [2026-03-18 04:27 UTC] - copilot
Scope:
- Components: startup-ux-hardening, strict-start-cleanup
- Files touched: extension startup guard + PG startup scripts + Memory-bank command trail

Summary:
- Kept the strict startup gate in place but stopped the extension auto-start path from surfacing the local-only dev-profile notice.
- Sanitized startup failure text in the extension so real blockers such as map-structure gate failures show up without raw PowerShell wrapper lines or ANSI junk.
- Re-ran the strict startup path after refreshing structure maps and confirmed the startup/session flow passes cleanly.

Validation:
- `./pg.ps1 start -Yes -EnforcementMode strict -SkipDevProfileNotice`: PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS
- `npm run compile` (extension): PASS

Anchors:
- `extension/src/startup/startupContextEnforcer.ts`
- `scripts/start_memory_bank_session.ps1`
- `scripts/pg.ps1`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/daily/2026-03-18.md`
