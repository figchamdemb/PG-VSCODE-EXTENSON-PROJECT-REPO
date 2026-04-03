# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-18 20:13
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 37


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260318-200554.md` on 2026-03-18 20:05 UTC.


### [2026-03-18 20:11 UTC] - copilot
Scope:
- Components: enterprise-custom-pricing-clarity, integration-entitlement-visibility, final-validation-sync
- Files touched: pricing catalog/public pricing copy + entitlement matrix/plan API + Memory-bank pricing docs/generated artifacts

Summary:
- Kept the public Stripe checkout model on the existing standard paid tiers while presenting Enterprise Custom as a quote, invoice, and manual-activation path.
- Made seat, device, and Memory-bank project limits explicit across the public pricing surface and entitlement payloads.
- Confirmed the frontend/backend integration workflow is exposed from Pro upward and completed the final Memory-bank regeneration and strict validation pass for the batch.

Validation:
- `npm run build` (server): PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS
- `python scripts/build_frontend_summary.py`: PASS
- `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

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
- `Memory-bank/_generated/frontend-summary.json`
- `Memory-bank/_generated/self-check-latest.json`
