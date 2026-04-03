# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-18 23:19
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 25


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260318-201320.md` on 2026-03-18 20:13 UTC.


### [2026-03-18 20:13 UTC] - copilot
Scope:
- Components: enterprise-custom-pricing-clarity, integration-entitlement-visibility, final-validation-sync

Summary:
- Finished the pricing clarification batch with Enterprise Custom kept on the quote and manual-activation path, explicit standard plan limits on the public surface, and frontend/backend integration shown as Pro+ only.

Validation:
- `npm run build` (server): PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS
- `python scripts/build_frontend_summary.py`: PASS
- `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `server/src/pricingCatalog.ts`
- `server/src/entitlementMatrix.ts`
- `server/src/planRoutes.ts`
- `Memory-bank/daily/2026-03-18.md`
- `Memory-bank/_generated/frontend-summary.json`
