# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 21:27
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 21


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-195616.md` on 2026-03-20 19:56 UTC.

### [2026-03-19 16:50 UTC] - copilot
Scope:
- Components: integration-hardening, entitlement-gated-worker-lease, enforcement-boundary-clarity
- Files touched: integration script/router, orchestration server routes/support/types, memory docs

Summary:
- Hardened authenticated frontend integration orchestration so copied local files or revoked subscriptions stop working quickly.
- Added a dedicated `integration-worker` router command for persistent guarded worker sessions.
- Switched `Memory-bank/_generated/frontend-integration-runtime.json` from plaintext JSON to a DPAPI-backed protected envelope in the local PowerShell runtime.
- Changed authenticated local integration `state.json`, page markdown, and export artifacts to redacted projections while keeping full detail server-authoritative.
- Added server-side entitlement gating and rotating worker leases on `/account/integration/orchestration/*`.
- Clarified in docs that PG enforcement activates from detected `AGENTS.md` + `pg.ps1` project context, not from a `Memory-bank/` folder alone.

Validation:
- `npm run build` (server): PASS

Anchors:
- `scripts/frontend_integration.ps1`
