# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 06:28
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 23


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-053422.md` on 2026-03-20 05:34 UTC.

Validation:
- `npm run compile` (extension): PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck -EnablePlaywrightSmokeCheck`: PASS

Anchors:
- `extension/src/help/commandHelpContent.ts`
- `extension/src/help/commandHelpWorkflowSections.ts`
- `server/public/help.html`
- `server/public/assets/help.js`
- `server/public/assets/help.css`

### [2026-03-20 18:24 UTC] - copilot
Scope:
- Components: local-oauth-test-profile, operator-doc-clarity
- Files touched: `server/.env`, testing/runtime docs

Summary:
- Fixed local GitHub/Google test flow by moving runtime callback/base URLs from the hosted domain back to `http://127.0.0.1:8787`.
- Root cause was redirect/origin mismatch, not the operator's real provider email.
- Confirmed local backend health after restart and verified both `/auth/github/start` and `/auth/google/start` returned normal redirect responses for trusted loopback callbacks.
