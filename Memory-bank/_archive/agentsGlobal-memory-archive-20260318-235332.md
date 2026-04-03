# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-18 23:53
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 46


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260318-232811.md` on 2026-03-18 23:28 UTC.


### [2026-03-18 23:30 UTC] - copilot
Scope:
- Components: pricing-page-cta-wiring, portal-launch-context, final-validation

Summary:
- Added visible buy and contact CTA buttons to the public pricing plan cards and SKU cards so the page no longer behaves like a read-only catalog.
- Added a small portal launch-context module so `/app` can open directly into billing or support with prefilled plan, module, and Enterprise quote-request fields from public pricing links.
- Kept the underlying Stripe model unchanged: standard paid checkout still depends on the 9-key `STRIPE_PRICE_MAP`, while Enterprise Custom remains a quote/manual activation path.

Validation:
- Local pricing page served on `http://127.0.0.1:8787/pricing`: PASS
- Local pricing API `GET /api/pricing/catalog`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `server/public/assets/pricing.js`
- `server/public/assets/site.js`
- `server/public/assets/site.portalLaunchContext.js`
- `server/public/pricing.html`
- `server/public/assets/pricing.css`
- `Memory-bank/daily/2026-03-18.md`


### [2026-03-18 23:38 UTC] - copilot
Scope:
- Components: tapsign-staged-auth-ux, portal-security-prompt

Summary:
- Added a staged `Sign Up with TapSign` action above GitHub and Google in the secure portal so the future TapSign onboarding slot is visible without changing the current sign-in providers.
- Added a signed-in TapSign reminder card so any existing Google, GitHub, or email login is still prompted to complete TapSign device protection once the SDK arrives.
- Kept the current implementation UI-only and routed the completion action into the existing support/request flow until the TapSign SDK is supplied.

Validation:
- Portal auth shell render on `http://127.0.0.1:8787/app`: pending final browser refresh

Anchors:
- `server/public/app.html`
- `server/public/assets/app.css`
- `server/public/assets/site.js`
- `server/public/assets/site.tapSignEnrollment.js`
- `Memory-bank/daily/2026-03-18.md`
