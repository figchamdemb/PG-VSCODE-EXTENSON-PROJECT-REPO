# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 15:55
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 35


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-092751.md` on 2026-03-19 09:27 UTC.

- `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `server/public/pricing.html`
- `server/public/app.html`
- `server/public/assets/pricing.css`
- `Memory-bank/daily/2026-03-19.md`
- Files touched: proposal doc + planning/daily memory files

Summary:
- Incorporated the user-approved refinement pass for the staged frontend/backend integration workflow.
- Tightened the design so the workflow now explicitly requires:
  - strict frontend/backend runtime ownership boundaries,
  - structured frontend findings and backend responses instead of cross-layer fixes,
  - backend-published credentials/test-user prerequisites before `ready_for_frontend`,
  - support for both canonical single-token CLI commands and natural-language alias forms,
  - 30/60 second frontend polling guidance,
  - a split between local-visible Memory-bank artifacts and server-private orchestration/audit policy.
- Recommended packaging split:
  - base product gets the local ledger/evidence/handoff workflow,
  - enterprise gets server-backed orchestration enforcement, stale-heartbeat policy, richer audit, and optional direct agent routing.

Validation:
- proposal/planning docs updated; runtime implementation not started in this batch

Anchors:
- `docs/FRONTEND_INTEGRATION_PROTOCOL_PROPOSAL.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/daily/2026-03-17.md`
- `Memory-bank/daily/LATEST.md`
