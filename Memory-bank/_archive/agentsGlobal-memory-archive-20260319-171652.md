# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 17:16
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 29


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-164820.md` on 2026-03-19 16:48 UTC.

Validation:
- `npm run build` (server): PASS
- `./pg.ps1 map-structure`: PASS
- `./pg.ps1 start -Yes`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `scripts/agents_integrity.ps1`
- `scripts/start_memory_bank_session.ps1`
- `scripts/install_memory_bank_hooks.ps1`
- `server/src/adminRoutes.ts`
- `server/prisma/schema.prisma`

### [2026-03-19 06:48 UTC] - copilot
Scope:
- Components: trust-score-auth-fix, settings-fallback-clarity
- Files touched: extension trust bridge/service, extension manifest/docs, memory docs

Summary:
- Fixed the recurring false `TRUST-SRV-001` auth blocker in Narrate Trust Score.
- Root cause was a token-source mismatch:
  - sign-in stored the access token in extension secret storage,
  - Trust Score only checked `narrate.licensing.sessionToken` from config.
- Trust Score now resolves the secret-storage access token first and falls back to `narrate.licensing.sessionToken` only for manual override/debug scenarios.
- Added the fallback setting to `extension/package.json` so it is visible in VS Code Settings and documented the behavior in `extension/README.md`.
