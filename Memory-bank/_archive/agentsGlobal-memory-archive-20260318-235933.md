# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-18 23:59
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 24


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260318-235332.md` on 2026-03-18 23:53 UTC.


### [2026-03-18 23:58 UTC] - copilot
Scope:
- Components: tapsign-staged-auth-ux, portal-security-prompt, final-validation

Summary:
- Added a staged `Sign Up with TapSign` entry point above GitHub and Google in the secure portal without changing the current providers.
- Added a signed-in `TapSign protection required` reminder card so existing Google, GitHub, and email logins are still prompted to finish the future TapSign device gate.
- Kept the current implementation as UX scaffolding only and routed the completion action into the existing support flow until the SDK arrives.

Validation:
- `get_errors` on TapSign portal files: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `server/public/app.html`
- `server/public/assets/app.css`
- `server/public/assets/site.js`
- `server/public/assets/site.tapSignEnrollment.js`
- `Memory-bank/daily/2026-03-18.md`
