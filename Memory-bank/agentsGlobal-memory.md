# Agents Global Memory - Change Log (Append-Only)

LAST_UPDATED_UTC: 2026-02-23 00:34
UPDATED_BY: codex

## Rules
- Append-only.
- No secrets.
- Keep entries concise and anchored by file path + symbol/migration.

---

### [2026-02-19 21:43 UTC] - mb-init
Scope:
- Components: bootstrap
- Files touched: Memory-bank starter pack

Summary:
- Initialized Memory-bank baseline and enforcement templates.

Anchors:
- `AGENTS.md`
- `scripts/memory_bank_guard.py`
- `.githooks/pre-commit`
- `.github/workflows/memory-bank-guard.yml`

### [2026-02-20 00:34 UTC] - codex
Scope:
- Components: narrate-extension-mvp, repo-hygiene, memory-bank-docs
- Files touched: extension scaffold, memory docs, root readme/gitignore

Summary:
- Implemented Milestone 1 scaffold in `extension/` with dev/edu reading mode commands, virtual `narrate://` document provider, cache-first narration engine, OpenAI-compatible provider client, and request-change prompt handoff.
- Added local JSON cache provider with hash-based line reuse and fallback narration for missing provider config.
- Updated Memory-bank source-of-truth docs to reflect architecture, commands, and milestone status.

Anchors:
- `extension/src/extension.ts`
- `extension/src/narration/narrationEngine.ts`
- `extension/src/llm/openAICompatibleProvider.ts`
- `extension/src/commands/requestChangePrompt.ts`
- `Memory-bank/code-tree/narrate-extension-tree.md`

### [2026-02-20 01:08 UTC] - codex
Scope:
- Components: milestone-2-edu-and-sections
- Files touched: section builder, render pipeline, term memory enrichment

Summary:
- Implemented section grouping and per-section summaries in reading view output.
- Added edu-focused term/syntax enrichment (`termMemory`) applied during narration post-processing.
- Kept existing provider/cache flow intact; Milestone 2 compiles successfully.

Anchors:
- `extension/src/readingView/sectionBuilder.ts`
- `extension/src/readingView/renderNarration.ts`
- `extension/src/narration/termMemory.ts`
- `extension/src/narration/narrationEngine.ts`

### [2026-02-20 01:22 UTC] - codex
Scope:
- Components: milestone-3-exports-and-gates
- Files touched: export commands, licensing placeholder gates, package contributions

Summary:
- Added `Export Narration (Current File)` and `Export Narration (Workspace)` command implementations.
- Added local placeholder plan gate service (`free/trial/pro/team/enterprise`) and wired export commands to Pro+ checks.
- Added configurable export options (output dir, include/exclude globs, max files, max chars).
- Updated status bar plan label to reflect placeholder plan setting.

Anchors:
- `extension/src/commands/exportNarrationFile.ts`
- `extension/src/commands/exportNarrationWorkspace.ts`
- `extension/src/licensing/featureGates.ts`
- `extension/src/licensing/plans.ts`
- `extension/src/extension.ts`
- `extension/package.json`

### [2026-02-20 01:37 UTC] - codex
Scope:
- Components: milestone-4-change-report, testing-defaults
- Files touched: git diff parser/client, report command, workspace settings

Summary:
- Implemented `Narrate: Generate Change Report (Git Diff...)` using local git diff parsing and narrated added-line summaries.
- Added git module with typed diff model, parser, and git CLI client.
- Added workspace default settings file for easier testing (`placeholderPlan=pro`).

Anchors:
- `extension/src/commands/generateChangeReport.ts`
- `extension/src/git/diffParser.ts`
- `extension/src/git/gitClient.ts`
- `extension/src/git/types.ts`
- `.vscode/settings.json`

### [2026-02-20 03:48 UTC] - codex
Scope:
- Components: extension-debug-setup
- Files touched: extension launch/task configs + memory docs

Summary:
- Added VS Code extension debug configuration to remove debugger picker confusion.
- Added compile task mapping for preLaunch task.
- Updated tooling docs to use `Run Narrate Extension` profile.

Anchors:
- `extension/.vscode/launch.json`
- `extension/.vscode/tasks.json`
- `Memory-bank/tools-and-commands.md`

### [2026-02-20 04:03 UTC] - codex
Scope:
- Components: extension-debug-workspace-open-fix
- Files touched: launch args update

Summary:
- Updated extension debug launch args to pass workspace folder path so Extension Development Host opens with a folder instead of empty Welcome state.

Anchors:
- `extension/.vscode/launch.json`

### [2026-02-20 13:46 UTC] - codex
Scope:
- Components: root-debug-profile-fix
- Files touched: root vscode debug/task config + tooling docs

Summary:
- Added root workspace debug profile to avoid debugger picker confusion when project is opened at `A PG VSCODE-EXTENSION/`.
- Added root compile task that builds `extension/` before launching Extension Development Host.
- Updated run instructions so users can debug without switching workspace folders.

Anchors:
- `.vscode/launch.json`
- `.vscode/tasks.json`
- `Memory-bank/tools-and-commands.md`

### [2026-02-20 18:14 UTC] - codex
Scope:
- Components: milestone-6-payments-redeem-affiliate, edu-trial-gating, licensing-command-surface
- Files touched: extension licensing/commands/package wiring, server routes/types/store, docs + memory-bank sync

Summary:
- Added extension commands `Narrate: Redeem Code` and `Narrate: Manage Devices` and wired them into activation/events.
- Added Edu access gate flow so backend mode now auto-attempts trial start for eligible signed-in users when switching/toggling Edu mode.
- Extended licensing client and gate service with redeem/device behavior.
- Implemented Milestone 6 backend routes for Stripe webhook grant, offline payment refs/proof/approve/reject, redeem apply, affiliate create/track/confirm/dashboard/payout approve.
- Added backend catalog routes and placeholder GitHub OAuth endpoints for API contract completeness.
- Extended JSON store schema and normalization for new payment/redeem/affiliate records.
- Verified extension compile + server build and executed runtime API smoke flow covering sign-in, offline->redeem, webhook, and affiliate paths.

Anchors:
- `extension/src/licensing/featureGates.ts`
- `extension/src/licensing/entitlementClient.ts`
- `extension/src/commands/redeemCode.ts`
- `extension/src/commands/manageDevices.ts`
- `extension/src/commands/toggleReadingMode.ts`
- `extension/src/commands/switchNarrationMode.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `server/src/index.ts`
- `server/src/types.ts`
- `server/src/store.ts`

### [2026-02-20 18:59 UTC] - codex
Scope:
- Components: stripe-checkout-production-path, github-oauth-loopback, milestone-7-team-provider-policy
- Files touched: extension licensing/provider/commands, server auth/payment/team/policy routes, memory-bank docs

Summary:
- Added browser checkout initiation from extension (`Narrate: Upgrade Plan`) backed by server checkout-session route.
- Added Stripe signature-verified webhook processing path and retained idempotent event ledger.
- Implemented GitHub OAuth start/callback with expiring state records plus extension loopback callback token capture.
- Implemented team seat administration routes and team/user provider policy routes in backend.
- Added provider policy enforcement in extension provider call path.
- Updated project/readme/memory docs to mark Milestone 7 core done and production-hardening phase next.

Anchors:
- `extension/src/commands/authSignInGitHub.ts`
- `extension/src/commands/upgradePlan.ts`
- `extension/src/licensing/featureGates.ts`
- `extension/src/llm/openAICompatibleProvider.ts`
- `server/src/index.ts`
- `server/src/types.ts`
- `server/src/store.ts`
- `server/README.md`

### [2026-02-20 20:12 UTC] - codex
Scope:
- Components: web-landing-onboarding, oauth-callback-origin-hardening, memory-bank-doc-sync
- Files touched: server static pages, server route wiring, docs + memory-bank sync

Summary:
- Added hosted landing/onboarding pages under `server/public/` with PG Global positioning, pricing, security, supported-platform content, and web interaction panel.
- Added browser onboarding actions for email sign-in, GitHub OAuth redirect, Stripe checkout launch, offline payment reference/proof, redeem application, and entitlement status refresh.
- Updated backend to serve static pages from `/`, expose terms/privacy/checkout callback pages, and allow trusted non-loopback OAuth callback origins via `OAUTH_CALLBACK_ORIGINS`.

Anchors:
- `server/public/index.html`

### [2026-02-20 21:35 UTC] - codex
Scope:
- Components: postgres-prisma-provisioning
- Files touched: prisma schema + package scripts + docs

Summary:
- Added Prisma to `server/` and created full licensing domain schema in `server/prisma/schema.prisma`.
- Connected to remote PostgreSQL and provisioned real tables in schema `narrate` using `prisma db push`.
- Added Prisma command scripts and environment template, and documented staged migration status (Postgres ready, runtime still JSON-based).

Anchors:
- `server/prisma/schema.prisma`
- `server/package.json`
- `server/.env.example`
- `Memory-bank/db-schema/narrate-postgres-prisma-schema.md`
- `server/README.md`
- `server/public/assets/site.css`
- `server/public/assets/site.js`
- `server/public/oauth-complete.html`
- `server/src/index.ts`
- `server/README.md`
- `README.md`

### [2026-02-20 20:38 UTC] - codex
Scope:
- Components: web-smoke-testing, docs-command-surface
- Files touched: server smoke script + docs/memory sync

Summary:
- Added `npm run smoke:web` command via `server/scripts/smoke-web.mjs`.
- Script boots server on temporary port and validates the main landing page plus CSS/JS and all key web onboarding pages.
- Updated README and memory-bank tooling/code-tree docs so web testing is one command for user verification.

Anchors:
- `server/scripts/smoke-web.mjs`
- `server/package.json`
- `server/README.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`

### [2026-02-20 20:52 UTC] - codex
Scope:
- Components: landing-copy-clarification, pro-gating-visibility
- Files touched: landing page matrix/copy + smoke assertion update

Summary:
- Updated landing page to explicitly call out Pro+ features the user asked for:
  - change timeline reports
  - add/delete/modify tracking
  - export code + translation/narration
- Added a visible plan matrix row set so Pro/Team/Enterprise gating is clear to buyers.
- Updated smoke test assertions to validate the new matrix labels on `/`.

Anchors:
- `server/public/index.html`
- `server/public/assets/site.css`
- `server/scripts/smoke-web.mjs`

### [2026-02-20 21:10 UTC] - codex
Scope:
- Components: web-auth-wall, google-oauth-support
- Files touched: server auth routes/types + web onboarding ui/js

Summary:
- Added auth wall on landing page so checkout/offline/redeem controls are hidden until authenticated.
- Added Google OAuth start/callback routes and shared callback page support (`/oauth/google/complete`).
- Updated web script to manage sign-in state, show/hide protected actions, and support sign-out.

Anchors:
- `server/src/index.ts`
- `server/src/types.ts`
- `server/public/index.html`
- `server/public/assets/site.js`
- `server/public/assets/site.css`

### [2026-02-20 21:18 UTC] - codex
Scope:
- Components: landing-copy-memorybank-packaging
- Files touched: pricing matrix + local-control messaging copy

Summary:
- Added explicit Memory-bank packaging rows to pricing matrix (module access + projects left quotas).
- Added enterprise row clarifying "unlock all governed elements."
- Clarified local-control statement: backend handles entitlement/licensing metadata while memory/code context remains local.

Anchors:
- `server/public/index.html`

### [2026-02-20 22:24 UTC] - codex
Scope:
- Components: postgres17-schema-cutover, admin-rbac-schema-separation, local-env-wiring
- Files touched: prisma schema + env/docs + memory-bank sync

Summary:
- Verified target host (`91.98.162.101:5433`) is PostgreSQL 17 and created dedicated database `"narate-enterprise"`.
- Created and enforced non-public schema `narate_enterprise` with role search path set for `egov_user`.
- Added dedicated admin governance tables in Prisma so admin identities are not mixed with customer `users`:
  - `admin_accounts`, `admin_roles`, `admin_permissions`, `admin_role_permissions`, `admin_scopes`, `admin_account_roles`, `admin_audit_logs`.
- Pushed Prisma to Postgres and verified table count increased from 21 to 28.
- Wired local `server/.env` and `.env.example` to use `?schema=narate_enterprise`, then validated service with `npm run smoke:web`.

Anchors:
- `server/prisma/schema.prisma`
- `server/.env`
- `server/.env.example`
- `server/README.md`
- `Memory-bank/db-schema/narrate-postgres-prisma-schema.md`

### [2026-02-20 22:41 UTC] - codex
Scope:
- Components: production-domain-wiring
- Files touched: server env config + memory-bank sync

Summary:
- Wired backend runtime config for production domain `pgextenson.addresly.com`.
- Updated host binding to `0.0.0.0` and set `PUBLIC_BASE_URL` to HTTPS domain.
- Added explicit OAuth callback env values for GitHub and Google using production domain callback paths.
- Kept local callback origins enabled in `OAUTH_CALLBACK_ORIGINS` for local testing fallback.

Anchors:
- `server/.env`

### [2026-02-20 22:53 UTC] - codex
Scope:
- Components: cloudflare-tunnel-bootstrap, domain-correction
- Files touched: tunnel automation script + docs/memory sync

Summary:
- Corrected production domain to `pg-ext.addresly.com` in backend env and OAuth callback settings.
- Installed `cloudflared` (version 2025.8.1) on the machine using winget.
- Added `scripts/setup_cloudflare_tunnel.ps1` with three modes:
  - `quick` (temporary trycloudflare URL)
  - `named` (named tunnel + DNS route + config generation)
  - `service-token` (headless service install path)
- Updated server and memory-bank command docs for repeatable tunnel setup.

Anchors:
- `server/.env`
- `scripts/setup_cloudflare_tunnel.ps1`
- `server/README.md`
- `Memory-bank/tools-and-commands.md`

### [2026-02-20 23:06 UTC] - codex
Scope:
- Components: oauth-runtime-env-fix
- Files touched: backend startup/env loading + docs/memory sync

Summary:
- Fixed live OAuth misconfiguration by loading `.env` automatically in backend startup (`import "dotenv/config"`).
- Added explicit `dotenv` dependency to server package so runtime env is always available in both dev and dist start.
- Verified locally and on live domain:
  - `/auth/google/start` returns redirect (302)
  - `/auth/github/start` returns redirect (302)
  - `/health` remains OK.
- Restarted runtime server to apply fix.

Anchors:
- `server/src/index.ts`
- `server/package.json`
- `server/README.md`

### [2026-02-21 01:05 UTC] - codex
Scope:
- Components: account-portal-self-service, enterprise-team-admin-web
- Files touched: backend account/team routes, JSON-store normalization, web onboarding UI/js, memory-bank docs

Summary:
- Added customer account APIs: summary, billing history, support history, support request, and feedback submission.
- Added team self-service APIs for authenticated owner/manager users: team create, status, assign/revoke seat, and team provider policy updates.
- Expanded hosted web panel with account dashboard, billing/support actions, feedback form, and enterprise team-admin controls.
- Added JSON-store defaults/normalization for `support_tickets` and `feedback_entries`.

Anchors:
- `server/src/index.ts`
- `server/src/store.ts`
- `server/public/index.html`
- `server/public/assets/site.js`
- `server/public/assets/site.css`

### [2026-02-21 02:10 UTC] - codex
Scope:
- Components: portal-ux-split, super-admin-board, seeded-test-accounts
- Files touched: portal pages/assets, backend admin board routes/env handling, smoke tests, docs

Summary:
- Split public web experience into marketing landing (`/`) and secure sidebar portal (`/app`) for enterprise-grade UX.
- Added super-admin board API surface guarded by authenticated email allowlist (`SUPER_ADMIN_EMAILS`) to manage users/subscriptions/payments/support.
- Added super-admin operations for ticket status update, subscription revoke, and user session revoke.
- Seeded test accounts and enterprise team assignment for immediate validation.

Anchors:
- `server/public/index.html`
- `server/public/app.html`
- `server/public/assets/app.css`
- `server/public/assets/site.js`
- `server/src/index.ts`
- `server/scripts/smoke-web.mjs`
- `server/.env.example`

### [2026-02-21 02:18 UTC] - codex
Scope:
- Components: auth-device-limit-hotfix
- Files touched: backend auth route logic + daily logs

Summary:
- Fixed OTP verify 500 error for seeded enterprise users by removing hardcoded device limit `1` during sign-in.
- Updated email/GitHub/Google login flows to resolve user effective plan first and apply plan-aware `device_limit`.
- Added explicit email-verify error mapping for device issues (`403 device limit reached` / `device revoked`) instead of generic internal server error.
- Rebuilt and restarted backend; verified `/auth/email/start` + `/auth/email/verify` succeeds for `owner@pgglobal.dev` on a new install id.

Anchors:
- `server/src/index.ts`

### [2026-02-21 02:30 UTC] - codex
Scope:
- Components: admin-route-hardening
- Files touched: backend admin route prefix + portal admin API paths + memory docs

Summary:
- Moved publicly guessable admin route surface from `/admin/*` to `/pg-global-admin/*`.
- Updated super-admin board endpoints and admin-key protected operational endpoints to use the hardened prefix.
- Updated portal frontend admin API calls to the new prefix, while preserving auth and super-admin checks.
- Confirmed old `/admin/board/summary` now returns `404` and new `/pg-global-admin/board/summary` requires bearer auth (`401` without token).
- Removed seeded enterprise owner from `SUPER_ADMIN_EMAILS` so enterprise users no longer see global admin board.

Anchors:
- `server/src/index.ts`
- `server/public/assets/site.js`
- `server/.env`

### [2026-02-21 04:35 UTC] - codex
Scope:
- Components: db-rbac-enforcement, auth-mode-hardening, portal-admin-visibility
- Files touched: backend admin auth/permission helpers + env defaults + portal summary/admin visibility + docs

Summary:
- Implemented DB-backed admin permission enforcement for privileged routes via `requireAdminPermission(...)`.
- Added `ADMIN_AUTH_MODE=db|hybrid|key` with secure default `db`; legacy `x-admin-key` now optional fallback only.
- Added startup RBAC baseline seeding in `admin_*` tables (permissions, system roles, bootstrap super-admin account assignment).
- Extended account summary payload to expose `can_access_admin_board` and `admin_permissions`, so non-super-admin operators can be surfaced by permission.
- Moved affiliate admin confirm endpoint under hardened namespace: `/pg-global-admin/affiliate/conversion/confirm`.
- Set secure env defaults for production-like posture (`SUPER_ADMIN_SOURCE=db`, `EXPOSE_DEV_OTP_CODE=false`).
- Validated with build + smoke + focused RBAC checks (owner denied; super-admin allowed).

Anchors:
- `server/src/index.ts`
- `server/public/assets/site.js`
- `server/.env`
- `server/.env.example`
- `server/README.md`

### [2026-02-21 05:10 UTC] - codex
Scope:
- Components: roadmap-planning-eod-mastermind, slack-first-governance-architecture
- Files touched: project planning docs + milestone spec + mastermind decision register

Summary:
- Added explicit continuation milestones beyond Step 8 for `PG EOD`, `PG Mastermind`, `Slack gateway`, and `local decision sync bridge`.
- Updated build order in `building-plan-doc.md` to include structured task-by-task execution through Milestone 13.
- Recorded architecture decision: Slack-first integration, local Memory-bank remains source-of-truth, cloud carries decisions/metadata only.
- Added planned command aliases (`PG EOD`, `PG Mastermind`, `PG Decision`, `PG Plan`) to command documentation for consistent team usage.

Anchors:
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/mastermind.md`
- `Memory-bank/tools-and-commands.md`
- `building-plan-doc.md`

### [2026-02-21 15:05 UTC] - codex
Scope:
- Components: governance-runtime-baseline, portal-governance-controls, admin-slack-addon-toggle
- Files touched: server governance APIs/store/docs + portal UI + memory-bank sync docs

Summary:
- Implemented governance runtime baseline in server JSON mode:
  - scope settings (`/account/governance/settings*`) with vote mode, retention, max debate chars, and Slack toggle/add-on gate.
  - EOD reporting APIs (`/account/governance/eod/*`).
  - mastermind debate workflow APIs (thread create/list/detail, entry, vote, finalize decision).
  - local sync queue APIs (`/account/governance/sync/pull`, `/account/governance/sync/ack`) with per-user ack records.
- Added admin governance routes for Slack add-on activation per team/user and governance board summary:
  - `/pg-global-admin/governance/slack-addon/team`
  - `/pg-global-admin/governance/slack-addon/user`
  - `/pg-global-admin/board/governance`
- Extended portal `/app` with governance controls/buttons for team users and admin add-on controls.
- Updated plan catalog output to expose governance enablement and Slack add-on pricing metadata.
- Added retention pruning behavior for mutable governance data while preserving finalized outcomes.

Anchors:
- `server/src/index.ts`
- `server/src/store.ts`
- `server/public/app.html`
- `server/public/assets/site.js`
- `server/README.md`
- `server/.env.example`
### [2026-02-21 23:40 UTC] - codex
Scope:
- Components: prisma-runtime-store-mode, cloudflare-admin-lock, slack-signed-command-bridge, portal-admin-prefix-dynamic
- Files touched: server runtime/auth/integration + prisma schema + portal js/ui + docs/memory sync

Summary:
- Added runtime store backend mode switch for licensing server:
  - `STORE_BACKEND=json` uses `JsonStore` (`server/data/store.json`).
  - `STORE_BACKEND=prisma` uses new `PrismaStateStore` persisted in `narate_enterprise.runtime_state`.
- Added Prisma model `RuntimeState` in `server/prisma/schema.prisma` and implemented `server/src/prismaStore.ts`.
- Hardened admin access surface:
  - `ADMIN_ROUTE_PREFIX` is now configurable (default `/pg-global-admin`).
  - Optional Cloudflare Access JWT enforcement added for admin routes via:
    - `CLOUDFLARE_ACCESS_ENABLED`
    - `CLOUDFLARE_ACCESS_TEAM_DOMAIN`
    - `CLOUDFLARE_ACCESS_AUD`
- Added signed Slack integration baseline:
  - `GET /integrations/slack/health`
  - `POST /integrations/slack/commands` with HMAC signature verification and replay window checks.
  - Slack command actions implemented: `help`, `summary`, `eod`, `thread`, `vote`.
  - Added `POST /account/governance/slack/test` for authenticated dispatch testing from portal.
  - Added outbound Slack notifications on EOD submit, mastermind thread create, and decision finalize when add-on is active.
- Updated portal JS to use server-provided admin route prefix from account summary (`admin_route_prefix`) instead of hardcoded admin path.

Verification:
- `npm run build` (server) passed.
- `npm run smoke:web` (server) passed.
- Note: `npm run prisma:generate` hit Windows file-lock `EPERM` while replacing prisma query engine DLL (likely due active process); runtime fallback and explicit regenerate step documented.

Anchors:
- `server/src/index.ts`
- `server/src/store.ts`
- `server/src/prismaStore.ts`
- `server/prisma/schema.prisma`
- `server/public/assets/site.js`
- `server/public/app.html`
- `server/.env.example`
- `server/README.md`
### [2026-02-21 23:58 UTC] - codex
Scope:
- Components: prisma-table-persistence-cutover, slack-interactive-actions, db-target-diagnostics
- Files touched: server runtime + prisma schema + env/docs + memory-bank sync

Summary:
- Fixed build break by implementing missing Slack action handlers:
  - `resolveSlackPayloadUser(...)`
  - `executeSlackGovernanceAction(...)`
- Added signed Slack interactive action flow (`/integrations/slack/actions`) with:
  - vote buttons (`pg_vote_option`)
  - decision buttons (`pg_decide_thread`)
  - refresh/account summary actions
- Added Slack block builder for mastermind thread interactions so reviewers can vote/approve/reject directly from Slack.
- Updated Prisma schema enum `TeamRole` to include `manager` for parity with runtime logic.
- Completed runtime persistence cutover docs to reflect table-by-table Prisma persistence (no `runtime_state` row).
- Added startup DB target diagnostic log (`database_target`) to surface exact host/port/schema in runtime and speed up `5432 vs 5433` troubleshooting.

Verification:
- `npm run build` (server) passed.
- `npm run smoke:web` (server) passed.
- `npm run prisma:dbpush` reached remote DB `91.98.162.101:5433` and synced schema.
- `npm run prisma:generate` still shows Windows DLL lock `EPERM` in this environment when the query engine file is in use.

Anchors:
- `server/src/index.ts`
- `server/prisma/schema.prisma`
- `server/.env.example`
- `server/README.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/db-schema/narrate-postgres-prisma-schema.md`

### [2026-02-21 21:04 UTC] - codex
Scope:
- Components: prisma-store-uuid-cast-hotfix, slack-command-runtime-stability
- Files touched: `server/src/prismaStore.ts`, memory-bank docs

Summary:
- Resolved Slack `/pg` `operation_timeout` root cause by fixing Prisma persistence insert typing.
- `PrismaStateStore` now loads table column types from Postgres metadata and casts each insert placeholder to the real DB column type.
- Prevented UUID/text mismatch crashes (`ERROR 42804`) seen during Slack command user upsert path.
- Confirmed `npm run build` passes after patch.

Verification:
- `npm run build` (server) passed.
- Live logs no longer expected to fail with `column "id" is of type uuid but expression is of type text` once server restarts with patch.

Anchors:
- `server/src/prismaStore.ts`
- `Memory-bank/structure-and-db.md`

### [2026-02-21 21:22 UTC] - codex
Scope:
- Components: slack-help-fast-ack-timeout-fix
- Files touched: `server/src/index.ts`, memory-bank docs

Summary:
- Fixed Slack `/pg help` timeout path by returning help response before Slack user-email lookup and DB user provisioning.
- Added helpers `isSlackHelpCommand(...)` and `buildSlackHelpText(...)` to centralize help output.
- Keeps signature verification and workspace allowlist checks intact while reducing command round-trip under Slack's 3s requirement.

Verification:
- `npm run build` (server) passed.

Anchors:
- `server/src/index.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`

### [2026-02-21 21:58 UTC] - codex
Scope:
- Components: slack-command-async-ack-fix
- Files touched: `server/src/index.ts`, memory-bank docs

Summary:
- Fixed Slack `dispatch_failed` for non-help commands by moving slash-command execution to async flow.
- `/integrations/slack/commands` now:
  - immediately replies "Processing command..."
  - executes `summary/eod/thread/vote` in background
  - posts final result via Slack `response_url`.
- This keeps signature/team checks on ingress and avoids Slack 3s timeout while heavy DB persistence runs.

Verification:
- `npm run build` (server) passed.

Anchors:
- `server/src/index.ts`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/project-details.md`

### [2026-02-21 22:08 UTC] - codex
Scope:
- Components: slack-summary-readonly-user-lookup, prisma-pool-stability
- Files touched: `server/src/index.ts`, `server/src/prismaStore.ts`, memory-bank docs

Summary:
- Addressed Slack `Invalid prisma.$executeRawUnsafe` pool timeout by reducing unnecessary writes and stabilizing persistence connection usage.
- Slack command async processor now resolves command action and avoids auto-create/touch-write for `summary` (read-only path).
- Added `findUserByEmail(...)` and optional behaviors to `getOrCreateUserByEmail(...)` to control write side effects.
- Wrapped `PrismaStateStore.persist()` in a single Prisma transaction so one connection is reused across delete/insert cycles.

Verification:
- `npm run build` (server) passed.

Anchors:
- `server/src/index.ts`
- `server/src/prismaStore.ts`
- `Memory-bank/structure-and-db.md`

### [2026-02-22 14:04 UTC] - codex
Scope:
- Components: prisma-interactive-transaction-stability-fix, standalone-root-restart
- Files touched: `server/src/prismaStore.ts`, memory-bank docs

Summary:
- Fixed intermittent Slack governance failures caused by Prisma interactive transaction handles in runtime persistence.
- Replaced `PrismaStateStore.persist()` interactive callback transaction with non-interactive sequential writes to prevent:
  - `Transaction API error: Transaction not found`
  - downstream `/pg` command instability on async Slack command processing.
- Restarted backend from standalone root and verified health:
  - `http://127.0.0.1:8787/health`
  - `https://pg-ext.addresly.com/health`
  - `https://pg-ext.addresly.com/integrations/slack/health`

Verification:
- `npm run build` (server) passed.
- Runtime listening confirmed on `0.0.0.0:8787`.

Anchors:
- `server/src/prismaStore.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`

### [2026-02-22 14:26 UTC] - codex
Scope:
- Components: framework-checklist-audit, pg-push-command, enterprise-ip-protection-decision
- Files touched: extension command surface + memory-bank docs

Summary:
- Audited new folder sets and confirmed full framework/checklist coverage:
  - `framwork-do-and-must-not-do/impotants-folder-framworks/*`
  - `production-checklist/impotant chicklst b4 prod/*`
- Added new extension command workflow:
  - `Narrate: PG Push (Git Add/Commit/Push)`
  - `Narrate: PG Git Push` (alias)
  - implemented via `extension/src/commands/pgPush.ts` and wired in activation + manifest.
- Added repository protection guard by ignoring local IP folders in `.gitignore`:
  - `framwork-do-and-must-not-do/`
  - `production-checklist/`
- Recorded architecture ruling to keep framework/checklist docs private server-side and expose only entitlement-gated summaries/rule evaluations to clients.
- Added roadmap tracking for this track (`Milestone 10E`) in project details to avoid drift.

Verification:
- `npm run compile` (extension) passed.

Anchors:
- `extension/src/commands/pgPush.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `.gitignore`
- `Memory-bank/mastermind.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`

### [2026-02-22 20:46 UTC] - codex
Scope:
- Components: roadmap-sequencing-cloud-first-prodguard, policy-boundary-planning
- Files touched: Memory-bank planning/decision docs

Summary:
- Confirmed rollout strategy: finish Slack gateway + Narrate flow validation first.
- Added roadmap milestones for cloud-first production-readiness package (Free/Student/Team) and enterprise offline encrypted add-on as post-cloud stage.
- Documented AGENTS/policy boundary split: generic local instructions in repo, premium rule bodies/scoring logic server-private.
- Captured upcoming command track (`pg login/update/doctor/prod`) as planned milestone scope.

Anchors:
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/mastermind.md`

### [2026-02-22 22:34 UTC] - codex
Scope:
- Components: dependency-verification-enforcement-planning, server-private-policy-boundary
- Files touched: Memory-bank planning/decision docs + dependency enforcement reference doc

Summary:
- Reviewed `.verificaton-before-production-folder/DEPENDENCY_VERIFICATION_ENFORCEMENT.md` and accepted it as strict blocker policy direction.
- Added roadmap/spec updates so dependency verification becomes a server-side private enforcement service (deny-list + official registry/doc verification + compatibility checks + vulnerability thresholds).
- Added planning rule that `pg prod` must fail closed on dependency verification failures with explicit remediation reason codes.
- Recorded architecture decision to keep canonical dependency policy internals off local user-visible surfaces to reduce IP leakage/bypass risk.

Anchors:
- `.verificaton-before-production-folder/DEPENDENCY_VERIFICATION_ENFORCEMENT.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/mastermind.md`

### [2026-02-22 22:58 UTC] - codex
Scope:
- Components: slack-response-url-fallback, slack-command-parse-hardening
- Files touched: server runtime + memory-bank docs

Summary:
- Patched Slack async command delivery to retry plain-text response when rich block payload post to `response_url` is rejected (`500`), reducing user-facing Slack command failures.
- Updated slash-command parsing to accept optional leading `pg` token inside command text payload.
- Added explicit validation for non-UUID/placeholder `thread_id` in `vote` command with remediation hint.
- Rebuilt and restarted backend runtime on `:8787` and revalidated Slack health endpoint.

Anchors:
- `server/src/index.ts`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/project-details.md`
- `Memory-bank/daily/2026-02-22.md`

### [2026-02-23 00:12 UTC] - codex
Scope:
- Components: slack-action-fast-ack, async-action-followup-fallback
- Files touched: action ingress/async runtime + memory docs

Summary:
- Fixed Slack interactive button timeout (`Operation timed out. Apps need to respond within three seconds`) by making `/integrations/slack/actions` always return immediate ack.
- Moved action authorization/execution fully async and added fallback follow-up delivery using `chat.postEphemeral` when Slack payload does not include `response_url`.
- Rebuilt server, replaced stale listener process, restarted runtime, and verified signed local action requests now return `200` fast with `Processing action...`.

Anchors:
- `server/src/index.ts`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`
- `Memory-bank/daily/2026-02-23.md`

### [2026-02-23 00:26 UTC] - codex
Scope:
- Components: slack-role-aware-card-ux, vote-vs-finalize-clarity
- Files touched: Slack card builder/help text + memory docs

Summary:
- Updated Slack help text and interaction card UX to make governance flow explicit: team vote first, reviewer finalizes second.
- Made Slack action card rendering viewer-role-aware:
  - vote buttons only for users with vote access
  - finalize buttons only for users allowed to finalize
  - added per-viewer access label and workflow guidance line in card context.
- Rebuilt and restarted server so live Slack card interactions now align with backend permission model.

Anchors:
- `server/src/index.ts`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/mastermind.md`
- `Memory-bank/daily/2026-02-23.md`

### [2026-02-23 00:34 UTC] - codex
Scope:
- Components: slack-role-transparency, team-role-visibility-in-summary
- Files touched: Slack summary/thread card rendering + memory docs

Summary:
- Added concrete role visibility in Slack governance outputs so users can verify why they can/cannot finalize.
- `summary` command now reports team roles (`TEAM_KEY (owner|manager|member)`).
- Thread interaction card now shows scope/team key and role-specific access labels (`owner/manager/member`) with finalization capability.

Anchors:
- `server/src/index.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/daily/2026-02-23.md`

### [2026-02-22 23:32 UTC] - codex
Scope:
- Components: slack-decide-command-fallback
- Files touched: server slash-command handler + tooling/spec docs

Summary:
- Added new Slack slash command `decide` for thread finalization when interactive buttons are unavailable.
- Updated Slack command parsing/help output to include `decide` and keep optional `pg` prefix handling.
- Rebuilt backend and restarted service to activate command path on live port `8787`.

Anchors:
- `server/src/index.ts`
- `Memory-bank/project-spec.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/structure-and-db.md`

### [2026-02-23 00:00 UTC] - codex
Scope:
- Components: slack-invalid-blocks-button-fix
- Files touched: Slack block builder/action parser + memory docs

Summary:
- Identified Slack `invalid_blocks` root cause from runtime logs: duplicate button `action_id` values in open-thread interactive blocks.
- Updated Slack button generation to use unique per-button action IDs and updated action handling to support action-id prefixes.
- Rebuilt/restarted server and retained slash `decide` fallback path for non-interactive safety.

Anchors:
- `server/src/index.ts`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/project-details.md`
- `Memory-bank/daily/2026-02-22.md`
