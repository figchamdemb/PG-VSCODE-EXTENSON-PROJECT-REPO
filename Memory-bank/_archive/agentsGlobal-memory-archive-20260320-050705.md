# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 05:07
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 23


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-041617.md` on 2026-03-20 04:16 UTC.


Validation:
- `./scripts/review_workflow_regression_check.ps1`: PASS
- `./pg.ps1 review-status -Json`: PASS (`mode=server`)

Anchors:
- `scripts/review_workflow.ps1`
- `scripts/review_workflow_regression_check.ps1`
- `Memory-bank/project-details.md`
- `Memory-bank/daily/2026-03-20.md`

### [2026-03-20 16:40 UTC] - copilot
Scope:
- Components: help-surface-grouping, tier-label-alignment
- Files touched: extension help content, hosted help UI/assets, memory docs

Summary:
- Split the extension help content so prompt handoff commands, frontend/backend integration commands, and secure review commands are listed in dedicated sections instead of being buried in one generic quickstart table.
- Added a workflow access map in extension help so Pro/Team/Enterprise routing is explicit.
- Fixed a product-surface mismatch on `/help`: frontend/backend integration commands were shown as Free even though `server/src/entitlementMatrix.ts` gates them to Pro/Team/Enterprise.
