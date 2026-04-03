# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 21:33
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 23


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-182654.md` on 2026-03-19 18:26 UTC.

- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `extension/src/readingView/readingSelectionSyncService.ts`
- `extension/src/readingView/narrateSchemeProvider.ts`
- `extension/src/startup/startupEnforcementBridge.ts`
- `extension/src/startup/startupContextEnforcer.ts`
- `extension/src/extension.ts`
- `scripts/pg.ps1`

### [2026-03-19 21:08 UTC] - copilot
Scope:
- Components: extension-branding, local-vsix-visibility
- Files touched: extension manifest, install guide, memory docs

Summary:
- Changed the installed extension display title from `Narrate` to `PG-Narrate` so operators can visually confirm they have the latest local package.
- Bumped the extension version from `0.1.0` to `0.1.1`.
- Packaged and force-installed the `0.1.1` VSIX into the normal VS Code profile after answering `vsce`'s missing-license prompt non-interactively.
