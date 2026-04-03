# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 09:14
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 48


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-072947.md` on 2026-03-19 07:29 UTC.

### [2026-03-17 04:15 UTC] - copilot
Scope:
- Components: frontend-integration-proposal, memory-bank-planning
- Files touched: proposal doc + project planning memory files

Summary:
- Audited the current repo against the requested staged frontend/backend integration idea.
- Confirmed current foundation already exists in these areas:
  - strict Memory-bank session/bootstrap enforcement,
  - OpenAPI-first API contract validation with backend inference fallback,
  - Playwright smoke execution in `pg self-check`,
  - API contract handoff prompt generation.
- Confirmed missing orchestration pieces:
  - no dedicated frontend integration ledger in Memory-bank,
  - no backend/frontend role commands,
  - no polling workflow,
  - no Postman extraction.
- Added a proposal-only doc describing the target folder/file layout, state model, command surface, evidence rules, and rollout order before runtime implementation begins.

Validation:
- `./pg.ps1 map-structure`: PASS
- `./pg.ps1 start -Yes`: PASS

Anchors:
- `docs/FRONTEND_INTEGRATION_PROTOCOL_PROPOSAL.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`

### [2026-03-17 16:40 UTC] - copilot
Scope:
- Components: frontend-integration-proposal-approval-delta, planning-scope-tightening


### [2026-03-19 01:04 UTC] - copilot
Scope:
- Components: pricing-gbp-fx-copy, portal-billing-clarity, final-validation

Summary:
- Added a short note to the public pricing page and secure portal billing card clarifying that checkout is charged in GBP.
- Clarified that international cards can still pay and that any local-currency conversion is typically applied by the buyer bank or card provider rather than by app-side currency switching.
- Completed required warn and strict self-check runs and refreshed generated Memory-bank artifacts after the copy update.

Validation:
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS
- `python scripts/build_frontend_summary.py`: PASS
