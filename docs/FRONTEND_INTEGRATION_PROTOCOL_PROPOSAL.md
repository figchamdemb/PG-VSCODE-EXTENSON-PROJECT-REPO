# Frontend Integration Protocol Proposal

LAST_UPDATED_UTC: 2026-03-17 23:50
UPDATED_BY: copilot
STATUS: implemented-local-and-server-baseline

## Purpose

Define a new enforced frontend/backend integration workflow that lets two agents work from the same Memory-bank, with the backend agent publishing tested integration steps and the frontend agent consuming those steps, implementing UI wiring, returning proof, and sending structured findings back when backend work is incomplete or wrong.

This document started as the design proposal for the workflow. The baseline described here is now implemented locally in the repo command surface and Memory-bank.
The protected orchestration mirror is now also implemented server-side for authenticated runs.

## Implementation Status

Implemented now:

1. `pg` command surface for `integration-init`, `backend-start`, `frontend-start`, `integration-status`, `integration-summary`, `integration-next`, `integration-ready`, `integration-complete`, `integration-watch`, `integration-export`, `integration-report`, `integration-respond`, `integration-open-page`, and aliases.
2. Shared ledger artifacts under `Memory-bank/frontend-integration*`.
3. Start-session inclusion, project bootstrap scaffolding, and guard enforcement.
4. Summary dashboard plus page-by-page markdown files with explicit agent identities.
5. Authenticated server-backed orchestration mirror and audit routes under `/account/integration/orchestration/*`.
6. Existing integration commands now sync through the server when a bearer token is available, then write the authoritative state back into the local ledger.

Still iterative:

1. Deep backend evidence auto-population.
2. Rich Postman/OpenAPI extraction into every page section.
3. Higher-tier policy expansion beyond the shipped baseline audit/transition checks.

## Current Baseline

The repo already has most of the primitives needed for this feature:

1. Shared startup and Memory-bank enforcement
   - `./pg.ps1 start -Yes`
   - strict session bootstrap
   - Memory-bank guard + pre-commit enforcement

2. Backend/frontend contract comparison
   - `./pg.ps1 api-contract-verify`
   - `Narrate: Run API Contract Validator`
   - OpenAPI-first, backend-inference fallback
   - frontend call extraction already exists

3. Frontend/browser smoke verification
   - `./pg.ps1 playwright-smoke-check`
   - `./pg.ps1 self-check`
   - Playwright smoke is now mandatory inside the self-check/prod enforcement flow; the shipped baseline validates the local `/health` route, landing page, and a real local email-auth portal flow on the dedicated smoke server.

4. Existing handoff pattern
   - `Narrate: OpenAPI Fix Handoff Prompt`
   - current system can already generate a backend-to-frontend mismatch handoff prompt

5. Existing step orchestration style
   - `closure-check`
   - `self-check`
   - governance worker / decision sync
   - machine-readable state in `Memory-bank/_generated/*.json`

## Operator Quick Start

Use this when you want the integration workflow running from one place without jumping between multiple docs.

1. Start the project workflow and Memory-bank session:
   - `./pg.ps1 start -Yes`
2. Check local developer/runtime credential hints before auth-heavy testing:
   - `./pg.ps1 dev-profile -DevProfileAction check`
3. Claim backend ownership in the shared integration ledger:
   - `./pg.ps1 backend-start`
4. Claim frontend ownership in the same ledger:
   - `./pg.ps1 frontend-start`
5. Refresh the working dashboard and pick the next page:
   - `./pg.ps1 integration-summary`
   - `./pg.ps1 integration-next -Role backend`
   - `./pg.ps1 integration-next -Role frontend`

Notes:

1. `backend-start` and `frontend-start` are role-claim commands, not replacements for `./pg.ps1 start -Yes`.
2. `dev-profile` is where local-only test/runtime values live; it reduces retry loops when auth, DB, or tool inputs are missing.
3. When a PG bearer token is available, the same commands also sync the protected server orchestration mirror.

## Local Auth Credential Note

The mandatory smoke baseline now spins up a dedicated local smoke server with `ENABLE_EMAIL_OTP=true` and `EXPOSE_DEV_OTP_CODE=true`, so the shipped suite proves the portal email-auth flow automatically. Outside that smoke harness, operators can still enable `ENABLE_EMAIL_OTP=true` in `server/.env` so `/app` and the extension email sign-in flow use the normal code-entry UI. If operators also enable `EXPOSE_DEV_OTP_CODE=true`, the start response exposes a local-only `dev_code` shortcut so the same verification UI or prompt can be completed without external mail delivery. `.env.example` intentionally keeps both flags `false` for safer shared defaults.

## Remaining Gaps Today

The baseline workflow is implemented. The remaining gaps are depth and automation, not missing command surface.

Remaining work:

1. Deep backend evidence auto-population is still partial for many pages.
2. Postman and OpenAPI extraction are detected, but the page files do not yet get rich per-endpoint evidence from those sources automatically.
3. Some page ledgers still start from scaffolded evidence instead of live route payloads, headers, DB proof, and smoke artifacts.
4. The mandatory smoke suite now proves local health, landing, and auth baseline behavior, but page-by-page integration smoke coverage still needs to grow over time.
5. Higher-tier policy expansion beyond the shipped baseline audit and transition checks is still iterative.

## Proposal Summary

Add a new Memory-bank integration surface that is always scaffolded and always enforced.

Recommended shape:

1. `Memory-bank/frontend-integration.md`
   - human-readable summary dashboard
   - current phase overview
   - ownership summary
   - latest ready step
   - page-by-page reference index
   - correction bucket / pending items

2. `Memory-bank/frontend-integration/`
   - `state.json`
   - `pages/01-login.md`, `02-dashboard.md`, ...
   - `evidence/`
   - `exports/`
   - `handoffs/`

This uses both a top-level markdown file and a folder. That resolves the current naming ambiguity in the request while keeping one obvious entrypoint for agents.

The summary file is the traffic controller.
The page files are the working detail.

That keeps the main page short, keeps each implementation area isolated, and prevents one giant markdown file from becoming unreadable.

## Agent Identity Model

Each active role should publish a visible identity block so the developer can see exactly which agent/model is responsible.

Suggested fields:

1. `agent_id`
2. `role`
3. `agent_family`
4. `model_name`
5. `session_mode`
6. `started_at_utc`
7. `last_heartbeat_utc`

Example identities:

1. `backend-codex-gpt-5.4-main`
2. `frontend-codex-gpt-5.4-main`
3. `backend-gemini-2.5-pro`
4. `frontend-claude-3.7-sonnet`

The exact model can vary. The important rule is that the role and model are explicit in both the summary page and `state.json`.

## Summary Dashboard Layout

`Memory-bank/frontend-integration.md` should behave like a daily report dashboard rather than a full conversation transcript.

Recommended sections:

1. `Frontend Integration`
2. `Agent Identities`
3. `Reference Index`
4. `Ready For Frontend`
5. `Pending Backend Corrections`
6. `Pending Developer Actions`
7. `Completed Pages`
8. `Latest Activity`
9. `Validation Snapshot`

The `Reference Index` should list each page area with direct links and current status, for example:

1. `Login` -> `Memory-bank/frontend-integration/pages/01-login.md`
2. `Dashboard` -> `Memory-bank/frontend-integration/pages/02-dashboard.md`
3. `Profile` -> `Memory-bank/frontend-integration/pages/03-profile.md`

The summary page must stay short and scannable. It should not hold the full endpoint and implementation detail for every page.

## Page-By-Page Working Files

Each feature/page gets its own markdown file under `Memory-bank/frontend-integration/pages/`.

Examples:

1. `01-login.md`
2. `02-dashboard.md`
3. `03-settings.md`

This is where the real working detail lives:

1. endpoints
2. auth and credentials
3. error handling requirements
4. UI guidance
5. exact backend evidence
6. frontend completion notes
7. correction requests
8. timestamps

When a page is complete, the agent must update:

1. the page file itself
2. the summary dashboard entry
3. `state.json`

Every page file should include an explicit reminder line:

`After updating this page, return to Memory-bank/frontend-integration.md and refresh the summary status.`

## Role Boundary Rules

The workflow should be strict about ownership.

1. Frontend role must not edit backend runtime code.
2. Backend role must not edit frontend runtime code.
3. Both roles may update the shared integration ledger and evidence files.
4. If frontend discovers a backend defect, missing credential, missing route behavior, or auth blocker, frontend must report it through the shared handoff flow instead of fixing backend code directly.
5. If backend believes the frontend finding is incorrect, backend must answer in the same step ledger with proof and either:
   - mark the issue fixed
   - mark the issue rejected with explanation
   - request developer action when human auth/credential intervention is required

This keeps ownership clean and prevents cross-layer accidental regressions.

### Backend Role

The backend agent should:

1. Re-read the codebase and structure map for the current project root.
2. Detect integration sources in this order:
   - OpenAPI / Swagger files
   - backend route inference
   - Postman collection if present
3. Build or refresh page-by-page integration files.
4. Pick the next incomplete step.
5. Validate that step end-to-end before handing it off.
6. Publish all required credentials, test users, auth setup notes, and environment prerequisites up front.
7. Write proof and instructions into the integration files.
8. Answer any frontend findings for the same step.
9. Mark the step `ready_for_frontend`.
10. Re-check the summary dashboard for `pending_backend_correction` items on every polling cycle.

### Frontend Role

The frontend agent should:

1. Start in the same project root and same Memory-bank.
2. Read `Memory-bank/frontend-integration.md` and `state.json`.
3. Poll or watch the summary dashboard for steps marked `ready_for_frontend`.
4. Read the backend evidence for that step.
5. Implement the UI integration exactly for that step.
6. Run Playwright smoke and capture proof.
7. If backend behavior is missing, wrong, or untestable, raise a structured finding instead of changing backend code.
8. Mark the step `integrated_by_frontend`, `blocked_on_backend`, or `blocked_on_developer` with evidence.
9. Return to the summary dashboard and update the main index after finishing the page file.

## Proposed Status Model

Every phase should move through explicit states:

1. `planned`
2. `claimed_by_backend`
3. `backend_testing`
4. `ready_for_frontend`
5. `claimed_by_frontend`
6. `frontend_integrating`
7. `frontend_smoke_passed`
8. `done`
9. `blocked_on_backend`
10. `blocked_on_developer`
11. `rejected_by_backend`
12. `pending_backend_correction`

This is more precise than a single ready/not-ready flag and is easy to enforce in guard scripts.

## Proposed Page File Shape

Each page markdown file should contain:

1. `Page ID`
2. `Feature / page name`
3. `Owner`
4. `Status`
5. `Backend summary`
6. `Frontend summary`
7. `Endpoints`
8. `Auth requirements`
9. `Headers`
10. `Query params`
11. `Request payload examples`
12. `Response payload examples`
13. `DB verification proof`
14. `Backend smoke proof`
15. `Frontend integration instructions`
16. `UI/UX notes from backend`
17. `Frontend smoke proof`
18. `Screenshot paths`
19. `Known blockers`
20. `Timestamps`
21. `Credentials / test accounts`
22. `Developer actions required`
23. `Frontend findings for backend`
24. `Backend response to frontend findings`
25. `Return to summary instruction`
26. `Frontend page line-count check`
27. `Trust / self-check validation status`

## Summary Index Rules

The summary dashboard should be the first place both agents look during each poll cycle.

Each indexed page row should include:

1. page name
2. page file path
3. current status
4. owner agent ID
5. latest timestamp
6. whether backend correction is pending
7. whether developer action is pending

Suggested status rendering:

1. `DONE`
2. `READY`
3. `PENDING_BACKEND_CORRECTION`
4. `PENDING_DEVELOPER`
5. `IN_PROGRESS`

If a UI renderer is added later, `DONE` can be shown in green. In markdown, the text status remains the source of truth.

## Proposed Machine-Readable State

`Memory-bank/frontend-integration/state.json` should be the source of truth for automation.

Suggested top-level schema:

```json
{
  "version": 1,
  "project_root": "C:/path/to/project",
  "last_updated_utc": "2026-03-17T04:15:00Z",
  "backend_agent": {
      "agent_id": "backend-codex-gpt-5.4-main",
      "model_name": "GPT-5.4",
    "status": "active",
    "last_heartbeat_utc": "2026-03-17T04:15:00Z"
  },
  "frontend_agent": {
      "agent_id": "frontend-codex-gpt-5.4-main",
      "model_name": "GPT-5.4",
    "status": "waiting",
    "last_poll_utc": "2026-03-17T04:15:00Z"
  },
   "summary": {
      "poll_seconds": 30,
      "pending_backend_corrections": 1,
      "completed_pages": 0
   },
   "pages": [
    {
         "page_id": "01-auth-login",
      "status": "ready_for_frontend",
         "page_file": "Memory-bank/frontend-integration/pages/01-login.md",
      "backend_evidence": {
        "source_mode": "openapi",
        "openapi_files": ["server/openapi.yaml"],
        "backend_smoke": "pass",
            "db_check": "pass",
            "credentials_bundle": {
               "auth_mode": "email-otp",
               "test_accounts": ["qa-login-01@example.local"],
               "required_secrets_present": true
            }
      },
      "frontend_evidence": {
        "playwright": "pending",
        "screenshots": []
         },
         "handoff": {
            "frontend_finding_status": "none",
            "backend_response_status": "none"
         },
         "validation": {
            "frontend_page_line_count": 312,
            "frontend_page_line_limit": 500,
            "trust_status": "pass"
      }
    }
  ]
}
```

## Proposed Commands

The workflow should support both command styles:

1. canonical CLI commands that match the current `pg.ps1` design
2. natural-language alias forms for humans and external agents

The single-token commands should remain the source of truth. Friendly alias forms should resolve to the same underlying handlers.

Recommended commands:

1. `./pg.ps1 integration-init`
   - scaffold `Memory-bank/frontend-integration.md`
   - scaffold folder structure
   - seed `state.json`

2. `./pg.ps1 backend-start`
   - claim backend role
   - scan backend/OpenAPI/Postman inputs
   - refresh phases

3. `./pg.ps1 frontend-start`
   - claim frontend role
   - begin polling `state.json`

4. `./pg.ps1 integration-status`
   - print current phases and owners

5. `./pg.ps1 integration-next`
   - show next actionable phase for current role

6. `./pg.ps1 integration-ready -StepId 01-auth-login`
   - backend marks a step ready for frontend

7. `./pg.ps1 integration-complete -StepId 01-auth-login`
   - frontend marks step integrated and tested

8. `./pg.ps1 integration-watch -Role frontend -PollSeconds 30`
   - polling helper for agent workflow

9. `./pg.ps1 integration-export -StepId 01-auth-login`
   - export payloads, headers, examples, and report bundle into `evidence/`

10. `./pg.ps1 integration-report -StepId 01-auth-login -Kind backend-missing`
   - frontend files a finding for backend or developer action

11. `./pg.ps1 integration-respond -StepId 01-auth-login -Resolution fixed`
   - backend answers the current finding with proof or rejection

12. `./pg.ps1 integration-summary`
   - print the current summary dashboard status and per-page index

13. `./pg.ps1 integration-open-page -PageId 02-dashboard`
   - open or print the detailed page file referenced from the summary

Recommended alias forms:

1. `./pg.ps1 start backend`
2. `./pg.ps1 start frontend`
3. `./pg.ps1 integration ready 01-auth-login`
4. `./pg.ps1 integration complete 01-auth-login`
5. `./pg.ps1 integration report 01-auth-login`
6. `./pg.ps1 integration respond 01-auth-login`
7. `./pg.ps1 integration summary`
8. `./pg.ps1 integration page 02-dashboard`

## Command Surface Recommendation

The current local router is based on a single positional command in `pg.ps1`, so the first implementation should keep the single-token commands as the stable path.

Natural-language forms should still exist, but as aliases after the underlying handlers are in place.

Why this split is safer:

1. lower parser risk
2. consistent with current command set
3. easier to document and enforce
4. easier to call from external agents
5. still allows human-friendly alias commands once the core handlers exist

## Bidirectional Polling Rules

Both agents should watch the summary dashboard while their `pg start` session is active.

1. Frontend checks the summary for `ready_for_frontend` pages.
2. Backend checks the summary for `pending_backend_correction` pages.
3. Both roles update `last_heartbeat_utc` or `last_poll_utc` in `state.json`.
4. Polling cadence should default to 30 seconds and allow 60 seconds.

That means the workflow is not one-way. Frontend can push a correction request into the summary, and backend will see it on the next poll cycle without waiting for the developer to manually inspect every page.

## Backend Evidence Rules

Before backend can mark a step ready, it should produce all applicable proof:

1. endpoint path + method
2. source origin
   - `openapi`
   - `postman`
   - `backend-inference`
3. auth mode
4. required headers
5. request payload example
6. response payload example
7. error payload example when applicable
8. smoke-test result
9. DB verification note when the endpoint mutates data
10. frontend instructions
11. UI suggestion notes when backend needs the UI to behave in a specific way
12. credentials bundle
13. test-user creation steps when required
14. explicit note when developer intervention is required for auth or protected environments

## Frontend Evidence Rules

Before frontend can mark a step complete, it should produce all applicable proof:

1. files changed
2. exact UI behavior added
3. API route wired
4. request/response mapping confirmed
5. Playwright smoke result
6. screenshot paths
7. any remaining limitation or backend blocker
8. finding severity
9. whether developer action is required or backend can resolve it alone

## Findings And Handoff Rules

When frontend cannot complete a step because backend behavior or setup is missing, frontend should create a structured finding instead of patching backend code.

Each finding should include:

1. step ID
2. exact failing action
3. expected behavior
4. actual behavior
5. request/response evidence
6. screenshot path if UI-visible
7. whether credentials were missing, invalid, or insufficient
8. whether a developer must perform an auth or environment action
9. copy-paste handoff text for the developer if direct agent-to-agent routing is unavailable
10. summary-bucket status set to `pending_backend_correction` when backend must respond

Backend must answer each finding by updating the same ledger entry with:

1. resolution status
2. fix summary or rejection summary
3. new proof
4. next action for frontend
5. updated timestamp that the frontend can compare against the prior attempt

If agent-to-agent routing exists, the system may auto-pass the finding to the backend role. If not, it should generate a clean developer-facing handoff block for copy/paste.

## Credential And Auth Rules

Backend must publish all test prerequisites before a step can move to `ready_for_frontend`.

Required upfront data:

1. test users
2. test passwords or OTP/test-auth flow notes when allowed
3. required headers
4. API keys, tokens, or mock values when safe for local/dev use
5. whether frontend can self-create the required user/account
6. whether developer action is needed for protected auth or real third-party identity flows
7. whether backend has already tested those credentials successfully

Frontend should be able to complete the normal integration loop without waiting for the developer in most cases. When that is not possible, the step must move to `blocked_on_developer` with explicit instructions.

## Existing Tool Reuse Plan

The implementation should reuse current tooling wherever possible.

### Reuse as-is

1. `start_memory_bank_session.ps1`
2. `memory_bank_guard.py`
3. `self_check.ps1`
4. `playwright_smoke_check.ps1`
5. `api_contract_verify.ps1`
6. extension API contract analyzer and handoff prompt builder
7. existing `_generated/*.json` pattern for machine-readable state
8. governance-style machine-readable status tracking patterns

### Extend

1. `pg.ps1`
   - add new integration commands

2. `scripts/project_setup.ps1` or install scaffold path
   - always create frontend integration files during bootstrap

3. `memory_bank_guard.py`
   - enforce presence of `Memory-bank/frontend-integration.md`
   - enforce presence of `Memory-bank/frontend-integration/state.json`
   - optionally enforce phase-state transitions

4. `self_check.ps1`
   - optionally include integration-state validation in later phase

5. command parser support in `pg.ps1`
   - keep canonical single-token commands
   - add natural-language aliases that route to the same handlers

6. summary dashboard generator
   - keep top-level page concise
   - maintain reference index into page-specific files

### New Logic Required

1. Postman collection discovery and extraction
2. phase generation from OpenAPI/backend routes
3. polling/watch logic for the frontend role
4. screenshot artifact capture path registration
5. step claim/ready/complete commands
6. page-summary synchronization helpers
7. frontend line-count validation registration

## Enforcement Proposal

Recommended enforcement rules:

1. `pg install backend` and `pg install frontend` should always scaffold the frontend integration files.
2. `pg start` should warn or block when the integration files are missing.
3. `memory_bank_guard.py` should fail in strict mode if those files are deleted.
4. If a repo has both frontend and backend code, integration state should not remain stale beyond a configurable time window.
5. A frontend integration phase cannot move to `done` unless Playwright proof is attached when UI is affected.
6. A backend phase cannot move to `ready_for_frontend` unless backend proof is attached.
7. Frontend role must not close backend findings by editing backend runtime code.
8. Backend role must not satisfy frontend completion by editing frontend runtime code.
9. `Memory-bank/frontend-integration.md` must remain a short summary/index, not a full dump of every page detail.
10. Every page file under `Memory-bank/frontend-integration/pages/` must remain under 500 lines.
11. Frontend completion cannot be marked done unless the changed frontend screen/page is at or under 500 lines.
12. Frontend completion must record line-count and trust/self-check validation in the page file and summary.

## Server-Side Versus Memory-Bank Enforcement

The implementation should deliberately split what stays private from what stays local and visible.

### Server-side or private enforcement candidates

1. policy thresholds for stale heartbeat enforcement
2. role-ownership rules and protected transition validation
3. audit/event history beyond the local markdown summary
4. enterprise-only orchestration features
5. future agent-routing or broker logic

### Memory-bank and local visible artifacts

1. human-readable phase files
2. local `state.json`
3. evidence bundles
4. copy-paste finding reports
5. current owner / status / last updated summaries
6. page reference index and correction bucket

This split protects the higher-value policy/orchestration logic while keeping the step-by-step collaboration legible inside the repo.

## Polling Strategy

The frontend side does not need a new server service for the first version.

Phase 1 recommendation:

1. file-based polling every 30 seconds by default
2. read `state.json`
3. frontend picks first `ready_for_frontend` page not already claimed
4. backend checks first `pending_backend_correction` page not already answered
5. claim it by writing state back

Operator option:

1. allow `30` or `60` seconds as the supported initial polling cadence
2. store current poll interval in `state.json` for transparency

Phase 2 recommendation:

1. add file watcher support where available
2. keep polling as fallback

## Packaging Recommendation

Recommended commercial split:

1. Base product:
   - scaffolded integration ledger
   - local file-based polling
   - canonical commands
   - summary page plus page-specific working files
   - frontend/backend evidence and finding flow
   - local copy-paste handoff mode

2. Enterprise tier:
   - server-backed orchestration enforcement
   - stale-heartbeat policy gates
   - richer audit history
   - optional direct agent-to-agent routing or brokered handoff
   - protected policy thresholds and advanced reporting

This keeps the core integration workflow broadly useful while reserving the harder-to-copy orchestration and audit layer for higher tiers.

## Recommended Rollout Order

### Phase A: Documentation + Scaffold

1. create the files/folder
2. add bootstrap/install scaffolding
3. add guard enforcement for file presence
4. add summary page plus page-file structure

### Phase B: Backend Step Publisher

1. add backend-start command
2. detect OpenAPI / backend routes
3. generate summary index and per-page files
4. mark pages ready

### Phase C: Frontend Step Consumer

1. add frontend-start command
2. add polling/watch
3. add page claim + complete commands
4. add pending-backend-correction bucket updates

### Phase D: Stronger Proof

1. Postman extraction
2. screenshot registration
3. richer DB verification hooks
4. optional browser/devtools evidence integration
5. frontend line-count and trust-validation capture

## Risks

1. Postman extraction is not present today and will require new parsing logic.
2. Automatic DB verification cannot be universal across stacks; some proof may remain note-based unless stack-specific adapters are added.
3. Free-form backend UI guidance can become noisy unless phase templates stay structured.
4. Multi-agent file writes need claim/heartbeat rules to avoid race conditions.
5. Natural-language aliases should not become a second implementation path; they must resolve to the same canonical handlers.
6. Credential handling must stay local-safe and must never cause secrets to be written into committed Memory-bank docs.
7. If the summary page is not kept short, it will become another noisy transcript instead of an operational dashboard.

## Recommendation

Approve implementation in this order:

1. scaffold + enforce `Memory-bank/frontend-integration.md` and `Memory-bank/frontend-integration/`
2. implement the summary dashboard plus page-by-page file structure
3. add `backend-start`, `frontend-start`, `integration-summary`, `integration-open-page`, `integration-ready`, and `integration-complete`
4. add `integration-report` and `integration-respond` so frontend and backend can exchange findings without cross-editing runtime code
5. wire existing OpenAPI/API-contract/Playwright tooling into that page-index workflow
6. add Postman extraction only after the first flow is working end-to-end

## Current Verdict

The repository already has about 70 percent of the technical foundation for this feature.

What exists now is verification.
What needs to be added is orchestration, shared integration memory, a summary-plus-page structure, strict ownership, credential publishing, structured findings between frontend and backend, and enforced 500-line/page validation.