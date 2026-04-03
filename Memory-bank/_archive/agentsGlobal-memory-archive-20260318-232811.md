# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-18 23:28
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 25


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260318-231923.md` on 2026-03-18 23:19 UTC.


### [2026-03-18 23:24 UTC] - copilot
Scope:
- Components: pricing-page-cta-wiring, portal-launch-context

Summary:
- Fixed the public pricing UX gap by adding visible CTA buttons on plan and SKU cards instead of leaving the pricing page as a read-only catalog.
- Wired pricing actions into `/app` billing and support launch context so plan, module, and Enterprise quote subjects can be prefilled from public pricing links.
- Kept the commercial model unchanged: standard paid tiers still use the fixed Stripe price map, while Enterprise Custom still routes through quote/manual activation rather than a public checkout SKU.

Validation:
- Local pricing page served on `http://127.0.0.1:8787/pricing`: PASS
- Local pricing API `GET /api/pricing/catalog`: PASS

Anchors:
- `server/public/assets/pricing.js`
- `server/public/assets/site.js`
- `server/public/pricing.html`
- `server/public/assets/pricing.css`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/daily/2026-03-18.md`
