# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-18 03:02
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 25


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260317-234526.md` on 2026-03-17 23:45 UTC.

- Added operator quick-start guidance to the frontend integration proposal so the normal local workflow is discoverable in one block.
- Expanded the mandatory Playwright smoke suite beyond health/landing checks by adding a real local email-auth portal sign-in test under `server/tests/smoke.auth.spec.ts`.
- Isolated smoke auth validation onto dedicated local port `8791` with smoke-only runtime env (`STORE_BACKEND=json`, `ENABLE_EMAIL_OTP=true`, `EXPOSE_DEV_OTP_CODE=true`) so auth coverage stays deterministic.
- Started deep integration-page evidence auto-population by seeding richer login/dashboard backend evidence and rendering request/response/error examples directly into the generated ledger pages.
- Added `ConvertFrom-JsonCompat` in `scripts/frontend_integration.ps1` so direct integration summary refresh works in Windows PowerShell 5.1.

Validation:
- `npm run build` (server): PASS
- `npm run smoke:playwright` (server): PASS (`3 passed`)
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck -EnablePlaywrightSmokeCheck`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck -EnablePlaywrightSmokeCheck`: PASS

Anchors:
- `docs/FRONTEND_INTEGRATION_PROTOCOL_PROPOSAL.md`
- `docs/TESTING_GUIDE.md`
- `server/playwright.config.ts`
- `server/tests/smoke.auth.spec.ts`
- `scripts/frontend_integration.ps1`
- `Memory-bank/frontend-integration/pages/01-login.md`
- `Memory-bank/frontend-integration/pages/02-dashboard.md`

### [2026-03-18 02:05 UTC] - copilot
