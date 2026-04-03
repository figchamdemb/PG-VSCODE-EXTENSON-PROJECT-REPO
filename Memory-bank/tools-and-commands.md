# Tools & Commands

LAST_UPDATED_UTC: 2026-03-28 03:30
UPDATED_BY: codex
PROJECT_TYPE: frontend

## Purpose
Single source for local run commands, runtime inventory, and command-surface references.

## Runtime Versions
| Tool | Version | Where Used | Notes |
|---|---|---|---|
| Node.js | v20.20.0 | extension + server runtime/tooling | required for build/dev scripts |
| npm | 10.8.2 | extension + server dependency/build | uses `npm install`, `npm run compile`, `npm run build` |
| Python | 3.14.0 | memory-bank scripts | summary/generator/guard |
| PowerShell | 7+/Windows PowerShell | local command flow | required for `pg.ps1` workflows |
| cloudflared | 2025.8.1 | local tunnel/public domain ingress | installed via winget (`Cloudflare.cloudflared`) |

## First-Run Terminal Rules
- Always run PG commands from the project root that contains `pg.ps1`.
- PowerShell directory change:
  - `Set-Location "C:\real\project\root"`
- CMD directory change:
  - `cd /d "C:\real\project\root"`
- If unsure which commands are available for an installed project profile:
  - `.\pg.ps1 help`
- If extension popup says `needs a PG project root`, click `Open Fix Guide` for exact PowerShell/CMD commands and detected root suggestions.
- If running `.\pg.ps1` from the wrong folder, wrapper now prints a plain-language fix with both shells and expected files (`pg.ps1`, `scripts/pg.ps1`).
- Hosted `/help` now includes tabbed operator docs:
  - `Command Help`
  - `About Narrate`
  - `About Memory-bank + PG Install`
  - `Slack Decision Flow`
  - `Automation + Cloud + Enterprise`
  - `Providers + Handoff`
  - the `Command Help` tab now groups rows by workflow family so extension prompt commands, frontend/backend integration, secure review, governance, and enterprise controls are easier to find
  - the `Command Help` tab now also includes workflow shortcut buttons that jump the table directly into prompt, integration, secure review, and governance slices
  - `integration-*`, `backend-start`, and `frontend-start` are now labeled as `Pro/Team/Enterprise` in `/help`, matching the entitlement matrix and pricing catalog
  - the extension Help sidebar now also includes a quick-access jump list for prompt commands, frontend/backend workflow, secure review, decision sync, Slack commands, and troubleshooting
- If scope changes, track request IDs in spec + milestones:
  - add REQ tags in `Memory-bank/project-spec.md` (example: `[REQ-2026-03-05-01]`),
  - map same REQ tags in `Memory-bank/project-details.md` milestone rows/session updates.
- If UI/frontend work is requested:
  - read `docs/FRONTEND_DESIGN_GUARDRAILS.md` first,
  - if the user provides a design guide/prompt/screenshot, use that as the primary design source and keep the repo guide as fallback only.
  - the guide now includes secure mobile auth/approvals/vault pattern examples and button families for React, React Native, and Kotlin/Compose work.
  - translate those patterns natively instead of copying HTML/Tailwind literally into another stack.
- Agent startup instruction files:
  - `AGENTS.md` remains the canonical repo workflow contract
  - `ANTIGRAVITY.md` and `GEMINI.md` now mirror the startup contract with stronger top-of-file override wording for extension-based agents
  - `.agents/workflows/startup.md` is an optional workflow helper for tools that support repo-local startup workflows or slash-style startup commands
  - `AI_ENFORCEMENT_GUIDE.md` explains why markdown can improve compliance but does not replace hook/script enforcement
- Narrate extension startup guard:
  - auto-detects nearest `AGENTS.md` / `pg.ps1` context from the active file/workspace
  - auto-runs `.\pg.ps1 start -Yes -EnforcementMode strict` once per context per UTC day
  - reruns startup when you move into a new nested repo/subproject
  - keeps mandatory enforcement active per workspace across restart until you explicitly stop it
  - if a workspace has root `AGENTS.md` or `Memory-bank/` evidence but startup context is broken, Narrate now shows a fail-closed popup again instead of silently skipping enforcement
  - extension auto-start also adds `-SkipDevProfileNotice` so local-only dev-profile reminders do not leak into normal user-facing startup UX
  - `scripts/start_memory_bank_session.ps1` now verifies the repo-root `AGENTS.md` seal before refresh/enforcement work and restores the read-only bit when the file contents still match the sealed hash
  - if map-structure artifacts are stale or missing, startup now auto-runs the default map refresh before continuing instead of failing immediately
  - startup failure popups now summarize the real blocker text instead of dumping raw PowerShell wrapper or ANSI noise
  - manual retry command: `Narrate: Run Startup For Current Context`
  - explicit stop command: `Narrate: Stop PG Enforcement For Workspace`
  - explicit resume command: `Narrate: Resume PG Enforcement For Workspace`
  - terminal parity commands: `./pg.ps1 stop-enforcement` and `./pg.ps1 resume-enforcement`
  - the terminal/extension bridge file is `Memory-bank/_generated/pg-enforcement-bridge.json`; if the extension is not loaded yet, the pending request remains there until the watcher acknowledges it
  - important: healthy auto-start still needs the PG project controls (`AGENTS.md`, `pg.ps1`), but once enforcement is active the extension also treats root `AGENTS.md` or `Memory-bank/` evidence as sufficient to keep the workspace blocked locally until fixed or stopped
- Extension manifest note:
  - VS Code now auto-generates command/view activation events from `contributes`, so `extension/package.json` keeps only explicit non-generated activation entries such as `onStartupFinished`
  - `scripts/narrate_flow_check.ps1` now treats contributed command declarations plus runtime registration as the source of truth when auto-generated activation is in use; it no longer false-fails on intentionally removed redundant `onCommand:` entries
  - if you still see old activation-event warnings in the Problems panel after the manifest cleanup, reload the window or close/reopen `extension/package.json` so the diagnostics refresh
- AGENTS protection helper:
  - seal or repair: `powershell -ExecutionPolicy Bypass -File .\scripts\agents_integrity.ps1 -Action seal`
  - verify without resealing: `powershell -ExecutionPolicy Bypass -File .\scripts\agents_integrity.ps1 -Action verify`
  - status: `powershell -ExecutionPolicy Bypass -File .\scripts\agents_integrity.ps1 -Action status`
  - state file: `Memory-bank/_generated/agents-integrity.json`
  - note: this is a local safeguard, not a cryptographic remote attestation; an owner with local write access can still intentionally reseal after approved edits
- Narrate Trust runtime:
  - active-file Trust is now server-backed through `/account/policy/trust/evaluate`
  - Narrate sends active file content, component hint, nearest-project validation-library metadata, and local IDE diagnostics
  - Trust auth now uses the signed-in licensing token from extension secret storage by default
  - manual fallback remains available through the visible VS Code setting `narrate.licensing.sessionToken`
  - guarded workflow commands now stop when Trust is blocked or when backend Trust cannot evaluate the active file
  - latest dependency/coding verification findings are persisted into `Memory-bank/_generated/self-check-latest.json` so handoff prompts and external tools can read current warnings
- Licensing browser-return flow:
  - `Narrate: Sign In (GitHub)` now opens the provider sign-in page in the browser and returns to the installed editor through a trusted editor callback URI
  - `Narrate: Upgrade Plan (Checkout)` still opens Stripe Checkout in the browser, but the hosted success/cancel pages now try to return the customer to the editor and auto-refresh the license on success
  - backend allowlist envs for editor return: `OAUTH_CALLBACK_SCHEMES` and `OAUTH_EDITOR_CALLBACK_HOSTS`

### One-time project bootstrap (PowerShell)
- `pg install backend --target "."`
- `pg install frontend --target "."` (frontend-only projects)
- `./pg.ps1 upgrade-scaffold -DryRun`
- `./pg.ps1 install backend --target "C:\real\other-repo" -UpgradeScaffold -DryRun`
- `./pg.ps1 integration-init` (existing repo bootstrap for the shared frontend/backend integration ledger)
- `.\pg.ps1 start -Yes`
- `.\pg.ps1 map-structure` (legacy/half-built project scan)
- `.\pg.ps1 status`

### One-time project bootstrap (CMD)
- `pg install backend --target "."`
- `pg install frontend --target "."` (frontend-only projects)
- `pg.cmd integration-init`
- `pg.cmd start -Yes`
- `pg.cmd map-structure`
- `pg.cmd status`
- note: in plain CMD prefer `pg.cmd ...`; reserve `.\pg.ps1 ...` for PowerShell and `pwsh`

### Legacy project structure mapping (project root)
- Command:
  - `.\pg.ps1 map-structure`
  - aliases: `.\pg.ps1 structure-map`, `.\pg.ps1 scan-structure`
- Purpose:
  - aggressively scan existing source tree and migration/schema artifacts,
  - generate first-pass docs:
    - `Memory-bank/code-tree/auto-*-tree.md`
    - `Memory-bank/db-schema/auto-discovered-schema.md`
    - `Memory-bank/_generated/map-structure-latest.json`
- Optional tuning:
  - `-MapProfile auto|backend|frontend|mobile`
  - `-MapMaxDepth 4`
  - `-MapMaxEntries 1400`
  - `-MapMaxComponents 12`

## Core Commands
### Memory-bank session (project root)
- Start:
  - `.\pg.ps1 start -Yes`
  - `.\pg.ps1 start -Yes -EnforcementMode warn|strict`
  - `./pg.ps1 start -Yes -EnforcementMode strict -SkipDevProfileNotice` (internal extension startup path)
  - default enforcement mode is now `strict` (legacy map docs must be fresh); use `-EnforcementMode warn` only when you intentionally need warning-only behavior.
  - emergency bypass only: `.\pg.ps1 start -Yes -SkipMapStructureGate`
- Status:
  - `.\pg.ps1 status`
  - status output now includes daily retention summary (`daily_reports_count`, `daily_keep_days`, `daily_retention`).
- End:
  - `.\pg.ps1 end -Note "finished for today"`
- Alternate start:
  - `powershell -ExecutionPolicy Bypass -File scripts/start_memory_bank_session.ps1`
- Rebuild summary:
  - `python scripts/build_frontend_summary.py`
- Generate/update Memory-bank:
  - `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`
  - generator now auto-prunes future-dated daily files and oldest overflow files to enforce retention cap.
  - generator now also rotates oversized append-only logs (`agentsGlobal-memory.md`, `mastermind.md`) into `Memory-bank/_archive/`.
- Memory-bank enforcement now defaults to hard-blocking behavior:
  - `scripts/memory_bank_guard.py` defaults to `strict`
  - hook installers now default to `strict`
  - CI guard defaults to `strict` unless `MB_ENFORCEMENT_MODE` is explicitly overridden
  - `./pg.ps1 self-check` now runs the Memory-bank guard against the working tree after writing the self-check summary, so local agent edits are checked before commit hooks ever run
  - same-machine rollout rule: extension/VSIX update is machine-wide after install + VS Code window reload, but hooks/session/generated state remain repo-local, so each existing repo still needs `./pg.ps1 start -Yes` and a strict self-check after receiving the updated repo files
- Offline payment local workflow:
  - use `Create Offline Reference` to generate the bank-transfer reference code
  - the payer should include that `OFF...` code in the bank transfer note/description
  - `Mark Payment Sent For Review` only flags the reference for manual review; it does not require a proof URL
  - approval still happens only after admin bank reconciliation and offline review approval
- Install hooks:
  - `powershell -ExecutionPolicy Bypass -File scripts/install_memory_bank_hooks.ps1 -Mode strict`

### Scaffold upgrade workflow
- Current repo preview:
  - `./pg.ps1 upgrade-scaffold -DryRun`
- Current repo apply:
  - `./pg.ps1 upgrade-scaffold -Yes`
- Refresh machine-global PG CLI payload:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\sync_global_pg_cli.ps1`
- Cross-repo compatibility path from an updated PG root:
  - `./pg.ps1 install backend --target "C:\real\other-repo" -UpgradeScaffold -DryRun`
  - `./pg.ps1 install backend --target "C:\real\other-repo" -UpgradeScaffold -Yes`
- True stale-repo local path after global sync:
  - `pg install backend -UpgradeScaffold -DryRun`
  - `pg install backend -UpgradeScaffold -Yes`
- Output:
  - report bundle at `Memory-bank/_generated/scaffold-upgrades/<session-id>/`
  - scaffold version marker at `Memory-bank/_generated/pg-scaffold-version.json`
- Default safety rules:
  - preview-only unless `-Yes` is supplied
  - preserve `Memory-bank/` history and app source
  - replace PG-managed wrappers/scripts
  - flag instruction-file conflicts for manual review instead of blind overwrite

### Playwright authoring + full evidence workflow
- Generate authored suite from the current frontend/server project:
  - `./pg.ps1 playwright-author`
- Run the existing PG Playwright suite only:
  - `./pg.ps1 playwright-smoke-check -PlaywrightBrowserMatrix minimal|desktop|full -InstallPlaywrightBrowsers`
- Run the full authored workflow in one command:
  - `./pg.ps1 playwright-full-check -PlaywrightBrowserMatrix minimal|desktop|full -InstallPlaywrightBrowsers`
- Generated/managed authored suite paths:
  - `server/tests/pg-generated/`
  - `Memory-bank/_generated/playwright-authoring/playwright-authoring-latest.json`
- Latest run/report pointers:
  - `Memory-bank/_generated/playwright-smoke/playwright-smoke-latest.json`
  - `Memory-bank/_generated/playwright-full-check/playwright-full-check-latest.json`
- Per-run failure evidence now also includes:
  - `failures.json` (machine-readable failing-test list)
  - `failures.md` (operator-friendly failing-test list)
  - retained screenshot, video, trace, and `error-context.md` attachments from Playwright failures
- Current authored-suite footprint:
  - grouped route, forms, suspicious-input, accessibility, and commerce-like specs under `server/tests/pg-generated/`
  - full-matrix authored run on this repo currently completes in roughly 20 minutes on one worker (`205` total tests, `105` passed, `100` skipped)

### Narrate exact-view sync + enforcement bridge
- Reading UX:
  - exact side-by-side Narrate view now mirrors source-line selections into the narration pane and mirrors narration selections back to the source editor
  - whole selected line ranges are highlighted on both sides and auto-revealed when they are outside the current viewport
  - side-by-side open now preserves focus on the source editor so the Narrate pane follows the code instead of stealing focus
- Terminal enforcement bridge:
  - `./pg.ps1 stop-enforcement`
  - `./pg.ps1 resume-enforcement`
  - `pg.cmd stop-enforcement`
  - `pg.cmd resume-enforcement`
  - bridge file: `Memory-bank/_generated/pg-enforcement-bridge.json`
  - expected behavior: if the updated extension host is active, the file status changes from `pending` to `applied`; otherwise the request remains queued until the extension watcher processes it
  - shell rule: use `.\pg.ps1 ...` in PowerShell or `pwsh`, and use `pg.cmd ...` in plain CMD so users do not need to remember the PowerShell wrapper syntax

### Frontend integration workflow (project root)
- Purpose:
  - keep backend/frontend handoff state in `Memory-bank/frontend-integration.md`, `Memory-bank/frontend-integration/state.json`, and page files under `Memory-bank/frontend-integration/pages/`
  - enforce a short summary/index plus page-by-page detail with explicit agent identities and correction buckets
- Canonical commands:
  - `./pg.ps1 integration-init`
  - `./pg.ps1 integration-worker -Role backend|frontend -PollSeconds 30`
  - `./pg.ps1 backend-start`
  - `./pg.ps1 frontend-start`
  - `./pg.ps1 backend-start -Persistent -PollSeconds 30`
  - `./pg.ps1 frontend-start -Persistent -PollSeconds 30`
  - `./pg.ps1 backend-stop`
  - `./pg.ps1 frontend-stop`
  - `./pg.ps1 integration-stop -Role backend|frontend`
  - `./pg.ps1 integration-end -Role backend|frontend`
  - `./pg.ps1 integration-status`
  - `./pg.ps1 integration-summary`
  - `./pg.ps1 integration-next -Role backend|frontend`
  - `./pg.ps1 integration-ready -StepId 01-auth-login`
  - `./pg.ps1 integration-complete -StepId 01-auth-login`
  - `./pg.ps1 integration-watch -Role frontend -PollSeconds 30 -Once`
  - `./pg.ps1 integration-export -StepId 01-auth-login`
  - `./pg.ps1 integration-report -StepId 01-auth-login -Kind backend-missing -Details "describe the blocker"`
  - `./pg.ps1 integration-respond -StepId 01-auth-login -Resolution fixed -Details "describe the response"`
  - `./pg.ps1 integration-open-page -PageId 02-dashboard`
- Alias forms:
  - `./pg.ps1 start backend`
  - `./pg.ps1 start frontend`
  - `./pg.ps1 integration worker backend`
  - `./pg.ps1 integration summary`
  - `./pg.ps1 integration stop backend`
  - `./pg.ps1 integration end frontend`
  - `./pg.ps1 integration page 02-dashboard`
  - `./pg.ps1 integration ready 01-auth-login`
  - `./pg.ps1 integration complete 01-auth-login`
  - `./pg.ps1 integration report 01-auth-login`
  - `./pg.ps1 integration respond 01-auth-login`
- Notes:
  - `integration-worker` is the dedicated persistent worker command; it maps to the same integration engine but defaults to worker-oriented session semantics and persistent watch behavior
  - default integration polling cadence is `30` seconds unless `-PollSeconds` is explicitly passed
  - `backend-start` and `frontend-start` now support `-Persistent` to claim the role and immediately enter the same local watch loop that `integration-watch` uses
  - use `-Persistent` when each agent already has its own terminal/chat context and should keep heartbeating locally without requiring a second explicit watch command
  - use `backend-stop`, `frontend-stop`, `integration-stop`, or `integration-end` from another terminal when a persistent worker needs to exit cleanly on the next heartbeat cycle instead of being killed abruptly
  - the worker stop/end signal is stored in the minimal generated file `Memory-bank/_generated/frontend-integration-runtime.json`; the human-facing ledger remains in `Memory-bank/frontend-integration.*`
  - that generated runtime file now uses a DPAPI-backed protected envelope instead of plain JSON on disk
  - `scripts/project_setup.ps1` now auto-scaffolds the integration surface for new project bootstraps
  - existing or legacy repos that predate this workflow may need one-time `./pg.ps1 integration-init` if `Memory-bank/frontend-integration.md` is missing
  - `backend-start` and `frontend-start` are role-claim commands only; they do not replace `pg install ...` or `./pg.ps1 start -Yes`
  - guard enforcement now requires the integration summary/state/page artifacts to exist and keeps integration page files at `<=500` lines
  - `scripts/frontend_integration.ps1 -Action summary` now seeds page evidence so the generated login/dashboard ledgers include backend endpoints, auth notes, request/response/error examples, smoke notes, and developer action guidance by default
  - when `PG_ACCESS_TOKEN`, `-AccessToken`, or lifecycle auth state is available, the same commands now sync through `/account/integration/orchestration/*` on the local server and write a redacted local projection while keeping full workflow detail on the server
  - authenticated server-backed mode now requires the integration entitlement and a short-lived worker lease that rotates on each state/sync call
  - server-backed mode keeps protected audit history and transition validation outside the local markdown ledger while still preserving local-only fallback for unauthenticated repos
  - `local-first` here means the worker heartbeat/control loop can run without remote polling; it does not mean the private orchestration logic or audit trail have to live only on disk when authenticated server mode is available

### Review workflow (project root)
- Purpose:
  - keep builder/reviewer handoff state in `Memory-bank/review-workflow.md`, `Memory-bank/review-workflow/state.json`, and page files under `Memory-bank/review-workflow/pages/`
  - keep role heartbeat and stop/end control in `Memory-bank/_generated/review-workflow-runtime.json`
  - force builder/reviewer communication through structured findings, builder replies, and reviewer approval notes instead of ad hoc chat handoff
  - `/help` and the extension command help now list this workflow as `Pro/Team/Enterprise`, with Team/Enterprise called out as the collaborative and automation-heavy tiers
- Canonical commands:
  - `./pg.ps1 review-init -Title "review batch" -Details "scope"`
  - `./pg.ps1 review-builder-start`
  - `./pg.ps1 review-reviewer-start`
  - `./pg.ps1 review-builder-start -Persistent -PollSeconds 30`
  - `./pg.ps1 review-reviewer-start -Persistent -PollSeconds 30`
  - `./pg.ps1 review-status`
  - `./pg.ps1 review-summary`
  - `./pg.ps1 review-report -PageId 01-review-workflow-baseline -Title "finding" -Kind medium -Details "evidence"`
  - `./pg.ps1 review-respond -PageId 01-review-workflow-baseline -Resolution fixed -Details "patch + validation"`
  - `./pg.ps1 review-approve -PageId 01-review-workflow-baseline -Details "verified"`
  - `./pg.ps1 review-stop -Role builder|reviewer`
  - `./pg.ps1 review-end -Details "finished"`
  - `./pg.ps1 review-open-page -PageId 01-review-workflow-baseline`
- Alias forms:
  - `./pg.ps1 review init`
  - `./pg.ps1 review builder-start`
  - `./pg.ps1 review reviewer-start`
  - `./pg.ps1 review status`
  - `./pg.ps1 review summary`
  - `./pg.ps1 review report 01-review-workflow-baseline`
  - `./pg.ps1 review respond 01-review-workflow-baseline`
  - `./pg.ps1 review approve 01-review-workflow-baseline`
  - `./pg.ps1 review stop builder`
  - `./pg.ps1 review end`
  - `./pg.ps1 review page 01-review-workflow-baseline`
- Notes:
  - `review-init` creates the summary ledger, machine-readable state, generated runtime control file, and the first page markdown under `Memory-bank/review-workflow/pages/`
  - `review-respond` acts as the builder publish command when no reviewer findings exist yet, then acts as the builder reply command once findings are open
  - `review-report` records reviewer findings against the active or requested page and sets the next actor back to `builder`
  - `review-approve` verifies open findings on the current page and marks that page approved
  - `review-builder-start` and `review-reviewer-start` claim the role once; add `-Persistent` to keep a heartbeat loop running until `review-stop` or `review-end` is issued
  - when `PG_ACCESS_TOKEN`, `-AccessToken`, or lifecycle auth state is available, the same commands now sync through `/account/review/orchestration/*` on the local server and write a redacted local projection while keeping full review detail on the server
  - saved lifecycle auth in `Memory-bank/_generated/pg-cli-state.json` now auto-engages authenticated server-backed review mode on the normal `./pg.ps1 review-*` path again; explicit `-AccessToken` is only needed when you want to override the saved session
  - authenticated server-backed mode now requires the secure review entitlement and a short-lived worker lease that rotates on each state/sync call
  - `Memory-bank/_generated/review-workflow-runtime.json` is now stored as a DPAPI-protected envelope instead of plaintext JSON
  - server-backed mode keeps protected audit history and transition validation outside the local markdown ledger while still preserving local-only fallback for unauthenticated repos
  - local regression helper: `./scripts/review_workflow_regression_check.ps1`

### Playwright smoke validation (project root or `server/`)
- Server-local command:
  - `Set-Location server; npm run playwright:install`
  - `Set-Location server; npm run smoke:playwright`
  - `Set-Location server; npm run smoke:playwright:report`
- Repo-root validation path:
  - `./pg.ps1 playwright-smoke-check -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers`
  - `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck -PlaywrightBrowserMatrix desktop`
  - `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers`
  - Local/offline override example: `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck -EnablePlaywrightSmokeCheck -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers -SkipRegistryFetch -AllowDbIndexConnectionWarning`
- Notes:
  - mandatory smoke now covers `/health`, `/`, and a real `/app` local email-auth flow
  - the smoke harness uses a dedicated local port (`8791`) and smoke-only env overrides: `STORE_BACKEND=json`, `ENABLE_EMAIL_OTP=true`, `EXPOSE_DEV_OTP_CODE=true`
  - PG-run smoke now writes HTML/JSON evidence under `Memory-bank/_generated/playwright-smoke/` and surfaces the latest artifact paths in the terminal + self-check summary
  - browser matrix modes are `minimal` (chromium), `desktop` (chromium/firefox/webkit), and `full` (desktop + mobile Chrome/Safari)

### PG CLI lifecycle (project root)
- Login and persist CLI auth/profile state:
  - `.\pg.ps1 login -Email "you@example.com"`
  - `.\pg.ps1 login -AccessToken "<TOKEN>"`
- Refresh entitlement/profile sync:
  - `.\pg.ps1 update`
- Run local diagnostics for auth/path/tools/profile:
  - `.\pg.ps1 doctor`
- Notes:
  - lifecycle state file: `Memory-bank/_generated/pg-cli-state.json` (gitignored).
  - `login`/`update` sync entitlement snapshot to local dev profile keys (`pg_cli_*`) and derive `pg_cli_recommended_prod_profile`.
  - `update`/`doctor` resolve API base from lifecycle state when `-ApiBase` is omitted.
  - when `pg prod` is run without explicit `-ProdProfile`, router now prefers the lifecycle recommended profile from state.

### Local dev profile (project root, dev/test only)
- Purpose:
  - keep local runtime/tool/credential hints for agent-assisted development.
  - reduce retry loops when DB/tool credentials are missing during local testing.
- Security boundary:
  - file is local-only: `.narrate/dev-profile.local.json` (gitignored).
  - use for development/test credentials only.
  - production credentials remain `.env`/vault-managed and are still enforced by production gates.
- Commands:
  - initialize:
    - `.\pg.ps1 dev-profile -DevProfileAction init`
  - check required fields + gitignore policy:
    - `.\pg.ps1 dev-profile -DevProfileAction check`
  - set non-secret value:
    - `.\pg.ps1 dev-profile -DevProfileAction set -ProfileKey db_host -ProfileValue 127.0.0.1`
  - set secret with secure prompt input:
    - `.\pg.ps1 dev-profile -DevProfileAction set -ProfileKey db_password -Secret -Prompt`
  - read value:
    - `.\pg.ps1 dev-profile -DevProfileAction get -ProfileKey db_host`
  - list all keys (secrets masked):
    - `.\pg.ps1 dev-profile -DevProfileAction list`
  - list with revealed secrets (local machine only):
    - `.\pg.ps1 dev-profile -DevProfileAction list -Reveal`
  - remove key:
    - `.\pg.ps1 dev-profile -DevProfileAction remove -ProfileKey db_password`

### Governance decision bridge (project root)
- Login state bootstrap (use existing bearer token):
  - `.\pg.ps1 governance-login -ApiBase http://127.0.0.1:8787 -AccessToken "<TOKEN>"`
- Login via email OTP (when enabled in runtime):
  - `.\pg.ps1 governance-login -ApiBase http://127.0.0.1:8787 -Email "user@company.com"`
- Run worker once:
  - `.\pg.ps1 governance-worker -Once`
- Run worker continuously:
  - `.\pg.ps1 governance-worker -PollSeconds 15 -ApproveCommand "& '.\scripts\governance_action_handler.ps1'" -NeedsChangeCommand "& '.\scripts\governance_action_handler.ps1'" -RejectCommand "& '.\scripts\governance_action_handler.ps1'"`
- Dry run mode (no command execution; still validates pull/flow):
  - `.\pg.ps1 governance-worker -Once -DryRun`
- Bind a thread to an allowlisted local action key:
  - `.\pg.ps1 governance-bind -ThreadId "6c920350-9b8c-4067-a0f0-92c8a9b9b42a" -ActionKey default-handler`
  - `.\pg.ps1 governance-bind -ThreadId "6c920350-9b8c-4067-a0f0-92c8a9b9b42a" -ActionKey prod-check-on-approve`
  - `.\pg.ps1 governance-bind -List`
  - `.\pg.ps1 governance-bind -ThreadId "6c920350-9b8c-4067-a0f0-92c8a9b9b42a" -Remove`
- Optional playbook override path:
  - `.\pg.ps1 governance-bind -PlaybookPath .\scripts\governance_action_playbook.json -List`
  - `.\pg.ps1 governance-worker -PlaybookPath .\scripts\governance_action_playbook.json -Once`
- Worker state file:
  - `Memory-bank/_generated/governance-agent-state.json`
- Worker local queue/log outputs:
  - `Memory-bank/_generated/governance-worker-execution.log`
  - `Memory-bank/_generated/governance-agent-queue.jsonl`
- Worker defaults:
  - If explicit `Approve/NeedsChange/Reject` commands are not provided, worker resolves by this order:
    1. thread binding (`thread_id -> action_key`) using playbook
    2. state/global decision command overrides
    3. `default_action_key` from state (if configured)
    4. fallback to `scripts/governance_action_handler.ps1`.
- Worker execution context env vars (available to mapped command):
  - `PG_GOV_EVENT_ID`
  - `PG_GOV_THREAD_ID`
  - `PG_GOV_DECISION`
  - `PG_GOV_WINNING_OPTION_KEY`
  - `PG_GOV_SUMMARY`
  - `PG_GOV_EVENT_JSON`

### Slack transport closure check (project root)
- One command PASS/FAIL matrix for 10F validation:
  - `.\pg.ps1 slack-check -ApiBase http://127.0.0.1:8787 -PublicBaseUrl https://pg-ext.addresly.com`
- What it checks:
  - local `/health`
  - local `/integrations/slack/health`
  - public `/health`
  - public `/integrations/slack/health`
  - auth token from governance state file
  - governance thread create -> vote -> decide
  - local worker apply
  - sync ack status (`applied`)
- Useful flags:
  - `-SkipPublicChecks` (when tunnel/domain is down but local checks are needed)
  - `-SkipWorker` (transport-only, no local execution)
  - `-Json` (machine-readable output)
- Runtime note:
  - thread create can take ~45-60s on loaded environments; script POST timeout is set to 90s to avoid false transport failures.
- Report output:
  - `Memory-bank/_generated/slack-transport-check-latest.md`

### Narrate flow closure check (project root)
- One command PASS/FAIL matrix for Milestone 10G baseline:
  - `.\pg.ps1 narrate-check`
- What it checks:
  - required Narrate command IDs in `extension/package.json`
  - command/runtime registration in `extension/src/extension.ts`
  - core source files for reading/toggle/export/report flow
  - extension compile (`npm run compile`)
- Useful flags:
  - `-SkipCompile` (quick structural check only)
  - `-Json` (machine-readable output)
- Report output:
  - `Memory-bank/_generated/narrate-flow-check-latest.md`

### Combined milestone closure check (project root)
- One command to run both 10F + 10G checks:
  - `.\pg.ps1 closure-check -ApiBase http://127.0.0.1:8787 -PublicBaseUrl https://pg-ext.addresly.com`
  - `.\pg.ps1 closure-check -ClosureMode local-core -ApiBase http://127.0.0.1:8787 -PublicBaseUrl https://pg-ext.addresly.com`
- What it checks:
  - runs `pg slack-check` (Slack transport + governance decision apply/ack)
  - runs `pg narrate-check` (Narrate flow wiring + compile)
  - writes one combined summary report with both command exit codes and PASS/FAIL counts.
- Closure modes:
  - `strict` (default): requires both subcommands to exit with zero.
  - `local-core`: allows public tunnel failures and account-summary flakiness, but still requires core local governance flow steps to pass (`thread`, `vote`, `decide`, `bind`, `worker`, `ack`).
- Useful flags:
  - `-ClosureMode strict|local-core`
  - `-SkipPublicChecks` (ignore tunnel/public endpoint checks)
  - `-SkipWorker` (transport-only; skip local apply/ack step)
  - `-SkipCompile` (quick Narrate structural check only)
  - `-Json` (machine-readable output)
- Report output:
  - `Memory-bank/_generated/milestone-closure-check-latest.md`

### Dependency verification bridge (project root)
- Verify dependencies from a package manifest against server-side policy:
  - `.\pg.ps1 dependency-verify -ApiBase http://127.0.0.1:8787 -AccessToken "<TOKEN>" -ManifestPath .\server\package.json`
  - `.\pg.ps1 dependency-verify` (default scans all local service manifests: `extension/package.json`, `server/package.json`, plus other top-level service folders that contain `package.json`)
- Optional flags:
  - `-DependenciesOnly` (exclude `devDependencies`)
  - `-ProjectFramework nextjs|nestjs|react|unknown`
  - `-NodeVersion 20.20.0`
  - `-SkipRegistryFetch` (for offline/debug only; not for strict prod gate)
- Notes:
  - dependency payload now includes local `npm audit --json --package-lock-only` severity metadata per package when lockfiles are present.
  - high/critical vulnerability severity in dependency scanner input is treated as blocker by server policy (`DEP-SEC-001`).
  - stale `@types/*` packages are now warning-only (`DEP-MAINT-003`) to reduce false hard blocks while keeping vulnerability severity gates strict.
  - npm registry metadata lookup now uses bounded retry/backoff for transient failures (`408/425/429/500/502/503/504`, abort/timeout/network errors) to reduce false `DEP-REGISTRY-001` blocks in strict self-check.
  - freshness/maintenance warnings now trigger backend dependency review via `/account/policy/dependency/review`, returning review action/status and official source links that are persisted into `self-check-latest.json`.

### Coding verification notes
- Server coding verification now also checks:
  - hardcoded secret-like literals and private-key blocks in source code (`COD-SEC-*`)
  - NestJS module metadata complexity and placeholder-like module names (`COD-NEST-*`)
- Review-only policy remains separate from hard automation:
  - "reuse existing logic before adding another same-purpose block" is documented policy, but not currently a deterministic automated check

### Scheduled dependency drift check (CI)
- Workflow:
  - `.github/workflows/dependency-drift-weekly.yml`
- Schedule:
  - weekly on Mondays (`08:00 UTC`) and manual `workflow_dispatch`.
- What it runs:
  - per service (`extension`, `server`): `npm ci`, `npm audit --audit-level=high --omit=optional` (fails job on high/critical findings),
  - `npm outdated --json` report output for upgrade planning,
  - optional policy-level dependency verification job when repo secrets `PG_API_BASE` and `PG_ACCESS_TOKEN` are configured.

### Coding standards verification bridge (project root)
- Verify source files against server-side coding standards policy:
  - `.\pg.ps1 coding-verify -ApiBase http://127.0.0.1:8787 -AccessToken "<TOKEN>" -ScanPath .\server\src,.\extension\src`
- Optional flags:
  - `-ProjectFramework nextjs|nestjs|spring|react|unknown`
  - `-MaxFiles 400`
  - `-SkipFunctionChecks` (debug only; not for strict prod gate)
- Notes:
  - default scan roots include `server/src`, `server/prisma`, and `extension/src`.
  - query-optimization policy checks now include N+1 loop patterns, `SELECT *`, deep `OFFSET`, non-SARGable `WHERE` signals, `HAVING` misuse signals, and Prisma FK-index enforcement.

### API contract verification bridge (project root)
- Verify frontend/backend API contract alignment against server-side policy evaluator:
  - `.\pg.ps1 api-contract-verify -ApiBase http://127.0.0.1:8787 -AccessToken "<TOKEN>" -ScanPath .\server\src,.\extension\src`
- Optional flags:
  - `-MaxFiles 1200`
  - `-ScanPath .\server\src,.\extension\src`
- Notes:
  - evaluator uses OpenAPI-first parsing (JSON + YAML with local `$ref` schema support), then backend route inference fallback.
  - mismatches include blocker/warning rule IDs and unmatched frontend-call warnings.

### MCP cloud scoring bridge (project root)
- Run local policy scanners and submit metadata-only cloud architecture evidence for server-side scoring:
  - `.\pg.ps1 mcp-cloud-score -ApiBase http://127.0.0.1:8787 -WorkloadSensitivity regulated`
  - `.\pg.ps1 cloud-score -WorkloadSensitivity regulated` (short alias)
- Typical regulated command with explicit security control evidence:
  - `.\pg.ps1 mcp-cloud-score -WorkloadSensitivity regulated -ControlCloudflareTunnel pass -ControlCloudflareFullStrictTls pass -ControlEc2PrivateSubnetOnly pass -ControlDbPublicAccessDisabled pass -ControlWireguardDbTunnel pass -ControlSecretsManager pass -ControlIamRoleNoAccessKeys pass -ControlCloudTrailMultiRegion pass -ControlBackupRestoreTested30d pass`
- Optional cloud-control flags (all support `unknown|pass|fail`):
  - `-ControlImdsV2Enforced`
  - `-ControlSshPortClosedPublic`
  - `-ControlDbPortNotPublic`
  - `-ControlWafManagedRulesEnabled`
  - `-ControlAuthRateLimitsEnabled`
  - `-ControlCiSecretScanningEnabled`
  - `-ControlWireguardAlertEnabled`
  - `-ControlCloudTrailRootLoginAlert`
  - `-ControlEc2MultiAz`
- Provider/cost context flags:
  - `-ProviderCloudflare on|off|unknown`
  - `-ProviderAws on|off|unknown`
  - `-ProviderHetzner on|off|unknown`
  - `-ProviderCloudfront on|off|unknown`
  - `-ProviderAwsShieldAdvanced on|off|unknown`
  - `-MonthlyBudgetUsd 300`
- Notes:
  - scanner payload is metadata-only (counts/rule IDs/status), not full source upload to MCP scorer.
  - scoring endpoint: `POST /account/policy/mcp/cloud-score`.
  - regulated profile enforces stricter cloud architecture controls and provider requirements.

### Observability adapter health bridge (project root)
- Run self-hosted observability readiness check (`none|otlp|sentry|signoz`) via authenticated server policy route:
  - `.\pg.ps1 observability-check`
  - `.\pg.ps1 obs-check` (short alias)
- Typical PG-hosted managed profile command:
  - `.\pg.ps1 observability-check -ObservabilityDeploymentProfile pg-hosted -ObservabilityOtlpEnabled on -ObservabilityOtlpEndpoint https://otel.yourdomain.com/v1/traces -ObservabilityOtlpHostedBy pg -ObservabilityOtlpToken present`
- Typical enterprise BYOC/on-prem command:
  - `.\pg.ps1 observability-check -ObservabilityDeploymentProfile customer-hosted -ObservabilitySignozEnabled on -ObservabilitySignozHostedBy customer -ObservabilitySignozEndpoint https://signoz.customer.local -ObservabilitySignozToken present`
- Optional flags:
  - `-ObservabilityDeploymentProfile auto|pg-hosted|customer-hosted|hybrid`
  - `-ObservabilityOtlpEnabled auto|on|off`
  - `-ObservabilityOtlpHostedBy auto|pg|customer|unknown`
  - `-ObservabilityOtlpToken auto|present|missing`
  - `-ObservabilitySentryEnabled auto|on|off`
  - `-ObservabilitySentryHostedBy auto|pg|customer|unknown`
  - `-ObservabilitySentryToken auto|present|missing`
  - `-ObservabilitySignozEnabled auto|on|off`
  - `-ObservabilitySignozHostedBy auto|pg|customer|unknown`
  - `-ObservabilitySignozToken auto|present|missing`
  - `-Json` for machine-readable output
- Notes:
  - default product posture remains PG-hosted for easier onboarding.
  - enterprise customers can use customer-hosted/BYOC mode without vendor lock-in.
  - endpoint returns deterministic blocker/warning findings: `POST /account/policy/observability/check`.

### DB index maintenance verification bridge (project root)
- Run PostgreSQL maintenance diagnostics gate:
  - `.\pg.ps1 db-index-check`
  - `.\pg.ps1 db-check` (short alias)
- Optional flags:
  - `-DatabaseUrl "postgresql://..."`
- Typical remediation flow:
  - `.\pg.ps1 db-index-check`
  - `.\pg.ps1 db-index-fix-plan -DbMaxRows 5 -DbPlanOutputPath .\Memory-bank\_generated\db-index-fix-plan-next5.md`
  - run SQL from generated plan in PostgreSQL (psql/Prisma/pgAdmin)
  - `.\pg.ps1 db-index-check`
- Checks:
  - invalid indexes (`DBM-IND-001`, blocker)
  - `pg_stat_statements` extension presence (`DBM-EXT-001`, blocker)
  - high sequential scan pressure (`DBM-SCAN-001`, warning)
  - unused non-primary, non-unique indexes (`DBM-IND-002`, warning)
  - vacuum/analyze lag signals (`DBM-MAINT-001`, warning)
- Quick remediation hint:
  - when findings exist, `db-index-check` prints `.\pg.ps1 db-index-fix-plan`.
- Troubleshooting:
  - if command-set error shows `install,start,...`, you executed global `pg.ps1`; rerun with local `.\pg.ps1`.
  - if `.\pg.ps1` is not recognized, `cd` into repo root first.
  - if terminal shows `>>`, press `Ctrl+C` once then rerun command.
  - SQL (`SHOW/ALTER/CREATE/DROP`) must run in PostgreSQL, not directly in PowerShell.

### DB index remediation plan bridge (project root)
- Generate exact SQL remediation plan from live DB findings:
  - `.\pg.ps1 db-index-fix-plan`
  - `.\pg.ps1 db-fix` (short alias)
  - `.\pg.ps1 db-index-remediate` (alias)
- Optional flags:
  - `-DatabaseUrl "postgresql://..."`
  - `-DbMaxRows 25`
  - `-DbPlanOutputPath .\Memory-bank\_generated\db-index-fix-plan-latest.md`
- Output:
  - default report path: `Memory-bank/_generated/db-index-fix-plan-latest.md`
- Includes:
  - `pg_stat_statements` enablement SQL checklist
  - safety checklist for unused index removal
  - candidate-specific `DROP INDEX CONCURRENTLY` and rollback `CREATE INDEX CONCURRENTLY` SQL.
- Warning cleanup workflow (`DBM-IND-002`):
  - generate plan with smaller batch:
    - `.\pg.ps1 db-index-fix-plan -DbMaxRows 5 -DbPlanOutputPath .\Memory-bank\_generated\db-index-fix-plan-next5.md`
  - for each candidate:
    - run `Guard check` SQL first,
    - drop only when `idx_scan` stays zero in real traffic windows,
    - rerun `.\pg.ps1 db-index-check` after each small batch.

### Playwright UI smoke bridge (project root)
- Run Playwright smoke checks for UI/runtime behavior:
  - `.\pg.ps1 playwright-smoke-check`
  - `.\pg.ps1 ui-smoke-check`
- Optional flags:
  - `-PlaywrightWorkingDirectory .\server` (or any repo-relative path with Playwright config/tests)
  - `-PlaywrightConfigPath .\playwright.config.ts`
  - `-PlaywrightBrowserMatrix minimal|desktop|full`
  - `-InstallPlaywrightBrowsers`
- Behavior:
  - fails closed when Playwright config/dependency/tests are missing.
  - if `@smoke` tag exists in tests, runs only smoke-tagged tests; otherwise runs full Playwright suite.
  - writes HTML report, JSON report, and Playwright failure artifacts under `Memory-bank/_generated/playwright-smoke/`.

### Enforcement trigger bridge (project root)
- Run trigger phase manually:
  - `.\pg.ps1 enforce-trigger -Phase start-session -ApiBase http://127.0.0.1:8787`
  - `.\pg.ps1 enforce-trigger -Phase post-write -ChangedPath .\server\src\index.ts`
  - `.\pg.ps1 enforce-trigger -Phase pre-push -ProjectFramework nestjs`
- Optional flags:
  - `-WarnOnly` (non-blocking mode for setup/debug)
  - `-ScanPath .\server\src,.\extension\src`
  - `-ChangedPath <file1,file2,...>`
  - `-EnableDbIndexMaintenanceCheck` (runs DB maintenance diagnostics as part of trigger)
  - `-DatabaseUrl "postgresql://..."` (override connection for DB maintenance diagnostics)

### As-you-go self-check bridge (project root, agent-first)
- Run proactive verification while implementing changes:
  - `.\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck -PlaywrightBrowserMatrix desktop`
  - `.\pg.ps1 as-you-go-check -WarnOnly -EnableDbIndexMaintenanceCheck -PlaywrightBrowserMatrix desktop` (alias)
- Web/UI tasks:
  - Playwright smoke is already mandatory inside `self-check`; no extra gate flag is required.
- Strict completion check (before declaring task done):
  - `.\pg.ps1 self-check -EnableDbIndexMaintenanceCheck -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers`
- Behavior:
  - runs post-write enforcement trigger against changed files,
  - runs DB index maintenance diagnostics (JSON mode),
  - auto-generates DB fix plan when DB findings exist (unless `-SkipAutoDbFixPlan` is used),
  - always runs Playwright smoke checks and now persists the latest report/artifact paths into `Memory-bank/_generated/self-check-latest.json`.
  - local dependency/coding/trust routes still resolve to `http://127.0.0.1:8787` by default; if logs show `127.0.0.1:8787` connection refusal, start the local backend before chasing Playwright or Cloudflare issues.
- Hard enforcement before final Memory-bank update/commit:
  - latest `Memory-bank/_generated/self-check-latest.json` must be `PASS`,
  - warn-only runs are rejected for final commit,
  - latest strict self-check must include the mandatory Playwright stage.
- Optional flags:
  - `-ChangedPath <file1,file2,...>` (override changed-file detection)
  - `-ScanPath <path1,path2,...>`
  - `-DbMaxRows 5`
  - `-DbPlanOutputPath .\Memory-bank\_generated\db-index-fix-plan-next5.md`
  - `-SkipAutoDbFixPlan`

### Production baseline gate (project root)
- Run strict production preflight dependency + coding gate:
  - `.\pg.ps1 prod -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json`
  - `.\pg.ps1 prod -ProdProfile standard -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json`
  - `.\pg.ps1 prod -ProdProfile strict -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json`
  - `.\pg.ps1 prod -ProdProfile legacy -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json`
- Token resolution order:
  - `-AccessToken` argument
  - `PG_ACCESS_TOKEN` environment variable
  - `Memory-bank/_generated/governance-agent-state.json` (`access_token`)
- Prod profile behavior:
  - `legacy`: dependency + coding + Playwright smoke
  - `standard` (default): legacy + API contract + DB index maintenance
  - `strict`: standard + future strict-only overlays
  - if `-ProdProfile` is omitted and lifecycle state exists, `pg prod` auto-uses entitlement-synced `recommended_prod_profile` from `pg-cli-state.json`.
- Optional flags:
  - `-IncludeDevDependencies` (default checks only runtime dependencies)
  - `-ProjectFramework nextjs|nestjs|react|unknown`
  - `-NodeVersion 20.20.0`
  - `-ScanPath .\server\src,.\extension\src`
  - `-MaxFiles 400`
  - `-ProdProfile legacy|standard|strict`
  - `-SkipFunctionChecks` (debug only; not for strict prod gate)
  - `-EnableApiContractCheck` (forces API contract gate on regardless of selected profile)
  - `-EnableDbIndexMaintenanceCheck` (forces DB index maintenance gate on regardless of selected profile)
  - `-DatabaseUrl` (optional DB connection override for DB maintenance gate)
  - `-EnablePlaywrightSmokeCheck` (forces Playwright smoke gate on regardless of selected profile)
  - `-PlaywrightWorkingDirectory` (path passed to Playwright smoke checker when prod gate is enabled)
  - `-PlaywrightConfigPath` (explicit Playwright config path passed to smoke checker)

### Cloudflare tunnel (project root)
- Install cloudflared:
  - `winget install -e --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements`
- Usage boundary:
  - Cloudflare tunnel exposes the already-running local backend for public URL checks (`/`, `/pricing`, OAuth callbacks, webhook/browser access).
  - It does not replace the local `127.0.0.1:8787` origin that `pg start`, dependency verification, and self-check enforcement call directly.
- Quick temporary demo URL:
  - `powershell -ExecutionPolicy Bypass -File scripts/setup_cloudflare_tunnel.ps1 -Mode quick -OriginUrl http://127.0.0.1:8787`
- Named domain tunnel:
  - `powershell -ExecutionPolicy Bypass -File scripts/setup_cloudflare_tunnel.ps1 -Mode named -TunnelName pg-ext-narrate -Hostname pg-ext.addresly.com -OriginUrl http://127.0.0.1:8787`

### Narrate extension (from `extension/`)
- Install dependencies:
  - `npm install`
- Compile:
  - `npm run compile`
- Watch:
  - `npm run watch`

### Local VSIX install (normal VS Code profile)
- One-command compile + package + install (recommended):
  - `powershell -ExecutionPolicy Bypass -File .\scripts\local_extension_install.ps1`
- Optional script flags:
  - `-SkipCompile`
  - `-SkipPackage`
  - `-SkipInstall`
  - `-NoForce`
  - `-ExtensionDir <path>`
- VS Code task buttons (Run Task):
  - `compile-extension`
  - `package-extension-vsix`
  - `local-install-extension-vsix`
- Verify installed extension:
  - `code --list-extensions | findstr narrate`
  - expected: `figchamdemb.narrate-vscode-extension`
- Full local install + UI verification guide:
  - `docs/LOCAL_VSIX_INSTALL_AND_UI_TEST.md`

### Licensing backend (from `server/`)
- Install dependencies:
  - `npm install`
- Build:
  - `npm run build`
- Dev server (watch):
  - `npm run dev`
- Start compiled server:
  - `npm run start`
- Web smoke test (starts server on temp port and validates landing/css/js + web pages):
  - `npm run smoke:web`
- Prisma client generation:
  - `npm run prisma:generate`
- Push Prisma schema to DB:
  - `npm run prisma:dbpush`
- Prisma studio (optional):
  - `npm run prisma:studio`
- Open hosted landing page:
  - `http://127.0.0.1:8787/`
- Open pricing matrix page:
  - `http://127.0.0.1:8787/pricing`
- Open tier command help page:
  - `http://127.0.0.1:8787/help`
- Open secure portal app:
  - `http://127.0.0.1:8787/app`

### Local extension host testing
- Option A (preferred): open project root and run `Run -> Start Debugging`.
- Choose `Run Narrate Extension (root workspace)` from `.vscode/launch.json`.
- Option B: open `extension/` directly and run `Run Narrate Extension`.
- If commands show `...not found` in Extension Development Host, restart using root workspace debug profile and rerun `Narrate: Run Command Diagnostics`.

### Local VSIX install into normal VS Code
- One-command reinstall:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\local_extension_install.ps1`
- What it does:
  - compile extension
  - package VSIX
  - install into the normal VS Code profile with `--force`
- Windows note:
  - the installer now prefers the VS Code CLI shim (`code.cmd`) instead of `Code.exe`
  - if you previously saw `Code.exe: bad option: --install-extension`, rerun the updated installer script
- Fast verification:
  - `C:\Users\ebrim\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd --list-extensions | findstr narrate`
  - then run `Developer: Reload Window` in normal VS Code so the Extensions pane refreshes the newly installed local VSIX

### Scalability architecture intake (policy workflow)
- Policy source:
  - `.verificaton-before-production-folder/SCALABILITY_ARCHITECTURE_GUIDE.md`
- Use this intake before implementing features that include:
  - real-time updates/notifications
  - async/background jobs
  - service-to-service messaging
  - distributed/shared runtime state
- Required workflow:
  1. ask the discovery questions
  2. evaluate options with scale rationale
  3. explicitly reject non-scalable anti-patterns
  4. get user confirmation before implementation

### Key extension commands (Command Palette)
- `Narrate: Toggle Reading Mode (Dev)`
- `Narrate: Toggle Reading Mode (Edu)`
- `Narrate: Switch Narration Mode`
- `Narrate: Set Mode (Dev)`
- `Narrate: Set Mode (Edu)`
- `Narrate: Switch Reading View Mode` (`exact` <-> `section`)
- `Narrate: Switch Reading Pane Mode` (`sideBySide` <-> `fullPage`)
- `Narrate: Toggle Source Snippet (Code/Meaning)` (`withSource` <-> `narrationOnly`)
- `Narrate: Toggle EDU Detail Level (Standard/Beginner/Full Beginner)` (cycles 3 levels)
- `Narrate: Refresh Reading View`
- `Narrate: Request Change Prompt`
- `Narrate: Export Narration (Current File)` (Pro+ gate)
- `Narrate: Export Narration (Workspace)` (Pro+ gate)
- `Narrate: Generate Change Report (Git Diff...)` (Pro+ gate)
- `Narrate: PG Push (Git Add/Commit/Push)` (runs `enforce-trigger -Phase pre-push` plus optional Trust/Dead-Code/Commit-Quality gates before git push)
- `Narrate: PG Git Push` (alias for PG Push)
- `Narrate: Governance Sync Now` (manual one-shot pull/apply/ack for governance decisions)
- `Narrate: Sign In (Email)`
- `Narrate: Sign In (GitHub)`
- `Narrate: Redeem Code`
- `Narrate: Start Trial (48h)`
- `Narrate: Upgrade Plan (Checkout)`
- `Narrate: Refresh License`
- `Narrate: License Status`
- `Narrate: Activate Current Project Quota`
- `Narrate: Show Project Quota`
- `Narrate: Manage Devices`
- `Narrate: Open Command Help` (opens/focuses the `Narrate Help` sidebar with command runbook + troubleshooting)
- `Narrate: Open Model Settings` (one-click jump to VS Code Settings filtered to `narrate.model.*`)
- `Narrate: Run Startup For Current Context` (re-runs nearest-context startup when auto-run failed or when you want to force a fresh startup check in the current repo/subrepo)
- `Narrate: Open Toggle Control Panel` (opens/focuses the color-button non-technical toggle panel in the same `Narrate Help` sidebar)
- `Narrate: Run Command Diagnostics` (runs local health + Slack health + dev-profile + governance worker + Narrate baseline checks, then auto-saves `Memory-bank/_generated/command-diagnostics-latest.md` and `.json` plus timestamped snapshots; completion toast includes quick actions to open/copy paths)
- `Narrate: Generate Codebase Tour` (scans workspace architecture and opens onboarding report with entrypoints, route/controller surface, dependency hotspots, and coupling hotspots)
- `Narrate: Run Dead Code Scan` (opens confidence-tiered dead-code candidate report; high confidence from TS unused diagnostics, medium/low from import-graph orphan detection)
- `Narrate: Create Dead Code Cleanup Branch` (creates/switches to dedicated cleanup branch, runs dead-code scan, and opens report)
- `Narrate: Apply Safe Dead Code Fixes` (runs organize-imports across high-confidence dead-code files and opens before/after scan report)
- `Narrate: Run Environment Doctor` (scans workspace env usage, compares `.env` and `.env.example`, and opens a missing/unused/exposed report)
- `Narrate: Run API Contract Validator` (runs OpenAPI-first request/response contract checks with JSON+YAML support and local schema `$ref` resolution, then falls back to backend inference when spec contracts are unavailable; frontend extraction includes axios wrapper clients and `.request({...})` calls)
- `Narrate: OpenAPI Check` (short alias command for fast API contract validation run)
- `Narrate: OpenAPI Fix Handoff Prompt` (runs validator and copies an LLM-ready mismatch-fix prompt to clipboard)
- `Narrate: Environment Doctor Quick Fix (.env.example)` (runs doctor and appends missing referenced keys into `.env.example` placeholders)
- `Narrate: Show Trust Score Report` (opens latest server-backed trust findings with rule IDs, blockers, warnings, score, and grade)
- `Narrate: Open Trust Score Panel` (focuses sidebar panel with summary badge + findings)
- `Narrate: Toggle Trust Score` (enable/disable trust scoring from UI)
- `Narrate: Refresh Trust Score` (manual backend trust evaluation run for current active file plus local diagnostics)
- `Narrate: Run Trust Score Workspace Scan` (runs aggregate trust scan across workspace source files and opens markdown summary report)
- `Narrate: Restart TypeScript + Refresh Trust Score` (save all + restart TS server + trust refresh when Problems tab is stale)
- `Narrate: Setup Validation Library` (install latest validation package into the nearest active project root with Zod recommended default, then refresh trust)
- `Narrate: Request Change Prompt` (now includes latest dependency/coding enforcement warnings from `self-check-latest.json`, plus dependency review action/status and official source URLs when server-backed review results exist)

### Reading-view defaults (settings)
- Fast open command:
  - `Narrate: Open Model Settings`
- `narrate.model.baseUrl` (OpenAI-compatible endpoint; supports provider URLs like OpenAI/Ollama/OpenRouter)
- `narrate.model.modelId` (provider model name/id)
- `narrate.model.apiKey` (provider key; optional for local fallback paths)
- `narrate.model.timeoutMs` (provider request timeout)
- Provider proof test (Ollama example):
  - run `ollama serve`,
  - set `narrate.model.baseUrl = http://127.0.0.1:11434/v1`,
  - set `narrate.model.modelId = llama3.1`,
  - open any code file and run `Narrate: Toggle Reading Mode (Dev)`.
- `narrate.reading.defaultViewMode`: `exact | section` (default `exact`)
- `narrate.reading.defaultPaneMode`: `sideBySide | fullPage` (default `sideBySide`)
- `narrate.reading.showStatusBarControls`: `true | false` (default `true`)
- `narrate.trustScore.enabled`: `true | false` (default `true`)
- `narrate.trustScore.showStatusBar`: `true | false` (default `true`)
- `narrate.trustScore.autoRefreshOnSave`: `true | false` (default `true`; when `false`, use `Narrate: Refresh Trust Score`)
- `narrate.trustScore.validationLibraryPolicy`: `off | warn | required` (default `warn`; metadata sent with Trust requests for controller/route files)
- `narrate.trustScore.pgPushGateMode`: `off | relaxed | strict` (default `off`; strict blocks push on trust blockers/red status, relaxed warns and allows manual continue)
- `narrate.trustScore.workspaceScanMaxFiles`: integer (default `250`)
- `narrate.trustScore.workspaceScanIncludeGlob`: glob (default `**/*.{ts,tsx,js,jsx,py,java,go,rs,cs,php,rb}`)
- `narrate.trustScore.workspaceScanExcludeGlob`: glob (default excludes build/vendor folders)
- `narrate.deadCodeScan.maxFiles`: integer (default `600`)
- `narrate.deadCodeScan.includeGlob`: glob (default `**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}`)
- `narrate.deadCodeScan.excludeGlob`: glob (default excludes build/vendor/memory-bank folders)
- `narrate.deadCodeScan.pgPushGateMode`: `off | relaxed | strict` (default `off`; strict blocks PG push on high-confidence unused findings)
- `narrate.apiContract.maxFiles`: integer (default `1200`)
- `narrate.apiContract.includeGlob`: glob (default includes TS/JS plus JSON/YAML specs for contract discovery)
- `narrate.apiContract.excludeGlob`: glob (default excludes build/vendor/memory-bank folders)
- `narrate.codebaseTour.maxFiles`: integer (default `1500`)
- `narrate.codebaseTour.includeGlob`: glob (default includes source/config file extensions for architecture scan)
- `narrate.codebaseTour.excludeGlob`: glob (default excludes build/vendor/memory-bank folders)
- Dead-code PG push prompt actions:
  - `Apply Safe Fixes + Recheck` (runs imports-only safe autofix command, then rescans)
  - `Open Dead Code Report`
  - `Continue Push` (relaxed mode only) / block in strict mode until resolved
- Repo profile note:
  - this repository currently sets `.vscode/settings.json` to `narrate.deadCodeScan.pgPushGateMode = strict`.
  - fallback remains available by switching setting to `relaxed` for legacy cleanup windows.
- Dead code scan interpretation note:
  - `High` confidence candidates come from explicit TypeScript unused diagnostics.
  - `Medium/Low` confidence candidates come from static import-graph heuristics and require manual review.
- Trust validation rule note:
  - Trust/coding gates now include missing input-validation detection for controller/route input surfaces.
  - Validation signal is Zod-or-equivalent (for example: `zod`, `safeParse`, `ValidationPipe`, `Joi`, `yup`, `valibot`).

### Planned governance command aliases (Milestone 9+)
- `PG EOD` / `PG EndOfDay`
- `PG Mastermind` / `PG MM`
- `PG Decision`
- `PG Plan` (opens mastermind/planning thread context for multi-agent debate)
- Slack slash command grammar:
  - `summary`
  - `eod <title> :: <summary>`
  - `thread <title> :: <question> :: <option1|option2|...>`
  - `vote <thread_id> <option_key> [rationale]` (team vote step; use `opt1/opt2/...` returned by thread create)
  - `decide <thread_id> <approve|reject|needs_change> [option_key] [note]` (owner/manager final step)
  - Input must start directly with `/pg ...` in Slack composer (no prefixed numbering text like `1. /pg ...`).
- Slack role visibility checks:
  - `summary` now returns team memberships as `TEAM_KEY (role)`.
  - `Refresh Thread` card context now prints scope and your effective access label (e.g., `manager (can vote + finalize)`).

### Backend mode settings
- `narrate.licensing.mode = backend`
- `narrate.licensing.apiBaseUrl = http://127.0.0.1:8787`
- `narrate.licensing.publicKeyPem = <optional pinned key>`
- `narrate.licensing.autoRefreshOnStartup = true|false`
- `narrate.governance.autoSync.enabled = true|false`
- `narrate.governance.autoSync.intervalSeconds = <seconds>`
- `narrate.governance.autoSync.requireBackendMode = true|false`
- `narrate.governance.autoSync.dryRun = true|false`
- `narrate.governance.autoSync.showNotifications = true|false`
- `narrate.governance.stateFile = <optional path to worker state file>`

### Placeholder mode settings
- `narrate.licensing.mode = placeholder`
- `narrate.licensing.placeholderPlan = free|trial|pro|team|enterprise`

### Backend environment (checkout/OAuth)
- `.env` is auto-loaded by server startup (`dotenv/config`).
- `PUBLIC_BASE_URL` (default `http://127.0.0.1:8787`)
- `DATABASE_URL` (Postgres URL, recommended with `?schema=narate_enterprise`)
- `STORE_BACKEND` (`json|prisma`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MAP` (JSON map: `plan:module -> price_id`)
- `CHECKOUT_SUCCESS_URL`
- `CHECKOUT_CANCEL_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `OAUTH_CALLBACK_ORIGINS` (comma-separated trusted origins for web callback URLs)
- `ADMIN_KEY`
- `ADMIN_ROUTE_PREFIX` (default `/pg-global-admin`)
- `ADMIN_AUTH_MODE` (`db|hybrid|key`)
- `ADMIN_RBAC_BOOTSTRAP` (`true|false`)
- `ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS` (comma-separated bootstrap list for DB admin accounts)
- `SUPER_ADMIN_EMAILS` (comma-separated emails allowed to access `/pg-global-admin/board/*` routes through normal auth)
- `SUPER_ADMIN_SOURCE` (`db|env|hybrid`)
- `ENABLE_EMAIL_OTP` (`true|false`)
- `EXPOSE_DEV_OTP_CODE` (`true|false`)
- `SESSION_COOKIE_NAME`
- `SESSION_COOKIE_SECURE`
- `SESSION_COOKIE_SAMESITE`
- `AUTH_START_RATE_LIMIT_MAX`
- `AUTH_START_RATE_LIMIT_WINDOW`
- `AUTH_VERIFY_RATE_LIMIT_MAX`
- `AUTH_VERIFY_RATE_LIMIT_WINDOW`
- `CLOUDFLARE_ACCESS_ENABLED` (`true|false`)
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN` (e.g. `your-team.cloudflareaccess.com`)
- `CLOUDFLARE_ACCESS_AUD`
- `CLOUDFLARE_ACCESS_JWKS_TTL_SECONDS`
- `GOVERNANCE_ALLOW_PRO`
- `GOVERNANCE_DEFAULT_RETENTION_DAYS`
- `GOVERNANCE_DEFAULT_MAX_DEBATE_CHARS`
- `GOVERNANCE_SLACK_ADDON_SEAT_PRICE_CENTS`
- `SLACK_COMMANDS_ENABLED` (`true|false`)
- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`
- `SLACK_WEBHOOK_URL` (optional fallback dispatch)
- `SLACK_ALLOWED_TEAM_IDS` (comma-separated)
- `SLACK_ALLOWED_EMAILS` (comma-separated)
- `SLACK_REQUEST_MAX_AGE_SECONDS`

### Local admin portal test flow
- Local origin health:
  - `http://127.0.0.1:8787/health`
- Local portal:
  - `http://127.0.0.1:8787/app`
- Easier local-only email sign-in:
  - set `ENABLE_EMAIL_OTP="true"` in `server/.env`
  - keep `.env.example` production-safe with both flags `false`
  - for repeated local portal/extension retries, keep the local verify limiter loose enough to avoid five-hour lockouts during debugging:
    - `AUTH_VERIFY_RATE_LIMIT_MAX="50"`
    - `AUTH_VERIFY_RATE_LIMIT_WINDOW="15 minutes"`
- Super-admin local test path:
  - use the email already present in `SUPER_ADMIN_EMAILS` / `ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS`
  - click `Send Email Code` in `/app` or call `POST /auth/email/start`
  - enter the code in `/app` or the extension email sign-in prompt when using the normal local verification flow
  - optionally set `EXPOSE_DEV_OTP_CODE="true"` in `server/.env` so the returned `dev_code` can be used immediately in the same UI or prompt for local-only testing
- Local GitHub/Google OAuth test path:
  - for local provider sign-in on `127.0.0.1:8787`, keep `PUBLIC_BASE_URL`, `GITHUB_REDIRECT_URI`, `GOOGLE_REDIRECT_URI`, `CHECKOUT_SUCCESS_URL`, and `CHECKOUT_CANCEL_URL` pointed at `http://127.0.0.1:8787` in `server/.env`
  - your GitHub or Google account email can be real; the common failure is redirect/origin mismatch, not the email identity itself
  - the extension GitHub flow uses a trusted loopback `callback_url`, so `OAUTH_CALLBACK_ORIGINS` must continue to allow `http://127.0.0.1:8787` and local loopback callbacks
- Cloudflare tunnel is optional for public-hostname/OAuth/webhook checks only; it is not required for the local `/app` admin test path when `127.0.0.1:8787` is healthy.

### Enterprise offline package API surface
- `POST /account/enterprise/offline-pack/activate`
- `GET /account/enterprise/offline-pack/info`
- `POST /account/enterprise/offline-pack/rotate`
- `POST /pg-global-admin/board/enterprise/offline-pack/issue`
- `POST /pg-global-admin/board/enterprise/offline-pack/revoke`

### Web account/team API surface (auth required)
- `GET /account/summary`
- `GET /account/billing/history`
- `GET /account/support/history`
- `POST /account/support/request`
- `POST /account/feedback`
- `POST /account/team/create`
- `GET /account/team/status`
- `POST /account/team/assign-seat`
- `POST /account/team/revoke-seat`
- `POST /account/team/provider-policy/set`
- `GET /account/governance/settings`
- `POST /account/governance/settings/update`
- `POST /account/governance/eod/report`
- `GET /account/governance/eod/list`
- `POST /account/governance/mastermind/thread/create`
- `GET /account/governance/mastermind/threads`
- `GET /account/governance/mastermind/thread/:thread_id`
- `POST /account/governance/mastermind/entry`
- `POST /account/governance/mastermind/vote`
- `POST /account/governance/mastermind/decide`
- `GET /account/governance/sync/pull`
- `POST /account/governance/sync/ack`
- `POST /account/policy/dependency/verify`
- `POST /account/policy/coding/verify`
- `POST /account/policy/api-contract/verify`
- `POST /account/policy/prompt/guard`
- `POST /account/governance/slack/test`
- `GET /integrations/slack/health`
- `POST /integrations/slack/commands`
- `POST /integrations/slack/actions`

### Super admin / admin board API surface (auth + DB RBAC)
- `GET /pg-global-admin/board/summary`
- `GET /pg-global-admin/board/users`
- `GET /pg-global-admin/board/subscriptions`
- `GET /pg-global-admin/board/payments`
- `GET /pg-global-admin/board/support`
- `GET /pg-global-admin/board/governance`
- `POST /pg-global-admin/board/support/status`
- `POST /pg-global-admin/board/subscription/revoke`
- `POST /pg-global-admin/board/sessions/revoke-user`
- `GET /pg-global-admin/board/payments/stripe-config` (super admin runtime Stripe config read)
- `POST /pg-global-admin/board/payments/stripe-config` (super admin runtime Stripe config write)
- `POST /pg-global-admin/board/payments/stripe-config/test` (super admin Stripe API connectivity test)
- `POST /pg-global-admin/governance/slack-addon/team`
- `POST /pg-global-admin/governance/slack-addon/user`
- `POST /pg-global-admin/affiliate/conversion/confirm`
- `POST /pg-global-admin/affiliate/payout/approve`

### Stripe Runtime Config Operational Notes
- Runtime config persistence file:
  - `.narrate/stripe-runtime.local.json`
  - override path via env: `STRIPE_RUNTIME_CONFIG_PATH`
- Real Stripe test/live keys belong in `server/.env` or your deployment secret manager; keep `server/.env.example` placeholder-only.
- Optional encrypted persistence key:
  - `STRIPE_RUNTIME_VAULT_KEY`
  - when set, super-admin Stripe secret updates persist encrypted at rest in the runtime config file
  - when unset, Stripe secrets stay env/vault-managed only and are not written to disk
- Legacy plaintext runtime files remain readable; resaving after `STRIPE_RUNTIME_VAULT_KEY` is configured migrates them forward into encrypted storage.
- Checkout and webhook routes now read runtime config at request time.
- Quick endpoint existence check (unauth expected `401` if route is mounted):
  - `Invoke-WebRequest http://127.0.0.1:8787/<ADMIN_ROUTE_PREFIX>/board/payments/stripe-config`

### Portal App Runtime Notes
- `/app` portal frontend now uses ES-module script loading:
  - `server/public/app.html` -> `<script type="module" src="/assets/site.js"></script>`
- Portal logic split by concern:
  - `/assets/site.js` (auth, billing, support, shell bindings)
  - `/assets/site.teamGovernanceOps.js` (team + governance actions)
  - `/assets/site.adminOps.js` (admin board + Stripe config actions)
  - `/assets/site.adminPricingCatalogEditor.js` (structured pricing-catalog editor for plan cards, SKU cards, and notes)

### Export/report settings
- `narrate.export.outputDir` (default `.narrate/exports`)
- `narrate.export.includeGlob`
- `narrate.export.excludeGlob`
- `narrate.export.maxFiles` (default `120`)
- `narrate.export.maxCharsPerFile` (default `40000`)
- `narrate.report.outputSubdir` (default `reports`)

### Enforcement settings (extension)
- `narrate.enforcement.projectFramework` (default `unknown`)
- `narrate.startupGuard.enabled` (default `true`)
- `narrate.startupGuard.autoRunOnContextChange` (default `true`)
- `narrate.enforcement.postWrite.enabled` (default `true`)
- `narrate.enforcement.postWrite.warnOnly` (default `true`)
- `narrate.enforcement.postWrite.debounceMs` (default `1200`)
- `narrate.enforcement.postWrite.showNotifications` (default `false`)
- `narrate.enforcement.prePush.enabled` (default `true`)
- `narrate.enforcement.prePush.warnOnly` (default `false`)

## Tooling Inventory
| Capability | Tool | Enabled (Y/N) | Config Path |
|---|---|---|---|
| VS Code extension API | `vscode` | Y | `extension/src/extension.ts` |
| OpenAI-compatible HTTP client | native `fetch` | Y | `extension/src/llm/openAICompatibleProvider.ts` |
| Local line cache | JSON file | Y | `extension/src/cache/jsonCacheProvider.ts` |
| Licensing feature gate engine | extension service | Y | `extension/src/licensing/featureGates.ts` |
| Provider policy enforcement in extension | entitlement policy checks | Y | `extension/src/llm/openAICompatibleProvider.ts` |
| Local licensing backend API | Fastify | Y | `server/src/index.ts` |
| Prisma data model + client | Prisma | Y | `server/prisma/schema.prisma` |
| Checkout/webhook/offline/redeem/affiliate routes | Fastify routes | Y | `server/src/index.ts` |
| Team seat + provider policy admin routes | Fastify routes | Y | `server/src/index.ts` |
| Landing/terms/privacy pages | static assets via Fastify | Y | `server/public/*`, `server/src/index.ts` |
| SQLite cache | planned milestone | N | planned |
| Production Postgres backend | planned hardening | N | planned |

## Update Rules
- If command surfaces, scripts, runtime versions, or service endpoints change, update this file in the same session.
- Never store API keys/tokens in committed docs/config.
- Hook baseline:
  - `.githooks/pre-commit` runs `scripts/memory_bank_guard.py`
  - `scripts/memory_bank_guard_milestones.py` provides spec-to-milestone alignment checks used by pre-commit guard.
  - `.githooks/pre-push` runs `scripts/enforcement_trigger.ps1 -Phase pre-push`
  - emergency bypass only: `SKIP_PG_ENFORCEMENT=1`


