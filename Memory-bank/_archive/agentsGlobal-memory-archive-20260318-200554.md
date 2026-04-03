# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-18 20:05
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 31


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260318-171247.md` on 2026-03-18 17:12 UTC.


### [2026-03-18 18:25 UTC] - copilot
Scope:
- Components: enterprise-custom-pricing-clarity, integration-entitlement-visibility
- Files touched: pricing catalog/public pricing copy + entitlement matrix/plan API + Memory-bank pricing docs

Summary:
- Clarified the public pricing model so Enterprise Custom is handled as a quote/invoice/manual-activation path instead of a new public checkout plan enum.
- Added explicit seat/device/Memory-bank limit guidance to the pricing catalog, pricing page, billing panel copy, and public plan comparison surface.
- Made the frontend/backend integration workflow visible as a paid entitlement from Pro upward while keeping it unavailable on Free and Trial.

Validation:
- Pending fresh server build + self-check rerun after pricing/entitlement edits.

Anchors:
- `server/src/pricingCatalog.ts`
- `server/public/assets/pricingCatalogClient.js`
- `server/public/pricing.html`
- `server/public/app.html`
- `server/public/assets/pricing.css`
- `server/src/entitlementMatrix.ts`
- `server/src/entitlementHelpers.ts`
- `server/src/planRoutes.ts`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/daily/2026-03-18.md`
