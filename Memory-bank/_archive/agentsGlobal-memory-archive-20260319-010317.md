# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 01:03
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 42


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260318-235933.md` on 2026-03-18 23:59 UTC.


### [2026-03-18 23:59 UTC] - copilot
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


### [2026-03-19 00:57 UTC] - copilot
Scope:
- Components: pricing-gbp-fx-copy, portal-billing-clarity

Summary:
- Added a short customer-facing note to the public pricing page and portal billing card explaining that checkout is charged in GBP.
- Clarified that international cards can still pay and that any local-currency conversion is typically shown by the buyer bank or card provider, not by in-app currency switching.

Validation:
- Pending quick editor validation for pricing/app HTML+CSS after copy-only update.

Anchors:
- `server/public/pricing.html`
- `server/public/app.html`
- `server/public/assets/pricing.css`
- `Memory-bank/daily/2026-03-18.md`
