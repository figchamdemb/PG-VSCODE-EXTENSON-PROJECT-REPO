# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-19 16:22
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 29


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-155533.md` on 2026-03-19 15:55 UTC.


### [2026-03-17 18:10 UTC] - copilot
Scope:
- Components: frontend-integration-structure-tightening, summary-page-index-model
- Files touched: proposal doc + planning/daily memory files

Summary:
- Tightened the approved integration design from a generic ledger into a concrete structure:
  - one short summary dashboard markdown (`frontend-integration.md`),
  - page-by-page markdown files under `frontend-integration/pages/`,
  - explicit agent IDs and model names for backend/frontend roles,
  - bidirectional polling where frontend watches `ready_for_frontend` and backend watches `pending_backend_correction`,
  - linked correction buckets and per-page return-to-summary update rules,
  - strict <=500-line enforcement for integration markdown pages and completion-time frontend page line-count recording.
- Kept the command design aligned to this structure by adding summary/page-oriented command ideas alongside the earlier canonical/alias split.

### [2026-03-17 23:05 UTC] - copilot
Scope:
- Components: mandatory-playwright-enforcement, local-auth-smoke-clarity
- Files touched: self-check/prod policy docs, env example comments, planning memory files

Summary:
- Promoted Playwright smoke from optional/strict-only wording to mandatory repo enforcement in the documented `pg self-check` and `pg prod` paths.
- Aligned Memory-bank planning/docs so rollout defaults now describe Playwright smoke in every prod profile and in final self-check guard expectations.
- Clarified that the shipped mandatory smoke suite remains credential-light (`/health` + `/`), while local email-auth browser testing can opt into `ENABLE_EMAIL_OTP=true` and `EXPOSE_DEV_OTP_CODE=true` in `server/.env` without changing shared `.env.example` defaults.
