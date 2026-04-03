# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 03:08
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 24


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-023730.md` on 2026-03-20 02:37 UTC.

- Secure review workflow expansion implemented: server-backed `/account/review/orchestration/*` routes, entitlement gate + rotating worker lease, redacted authenticated local review projection, DPAPI-protected review runtime control file, and paid customer-visible pricing/help copy for Pro/Team/Enterprise.

Validation:
- `npm run build` (server): PASS
- `./pg.ps1 review-status -Json`: PASS

Anchors:
- `server/src/reviewOrchestrationRoutes.ts`
- `server/src/reviewOrchestrationSupport.ts`
- `server/src/entitlementMatrix.ts`
- `server/src/types.ts`
- `server/src/store.ts`
- `server/src/index.ts`
- `scripts/review_workflow.ps1`
- `scripts/pg.ps1`
- `server/public/assets/pricingCatalogClient.js`
- `server/public/assets/help.js`
- `docs/PG_REVIEW_WORKFLOW_PROPOSAL.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
