# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 04:16
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 24


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-032918.md` on 2026-03-20 03:29 UTC.

- Confirmed the review workflow reached `mode=server`, approved the live test page, and observed matching `init`, `start-role`, `report`, `respond`, and `approve` actions in `/account/review/orchestration/audit`.

Validation:
- direct authenticated `scripts/review_workflow.ps1` smoke flow: PASS
- `/account/review/orchestration/audit`: PASS

Anchors:
- `scripts/review_workflow.ps1`
- `Memory-bank/project-details.md`
- `Memory-bank/daily/2026-03-20.md`

### [2026-03-20 04:07 UTC] - copilot
Scope:
- Components: review-statefile-auth-fix, review-regression-check
- Files touched: review workflow runtime/test helper + memory docs

Summary:
- Traced the saved-CLI-state auth bug on the normal review command path.
- Root cause was helper ordering in `scripts/review_workflow.ps1`: `Resolve-AccessToken` ran before `ConvertFrom-JsonCompat` existed, so the state-file JSON parse failed silently and review commands stayed in local mode unless `-AccessToken` was passed explicitly.
- Moved the JSON helper above auth resolution and added `scripts/review_workflow_regression_check.ps1` to guard both the helper-order requirement and the null-path markdown rendering fix.
- Confirmed the normal routed command path now auto-engages server mode again.
