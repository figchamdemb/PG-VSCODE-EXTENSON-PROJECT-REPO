# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 17:29
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 22


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-172024.md` on 2026-03-20 17:20 UTC.


Validation:
- MCP click on `Send Email Code`: PASS
- changed file diagnostics: PASS

Anchors:
- `server/public/app.html`
- `server/public/assets/site.js`
- `server/public/assets/app.css`
- `server/tests/smoke.auth.spec.ts`

### [2026-03-20 19:34 UTC] - copilot
Scope:
- Components: offline-payment-manual-review-flow, portal-billing-copy, smoke-offline-claim-check
- Files touched: portal billing UI + payment route + smoke test

Summary:
- Replaced the customer-facing proof-link model in `/app` with a manual bank-review flow centered on the generated `OFF...` reference code.
- The portal no longer asks the payer for a proof URL; instead it explains that the bank transfer should include the reference and that approval happens only after manual reconciliation.
