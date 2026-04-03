# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 02:11
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 29


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-020535.md` on 2026-03-19 02:05 UTC.

### [2026-03-19 02:10 UTC] - copilot
Scope:
- Components: referral-program-pricing, tiered-affiliate-commission, strict-validation

Summary:
- Extended the existing affiliate flow into a configurable referral program with buyer discount, minimum commission, and milestone-based commission boosts.
- Wired referral discounts into self-serve Stripe checkout while preserving the existing one-time annual SKU model and manual payout approval process.
- Exposed referral-program context through the affiliate dashboard response and updated `/pricing` and `/app` billing copy so the current promotion model is visible to operators and buyers.

Validation:
- `npm run build` (server): PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS
- `python scripts/build_frontend_summary.py`: PASS
- `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `server/src/affiliateProgram.ts`
- `server/src/subscriptionHelpers.ts`
- `server/src/stripePaymentHandlers.ts`
- `server/src/affiliateRoutes.ts`
- `server/src/pricingCatalog.ts`
- `server/public/app.html`
- `server/public/pricing.html`
- `Memory-bank/daily/2026-03-19.md`
