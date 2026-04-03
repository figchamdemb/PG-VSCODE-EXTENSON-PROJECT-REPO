# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 02:05
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 24


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-010532.md` on 2026-03-19 01:05 UTC.

### [2026-03-19 01:05 UTC] - copilot
Scope:
- Components: pricing-gbp-fx-copy, portal-billing-clarity, final-validation

Summary:
- Added a short note to the public pricing page and secure portal billing card clarifying that checkout is charged in GBP.
- Clarified that international cards can still pay and that any local-currency conversion is typically applied by the buyer bank or card provider rather than by app-side currency switching.
- Completed required warn and strict self-check runs and refreshed generated Memory-bank artifacts after the copy update.

Validation:
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS
- `python scripts/build_frontend_summary.py`: PASS
- `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `server/public/pricing.html`
- `server/public/app.html`
- `server/public/assets/pricing.css`
- `Memory-bank/daily/2026-03-19.md`
