# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-07 03:18
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 1858


### [2026-03-02 01:00 UTC] - session-23-documentation-guides
Scope:
- Components: docs (new directory)
Summary:
Created 3 comprehensive production guides in `docs/` directory:
1. **TESTING_GUIDE.md** — Extension compile + F5 debug, server build/dev, Playwright smoke tests, PG self-check (warn/strict), narrate flow validation, individual policy checks, manual functional testing, CI simulation.
2. **EXTENSION_PUBLISHING_GUIDE.md** — Publisher account setup, PAT creation, vsce package/publish workflow, .vscodeignore, metadata checklist, version management (semver), CI/CD auto-publish via GitHub Actions tags, post-publish verification.
3. **PRODUCTION_DEPLOYMENT_GUIDE.md** — Architecture overview (Cloudflare→Fastify→Hetzner PG), server prep (Node 20 install), DB setup (91.98.162.101:5433 narate_enterprise), full .env reference (core/OAuth/Stripe/Slack/admin/session), Prisma migrations, PM2/systemd process management, Cloudflare tunnel config, OAuth app setup (GitHub+Google), Stripe webhook wiring, Slack app config, admin RBAC bootstrap, health monitoring endpoints, 17-item security hardening checklist, maintenance operations, troubleshooting matrix.
Anchors:
- `docs/TESTING_GUIDE.md` (NEW — 230+ lines)
- `docs/EXTENSION_PUBLISHING_GUIDE.md` (NEW — 300+ lines)
- `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` (NEW — 400+ lines)

---

### [2026-03-01 22:30 UTC] - session-19-fastify5-upgrade-and-audit
Scope:
- Components: server dependencies, security audit
Summary:
Upgraded Fastify 4→5 and all @fastify plugins to fix 2 high-severity CVEs (GHSA-jx2c-rxcm-jvmq body validation bypass CVSS 7.5, GHSA-mrq3-vjjr-p77c DoS via unbounded memory). Removed premature CI/CD workflow (repo not on GitHub yet). Fixed duplicate `/health` route that was blocking `/health/ready` registration. Full compliance audit: all 63 server + 87 extension files under 500 lines. Fastify CVE blocker (DEP-SEC-001) resolved, npm audit 0 vulnerabilities.
- Fastify: 4.28.1→5.7.4
- @fastify/cookie: 9.4.0→11.0.2
- @fastify/cors: 9.0.1→11.2.0
- @fastify/rate-limit: 9.1.0→10.3.0
- @fastify/static: 7.0.4→9.0.0
Anchors:
- `server/package.json` (MODIFIED — major version bumps for fastify + 4 plugins)
- `server/src/index.ts` (MODIFIED — removed duplicate inline `/health` route)
- `.github/workflows/build-deploy.yml` (DELETED — premature, repo not on GitHub)

---

### [2026-03-01 21:00 UTC] - session-18-production-hardening
Scope:
- Components: server runtime, CI/CD, Prisma migrations, health probes, security headers
Summary:
Shipped Production Hardening phase with 6 items + COD-LIMIT-001 extraction:
1. **Prisma migration pipeline**: `server/prisma/migrations/0_init/migration.sql` (initial baseline from schema), `migration_lock.toml`, `prisma:migrate:deploy` + `prisma:migrate:status` npm scripts.
2. **Startup config validation**: `productionReadiness.ts` extended with `runProductionReadinessCheck()` orchestrator (14 checks, crash-on-fail in prod). Wired into `bootstrap()`.
3. **Security headers + CORS lock**: `serverRuntimeSetup.ts` — CORS locked to configured origins in prod, HSTS header, credential/method/headers config.
4. **Rate-limit hardening**: Global rate-limit 100 req/min prod, 1000/min dev.
5. **CI/CD pipeline**: `.github/workflows/build-deploy.yml` — build, migration-check, memory-bank-guard, deploy (manual gate).
6. **Health + readiness probes**: `healthRoutes.ts` — `/health` (liveness) + `/health/ready` (readiness with store check). `checkReady()` added to StateStore/JsonStore/PrismaStateStore.
7. **Modularity extraction (COD-LIMIT-001)**: `safeLogging.ts` (new, 24 lines), `ADMIN_PERMISSION_KEYS` → adminRbacBootstrap.ts, `runProductionReadinessCheck` → productionReadiness.ts. index.ts 529→498 lines.
Anchors:
- `server/prisma/migrations/0_init/migration.sql` (NEW — initial SQL migration)
- `server/src/productionReadiness.ts` (MODIFIED — added `runProductionReadinessCheck`)
- `server/src/healthRoutes.ts` (NEW — liveness + readiness endpoints)
- `server/src/safeLogging.ts` (NEW — extracted log factory)
- `server/src/serverRuntimeSetup.ts` (MODIFIED — CORS+HSTS+rate-limit hardening)
- `server/src/adminRbacBootstrap.ts` (MODIFIED — added `ADMIN_PERMISSION_KEYS` export)
- `server/src/store.ts` (MODIFIED — `checkReady()` on StateStore + JsonStore)
- `server/src/prismaStore.ts` (MODIFIED — `checkReady()` with DB ping)
- `server/src/index.ts` (MODIFIED — 529→498 lines, production wiring)
- `.github/workflows/build-deploy.yml` (NEW — CI/CD)
- `server/.env.example` (MODIFIED — prod-safe defaults)
- `server/package.json` (MODIFIED — migration scripts)

---

### [2026-03-01 19:00 UTC] - session-17-final-5-planned-items
Scope:
- Components: server policy, CLI, offline packs, project setup, tech debt
Summary:
Completed all 5 remaining Planned backlog items (excluding WhatsApp/Telegram deferred):
1. **Production Checklist Engine**: `productionChecklistEvaluator.ts` (129 lines — 7-domain orchestration), `productionChecklistRoutes.ts` (223 lines — 3 routes: user eval, domains list, admin cross-scope). Sub-registered in `policyRoutes.ts`. CLI: `production_checklist.ps1`. Commands: `pg prod-checklist` / `pg production-checklist`.
2. **AGENTS Policy Split**: `agentsPolicyProfile.ts` (200 lines — plan-aware profile resolver with per-domain enforcement/auto-fix/prod-checklist directives + behaviour flags). Routes: GET `/account/policy/agents/profile` + admin cross-scope. AGENTS.md updated with Server Policy Profile section.
3. **Offline Pack Rotation/Revocation**: Extended `offlinePackRoutes.ts` (+44 lines → 349 total) with POST `/account/enterprise/offline-pack/rotate` (revokes old pack, issues new one) and POST `{admin}/board/enterprise/offline-pack/revoke`.
4. **One-Click Project Setup**: `project_setup.ps1` (171 lines — framework-aware bootstrapper, auto-detection for 7 frameworks, scaffolds `.narrate/config.json`, `.narrate/policy.json`, `.editorconfig`, `.gitignore` PG section, `Memory-bank/README.md` stub). Commands: `pg init` / `pg project-setup`.
5. **Tech Debt Counter ($)**: `techDebtEvaluator.ts` (151 lines — severity→hours→cost model with plan-aware rate adjustment), `techDebtRoutes.ts` (139 lines — 3 routes), `tech_debt_check.ps1` (101 lines — CLI with `-ModelOnly`, `-FindingsFile`, `-Json`). Commands: `pg tech-debt` / `pg tech-debt-model`.
Key constraints: index.ts stayed at 490 lines untouched; all new routes sub-registered through policyRoutes.ts (now 273 lines). pg.ps1 expanded to 945 lines with 6 new command aliases.
Anchors:
- `server/src/productionChecklistEvaluator.ts` (NEW — checklist orchestration engine)
- `server/src/productionChecklistRoutes.ts` (NEW — 3 API routes)
- `server/src/agentsPolicyProfile.ts` (NEW — AGENTS policy profile resolver + 2 routes)
- `server/src/techDebtEvaluator.ts` (NEW — cost model evaluator)
- `server/src/techDebtRoutes.ts` (NEW — 3 API routes)
- `server/src/policyRoutes.ts` (modified — 3 new sub-registrations: checklist + agents + tech-debt)
- `server/src/offlinePackRoutes.ts` (modified — rotate + revoke endpoints)
- `scripts/production_checklist.ps1` (NEW — CLI bridge)
- `scripts/tech_debt_check.ps1` (NEW — CLI bridge)
- `scripts/project_setup.ps1` (NEW — framework-aware project bootstrapper)
- `scripts/pg.ps1` (modified — 6 new commands in ValidateSet + switch routing)
- `AGENTS.md` (modified — added Server Policy Profile section)

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

### [2026-02-26 13:34 UTC] - codex
Scope:
- Components: slack-transport-timeout-hardening, local-core-closure-stability
- Files touched: slack transport checker timeout + memory docs

Summary:
- Investigated repeated `pg slack-check` failures where thread creation timed out at 20 seconds.
- Confirmed endpoint health and behavior by manual probe:
  - `/account/governance/mastermind/thread/create` succeeded in ~49.7 seconds.
- Fixed false-negative transport failures by increasing `Invoke-JsonPost` timeout in `scripts/slack_transport_check.ps1`:
  - from `-TimeoutSec 20` to `-TimeoutSec 90`.
- Re-ran validation:
  - `.\pg.ps1 slack-check -SkipPublicChecks` -> PASS 12 / FAIL 0
  - `.\pg.ps1 closure-check -ClosureMode local-core -SkipPublicChecks` -> overall PASS

Anchors:
- `scripts/slack_transport_check.ps1`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
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

### [2026-02-23 18:02 UTC] - codex
Scope:
- Components: coding-standards-policy-merge, profile-aware-enforcement-planning, rule-id-visibility-boundary
- Files touched: verification planning docs + memory-bank roadmap/decision docs

Summary:
- Reviewed both coding standards drafts and resolved conflicts into one merge decision:
  - canonical base is `CODING_STANDARDS_ENFORCEMENT.md`
  - V2 treated as advisory notes
  - conflicts resolved using target vs hard thresholds (warning vs blocker).
- Added IP-protected enforcement model:
  - canonical policy logic/weights/overrides stay server-private
  - client output uses opaque rule IDs + minimal remediation hints.
- Added framework profile strategy so only relevant rules load by project stack (Java/Nest/Next/etc.), including monorepo folder-profile mapping.
- Added roadmap and mastermind entries for coding standards enforcement baseline as separate planned track alongside dependency verification.

Anchors:
- `.verificaton-before-production-folder/CODING_STANDARDS_POLICY_MERGE_DECISION.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/mastermind.md`

### [2026-02-23 18:18 UTC] - codex
Scope:
- Components: enforcement-trigger-lifecycle-planning, anti-exfil-jailbreak-guardrail-planning
- Files touched: policy merge decision + memory-bank roadmap/decision docs

Summary:
- Added explicit enforcement lifecycle hooks:
  - start-of-session baseline scan
  - post-write changed-file self-check
  - pre-push gate
  - fail-closed `pg prod` full scan.
- Added server-private policy reference model where agent sees rule IDs/hints and users do not receive full private policy internals.
- Added prompt-exfiltration/jailbreak protection model:
  - server-side detection (including obfuscated patterns)
  - risk-scored staged response (warn -> restrict -> escalate)
  - manual review before account suspension.
- Added new roadmap/planning item for trigger orchestration + anti-exfil telemetry baseline.

Anchors:
- `.verificaton-before-production-folder/CODING_STANDARDS_POLICY_MERGE_DECISION.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/mastermind.md`

### [2026-02-23 17:18 UTC] - codex
Scope:
- Components: governance-worker-auto-apply-baseline, decision-ack-slack-notify, cli-command-surface
- Files touched: governance scripts + server ack route + memory docs

Summary:
- Added `pg` governance command surface:
  - `governance-login` to persist auth/state for local decision consumer
  - `governance-worker` to pull decision events, execute mapped local commands, and ack outcomes.
- Added local handler baseline script `scripts/governance_action_handler.ps1` and validated end-to-end flow:
  - finalized decision created
  - worker consumed event
  - local command executed
  - ack saved as `applied`.
- Updated `/account/governance/sync/ack` path to send Slack notification when scope add-on is active so approval execution visibility is available in-channel.
- Updated docs and decision log to formalize approval-to-action workflow and command usage.

Anchors:
- `scripts/pg.ps1`
- `scripts/governance_login.ps1`
- `scripts/governance_worker.ps1`
- `scripts/governance_action_handler.ps1`
- `server/src/index.ts`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 13:24 UTC] - codex
Scope:
- Components: db-index-maintenance-diagnostics-gate
- Files touched: new DB maintenance script + pg/prod/enforcement routing + policy/memory docs

Summary:
- Added executable PostgreSQL maintenance diagnostics command:
  - `pg db-index-check`
  - implemented by `scripts/db_index_maintenance_check.ps1` using Prisma raw SQL.
- Added optional strict gate wiring:
  - `pg prod -EnableDbIndexMaintenanceCheck`
  - `pg enforce-trigger -EnableDbIndexMaintenanceCheck`
- Checks currently include:
  - invalid indexes (`DBM-IND-001`, blocker),
  - missing `pg_stat_statements` extension (`DBM-EXT-001`, blocker),
  - sequential scan pressure (`DBM-SCAN-001`, warning),
  - unused non-primary indexes (`DBM-IND-002`, warning),
  - vacuum/analyze lag signals (`DBM-MAINT-001`, warning).
- Verification:
  - `./pg.ps1 help` PASS
  - `./pg.ps1 db-index-check` executed and blocked on real DB findings (`pg_stat_statements` missing) with warnings for unused indexes.
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `scripts/db_index_maintenance_check.ps1`
- `scripts/pg.ps1`
- `scripts/pg_prod.ps1`
- `scripts/enforcement_trigger.ps1`
- `.verificaton-before-production-folder/CODING_STANDARDS_ENFORCEMENT.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`
- `Memory-bank/code-tree/memory-bank-tooling-tree.md`

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

### [2026-02-23 19:32 UTC] - codex
Scope:
- Components: milestone-ordering-lock, enforcement-first-sequencing, extension-native-prereq-gating
- Files touched: roadmap/spec/decision docs + policy merge decision

Summary:
- Locked milestone order so enforcement is not optional:
  - finish Slack closure + Narrate flow validation
  - then execute dependency + coding standards + trigger/anti-exfil baselines
  - only then start extension-native background auto-consumer wiring.
- Added explicit repo-level gate rule: extension-native automation is blocked until enforcement baselines are active and passing in this repo.
- Recorded formal mastermind ruling for this sequence so planning cannot drift.

Anchors:
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/mastermind.md`
- `.verificaton-before-production-folder/CODING_STANDARDS_POLICY_MERGE_DECISION.md`

### [2026-02-23 20:14 UTC] - codex
Scope:
- Components: dependency-verification-baseline-implementation, cli-bridge-wiring
- Files touched: server dependency evaluator + account route + pg wrapper/command docs

Summary:
- Implemented Milestone 10H baseline runtime path:
  - added `server/src/dependencyVerification.ts` with fail-closed dependency policy checks
  - checks include deny-list, native alternatives, pinned-version format, npm registry verification, stale-maintenance checks, vulnerability-severity gates, and compatibility rules (`next/react/node`, `@nestjs/*` majors, `prisma` sync).
- Added authenticated API route:
  - `POST /account/policy/dependency/verify`
  - returns blocker/warning rule IDs and pass/blocked status.
- Added local command bridge:
  - new script `scripts/dependency_verify.ps1`
  - new wrapper command `.\pg.ps1 dependency-verify ...`.
- Verified TypeScript compile and route wiring:
  - `npm run build` passed
  - local runtime probe on isolated port returned `401 missing auth token` for new route (expected for unauthenticated call), confirming route registration.

Anchors:
- `server/src/dependencyVerification.ts`
- `server/src/index.ts`
- `scripts/dependency_verify.ps1`
- `scripts/pg.ps1`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`

### [2026-02-23 21:26 UTC] - codex
Scope:
- Components: pg-prod-dependency-gate-baseline, cli-prod-command-surface
- Files touched: pg wrapper + new prod runner + memory docs

Summary:
- Added real `pg prod` command to `scripts/pg.ps1`.
- Added `scripts/pg_prod.ps1` baseline production runner that:
  - resolves auth token from argument, env, or governance state
  - checks API health
  - runs strict dependency policy verification and fails closed on blockers.
- Marked Milestone 10H baseline as done in roadmap docs and updated command documentation.

Anchors:
- `scripts/pg.ps1`
- `scripts/pg_prod.ps1`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`

### [2026-02-23 22:08 UTC] - codex
Scope:
- Components: feature-additions-roadmap-split, milestone-alignment-core-vs-standalone
- Files touched: feature strategy doc + memory planning/decision docs

Summary:
- Reviewed and classified proposed feature additions into:
  - core extension roadmap (trust/safety aligned)
  - standalone-first candidates (higher maintenance or orthogonal scope).
- Locked roadmap decisions in memory docs:
  - added post-enforcement milestones for Environment Doctor, AI Trust Score, Commit Quality Gate, Codebase Tour, and API Contract Validator.
  - added Milestone 18 packaging gate for standalone spin-outs.
- Added mastermind ruling documenting why split approach is selected to control scope and cost.

Anchors:
- `.verificaton-before-production-folder/FEATURE_ADDITIONS.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/mastermind.md`

### [2026-02-24 00:12 UTC] - codex
Scope:
- Components: feature-additions-technical-draft, trust-score-api-validator-strategy
- Files touched: feature additions doc + roadmap/spec/decision logs

Summary:
- Added concrete MVP implementation draft for:
  - AI Trust Score (policy-based deterministic scoring + rule-ID findings)
  - Commit Quality Gate (conventional commit enforcement + diff-aware suggestions)
  - API Contract Validator (OpenAPI-first with backend parser fallback).
- Marked Milestones 14B/14C/15B as design drafted in roadmap.
- Added mastermind ruling to lock technical direction for trust scoring and contract validation.

Anchors:
- `.verificaton-before-production-folder/FEATURE_ADDITIONS.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/mastermind.md`

### [2026-02-24 01:34 UTC] - codex
Scope:
- Components: coding-standards-verification-baseline, pg-prod-coding-gate, pg-wrapper-runtime
- Files touched: server policy evaluator + account route + CLI scripts + memory docs

Summary:
- Implemented Milestone 10I baseline runtime path:
  - added `server/src/codingStandardsVerification.ts` with profile-aware LOC/function/controller checks and blocker/warning rule IDs
  - added authenticated route `POST /account/policy/coding/verify`.
- Added local command bridge:
  - new script `scripts/coding_verify.ps1`
  - new wrapper command `.\pg.ps1 coding-verify ...`.
- Extended production runner:
  - `scripts/pg_prod.ps1` now executes dependency gate then coding gate and fails closed on blocker findings.
- Updated root `pg.ps1` wrapper to prefer `pwsh` when available for stable argument forwarding.
- Verified build and endpoint behavior:
  - `npm run build` passed
  - coding verification endpoint returned `status: pass` in local JSON-mode runtime using OTP-authenticated token flow.

Anchors:
- `server/src/codingStandardsVerification.ts`
- `server/src/index.ts`
- `scripts/coding_verify.ps1`
- `scripts/pg.ps1`
- `scripts/pg_prod.ps1`
- `pg.ps1`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`

### [2026-02-24 15:27 UTC] - codex
Scope:
- Components: extension-post-write-enforcement, pgpush-preflight-enforcement, governance-worker-default-handler, prompt-guard-e2e-check
- Files touched: extension governance runner + command wiring + worker/start script + memory docs

Summary:
- Added extension-side enforcement runtime:
  - new `extension/src/governance/postWriteEnforcer.ts` (debounced save-hook calls to `pg enforce-trigger -Phase post-write`)
  - new `extension/src/governance/powerShellRunner.ts` (`pwsh` with Windows PowerShell fallback).
- Updated extension command behavior:
  - `extension/src/commands/pgPush.ts` now runs enforcement preflight (`enforce-trigger -Phase pre-push`) before git push.
  - added new extension settings for post-write/pre-push enforcement control in `extension/package.json`.
  - wired save-hook in `extension/src/extension.ts`.
- Updated worker/runtime scripts:
  - `scripts/governance_worker.ps1` now defaults to `scripts/governance_action_handler.ps1` when explicit decision commands are not supplied.
  - worker now uses `pwsh` when available and marks dry-run as `skipped`.
  - `scripts/start_memory_bank_session.ps1` now prints actual enforcement mode value.
- Local verification completed:
  - health + slack health checks passed on local runtime
  - prompt guard route returned blocked status for exfil/jailbreak sample prompt
  - created/voted/finalized mastermind thread, ran governance worker once, and confirmed `sync/pull` ack status became `applied`.

Anchors:
- `extension/src/governance/postWriteEnforcer.ts`
- `extension/src/governance/powerShellRunner.ts`
- `extension/src/commands/pgPush.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `scripts/governance_worker.ps1`
- `scripts/start_memory_bank_session.ps1`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`

### [2026-02-24 16:27 UTC] - codex
Scope:
- Components: extension-governance-autosync-doc-closure, milestone-10k-memory-finalization
- Files touched: memory docs + mastermind decision log + required generators

Summary:
- Finalized Milestone 10K documentation coverage for extension-native governance auto-consumer:
  - documented new command `Narrate: Governance Sync Now`
  - documented new runtime `extension/src/governance/decisionSyncWorker.ts`
  - documented governance auto-sync settings in tools reference.
- Added mastermind decision log entry for 10K rollout mode (manual-only vs auto-sync loop + manual command hybrid).
- Completed required end-of-session generation checks:
  - `python scripts/build_frontend_summary.py`
  - `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`.
- Re-validated extension compile to keep 10K baseline in a build-clean state.

Anchors:
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/mastermind.md`
- `Memory-bank/daily/2026-02-24.md`

### [2026-02-24 19:12 UTC] - codex
Scope:
- Components: governance-playbook-binding-runtime, local-approval-to-action-e2e
- Files touched: governance worker/router scripts + playbook + memory docs

Summary:
- Added allowlisted governance action playbook runtime:
  - new `scripts/governance_action_playbook.json`
  - worker now resolves command by thread binding (`thread_id -> action_key`) with fallback chain.
- Added binding manager:
  - new `scripts/governance_bind_action.ps1`
  - new `pg governance-bind` command (`add/update/list/remove`).
- Enhanced default action handler:
  - still logs execution
  - now appends structured queue records to `Memory-bank/_generated/governance-agent-queue.jsonl` for local agent consumption.
- Executed e2e proof with temporary local JSON runtime:
  - create thread -> bind action key -> vote/decide -> worker once
  - result confirmed `ack_status=applied` with note containing `source=binding.playbook, action_key=default-handler`
  - queue file shows event entry.

Anchors:
- `scripts/governance_worker.ps1`
- `scripts/governance_bind_action.ps1`
- `scripts/governance_action_playbook.json`
- `scripts/governance_action_handler.ps1`
- `scripts/pg.ps1`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/daily/2026-02-24.md`

### [2026-02-24 21:00 UTC] - codex
Scope:
- Components: command-help-center-roadmap, governance-onboarding-ux-docs
- Files touched: planning/spec/decision docs + feature strategy note

Summary:
- Added new roadmap item `Milestone 10L (Command Help Center + troubleshooting UX)` to reduce setup/operator confusion.
- Updated spec with a dedicated flow for command-help usage:
  - quickstart commands (`pg start/status/end`)
  - governance command runbook (`governance-login/bind/worker`)
  - Slack decision grammar + expected outputs + troubleshooting matrix.
- Added mastermind ruling to lock delivery timing (build help page next, not post-final).
- Updated feature strategy ordering to include Command Help Center in core track.

Anchors:
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/mastermind.md`
- `.verificaton-before-production-folder/FEATURE_ADDITIONS.md`

### [2026-02-24 22:54 UTC] - codex
Scope:
- Components: local-dev-profile-safety, secret-guard-hardening, command-help-clarity
- Files touched: dev profile + guard + docs

Summary:
- Hardened local dev-profile workflow:
  - fixed command hints to use real flags (`-Secret -Prompt`)
  - added gitignore policy check so profile must remain local/untracked.
- Added commit-time doc secret scan:
  - `memory_bank_guard.py` now scans staged Memory-bank/verification docs for likely real secrets/private key blocks and blocks commit on detections.
- Updated `pg help` examples to avoid `<...>` placeholder syntax that causes PowerShell parser errors.
- Updated Memory-bank docs to define dev-only credential boundary and operator commands.

Anchors:
- `scripts/dev_profile.ps1`
- `scripts/memory_bank_guard.py`
- `scripts/pg.ps1`
- `scripts/start_memory_bank_session.ps1`
- `Memory-bank/tools-and-commands.md`

### [2026-02-24 23:59 UTC] - codex
Scope:
- Components: command-help-center-sidebar, extension-help-command-surface
- Files touched: extension help provider/content + manifest + docs

Summary:
- Implemented Command Help Center sidebar baseline in extension:
  - new activity bar container `Narrate Help`
  - new webview view `narrate.commandHelpView`
  - new command `Narrate: Open Command Help`.
- Added concrete runbook content in the help view:
  - local quickstart (`pg start/status/dev-profile`)
  - governance sync flow (`governance-login/bind/worker`)
  - Slack decision grammar (`thread/vote/decide/summary`)
  - troubleshooting table for real observed failures.
- Updated Memory-bank structure/tree/spec/plan/decision logs to reflect milestone 10L in-progress baseline.

Anchors:
- `extension/src/help/commandHelpViewProvider.ts`
- `extension/src/help/commandHelpContent.ts`
- `extension/src/commands/openCommandHelp.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `Memory-bank/project-details.md`

### [2026-02-25 00:31 UTC] - codex
Scope:
- Components: help-center-diagnostics-command, one-click-setup-validation
- Files touched: diagnostics command + help content + command registry + docs

Summary:
- Added `Narrate: Run Command Diagnostics` command.
- Diagnostics now run one-click checks for:
  - backend `/health`
  - Slack integration health
  - local dev-profile readiness
  - governance worker one-shot path.
- Added Help Center diagnostics section and wired command into view title toolbar for `narrate.commandHelpView`.
- Command opens a markdown report with pass/fail results and actionable fix hints.

Anchors:
- `extension/src/commands/runCommandDiagnostics.ts`
- `extension/src/help/commandHelpContent.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `Memory-bank/project-details.md`
### [2026-02-25 01:55 UTC] - codex
Scope:
- Components: slack-launch-validation-10f, help-center-command-grammar-fix, governance-worker-ack-verification
- Files touched: extension help content + memory docs + governance validation runtime

Summary:
- Completed local 10F validation matrix with real runtime state/token:
  - created fresh mastermind thread via API
  - voted + finalized decision
  - bound thread to `default-handler`
  - ran `pg governance-worker -Once`
  - confirmed sync event ack transitioned to `applied`.
- Verified signed Slack endpoints locally:
  - signed slash-command `help` path returns command grammar from `/integrations/slack/commands`
  - signed interactive action path applies vote and decision updates through `/integrations/slack/actions`.
- Fixed help-command grammar mismatch that caused operator confusion:
  - changed vote example from label (`approve`) to key (`opt1`)
  - changed decide example to use valid option key
  - added troubleshooting note that `/pg` must be first token in Slack composer.
- Replaced remaining governance bind examples in Memory docs to avoid `<THREAD_ID>` parser errors.

Anchors:
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 13:02 UTC] - codex
Scope:
- Components: coding-policy-db-query-optimization-enforcement
- Files touched: server coding verifier + coding scan script + policy docs + memory docs

Summary:
- Added deterministic DB query optimization enforcement to server coding policy evaluator:
  - `COD-DBQ-001`: `SELECT *` blocker.
  - `COD-DBQ-002`: N+1 loop + DB call blocker.
  - `COD-DBQ-003`: deep `OFFSET` blocker (>= 1000).
  - `COD-DBQ-004`: `OFFSET` usage warning.
  - `COD-DBQ-005`: non-SARGable `WHERE` warning.
  - `COD-DBQ-006`: `HAVING` without aggregate signal warning.
  - `COD-DBI-001`: Prisma foreign-key-like field (`*Id`) without index blocker.
- Expanded default coding scan roots to include schema/query surfaces:
  - added `server/prisma` root,
  - allowed `.sql` and `.prisma` file extensions.
- Synced policy and Memory-bank docs to reflect enforced query/index standards.
- Verification:
  - `npm run build` (server) PASS
  - `./pg.ps1 help` PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `server/src/codingStandardsVerification.ts`
- `scripts/coding_verify.ps1`
- `.verificaton-before-production-folder/CODING_STANDARDS_ENFORCEMENT.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/mastermind.md`

### [2026-02-25 03:32 UTC] - codex
Scope:
- Components: slack-transport-closure-command, pg-router-wiring, 10f-runbook-update
- Files touched: pg router + slack transport script + help/docs/memory updates

Summary:
- Wired one-shot command `.\pg.ps1 slack-check` into `scripts/pg.ps1`.
- Fixed parsing/runtime issues in `scripts/slack_transport_check.ps1` and improved report details for bind/worker steps.
- Added command help surface entry and tools runbook documentation for the new closure command.
- Verified command behavior:
  - local mode with `-SkipPublicChecks`: PASS 12 / FAIL 0
  - full mode with public checks: local checks pass, public checks fail when external socket/tunnel path is unavailable.
- Report output is now standardized at:
  - `Memory-bank/_generated/slack-transport-check-latest.md`.

Anchors:
- `scripts/pg.ps1`
- `scripts/slack_transport_check.ps1`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`
- `Memory-bank/code-tree/memory-bank-tooling-tree.md`

### [2026-02-25 08:46 UTC] - codex
Scope:
- Components: narrate-flow-closure-command, milestone-10g-baseline, help-runbook-update
- Files touched: pg router + new narrate flow checker script + docs

Summary:
- Added one-shot command `.\pg.ps1 narrate-check` by wiring new script `scripts/narrate_flow_check.ps1` into `scripts/pg.ps1`.
- Implemented PASS/FAIL matrix checks for:
  - required command IDs in `extension/package.json`
  - runtime registration markers in `extension/src/extension.ts`
  - core flow source file presence
  - extension compile (`npm run compile`).
- Verified command execution:
  - `pg narrate-check` => PASS 4 / FAIL 0.
- Updated Help Center and memory docs to mark 10G as in-progress with automated baseline.

Anchors:
- `scripts/narrate_flow_check.ps1`
- `scripts/pg.ps1`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`
- `Memory-bank/code-tree/memory-bank-tooling-tree.md`

### [2026-02-25 08:58 UTC] - codex
Scope:
- Components: diagnostics-10g-integration
- Files touched: diagnostics command plan list + help content + spec note

Summary:
- Extended `Narrate: Run Command Diagnostics` to include:
  - `pg narrate-check -SkipCompile` baseline validation step.
- Updated Help Center diagnostics section to mention Narrate flow baseline check.
- Updated Flow 10 spec text to reflect new diagnostics coverage.

Anchors:
- `extension/src/commands/runCommandDiagnostics.ts`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-spec.md`

### [2026-02-25 15:28 UTC] - codex
Scope:
- Components: slack-check-ack-recovery, milestone-closure-command, help-runbook-update
- Files touched: slack/narrate closure tooling + pg router + help content + memory docs

Summary:
- Hardened `scripts/slack_transport_check.ps1`:
  - fixed account summary extraction (`account.email`, `plan`)
  - added automatic worker-cursor recovery when ack stays `pending`:
    - reset cursor to event sequence window
    - rerun worker once
    - re-pull and verify ack state.
- Added new combined closure command:
  - `scripts/milestone_closure_check.ps1`
  - routed via `.\pg.ps1 closure-check`
  - runs `pg slack-check` + `pg narrate-check` and writes single consolidated report.
- Updated Help Center quickstart content to include `pg closure-check`.
- Verified:
  - `pg slack-check -SkipPublicChecks` => PASS 12 / FAIL 0
  - `pg narrate-check` => PASS 4 / FAIL 0
  - `pg closure-check -SkipPublicChecks` => overall PASS.

Anchors:
- `scripts/slack_transport_check.ps1`
- `scripts/milestone_closure_check.ps1`
- `scripts/pg.ps1`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`

### [2026-02-25 17:18 UTC] - codex
Scope:
- Components: closure-gate-modes, local-core-progression-unblock
- Files touched: milestone closure checker + pg router + docs

Summary:
- Added explicit closure gate modes to `pg closure-check`:
  - `strict` (default): requires full public + local checks.
  - `local-core`: requires local governance chain + Narrate checks and ignores tunnel/public-only failures.
- Updated closure evaluation logic to require these local core Slack steps in `local-core` mode:
  - local health, local Slack health, token, thread create, vote, decide, bind, worker, ack.
- Verified run:
  - `.\pg.ps1 closure-check -ClosureMode local-core ...` => overall PASS
    even when strict mode fails due Cloudflare `530`.
- Updated Help/Memory docs to document mode usage and milestone interpretation.

Anchors:
- `scripts/milestone_closure_check.ps1`
- `scripts/pg.ps1`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`



### [2026-02-26 00:18 UTC] - codex
Scope:
- Components: reading-view-line-mapping, runtime-ui-toggles, pg-root-resolution
- Files touched: reading renderer/provider + command surface + diagnostics/governance/enforcement script resolution + docs

Summary:
- Implemented dual reading view modes with explicit behavior:
  - `exact` (default): one rendered line per source line for strict line mapping.
  - `section`: grouped summaries with explicit `Source L<N>` labels.
- Added runtime UX controls (toolbar + status bar + commands):
  - set mode (`Dev`/`Edu`)
  - switch view (`exact`/`section`)
  - switch pane (`sideBySide`/`fullPage`)
  - refresh reading view from source or narrate tab context.
- Added session-aware narration reopen logic so toggles work when focus is on `narrate://` documents.
- Added repo-root resolver utility and wired it into:
  - command diagnostics (`pg.ps1` discovery)
  - governance decision sync worker
  - post-write enforcer
  - PG push preflight enforcement.
- Diagnostics now include resolved repo root and resolved `pg.ps1` path for actionable failures.
- Verified local closure scripts remain green after wiring updates:
  - `pg narrate-check` PASS
  - `pg closure-check -ClosureMode local-core -SkipPublicChecks` PASS.

Anchors:
- `extension/src/readingView/renderNarration.ts`
- `extension/src/readingView/narrateSchemeProvider.ts`
- `extension/src/commands/switchReadingViewMode.ts`
- `extension/src/commands/switchReadingPaneMode.ts`
- `extension/src/commands/refreshReadingView.ts`
- `extension/src/commands/setNarrationMode.ts`
- `extension/src/utils/repoRootResolver.ts`
- `extension/src/commands/runCommandDiagnostics.ts`
- `extension/src/governance/decisionSyncWorker.ts`
- `extension/src/governance/postWriteEnforcer.ts`
- `extension/src/commands/pgPush.ts`
- `extension/src/extension.ts`
- `extension/package.json`

### [2026-02-26 00:44 UTC] - codex
Scope:
- Components: scalability-architecture-policy-placement, milestone-wiring
- Files touched: verification docs + project policy/milestone docs

Summary:
- Ingested and placed scalability architecture guide into enforcement folder:
  - `.verificaton-before-production-folder/SCALABILITY_ARCHITECTURE_GUIDE.md`.
- Added formal placement decision and runtime rule to architecture decisions doc:
  - ask-before-build discovery gate for real-time/async/comms features.
- Added milestone tracking for rollout:
  - `Milestone 10N (Scalability architecture discovery gate)` in project-details.
- Updated project spec and policy docs to require:
  - discovery questions,
  - options/rejection rationale,
  - explicit user confirmation before implementation for architecture-affecting work.
- Updated tools/commands memory doc to include scalability intake workflow reference.

Anchors:
- `.verificaton-before-production-folder/SCALABILITY_ARCHITECTURE_GUIDE.md`
- `.verificaton-before-production-folder/ARCHITECTURE_DECISIONS.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/mastermind.md`

### [2026-02-26 13:20 UTC] - codex
Scope:
- Components: edu-narration-clarity, exact-line-label-clarity, command-help-view-runtime
- Files touched: narration engine/post-processing + reading renderer + package view contribution + memory docs

Summary:
- Fixed EDU narration drift caused by cached lines bypassing updated educational rewriting:
  - cached narrations now always pass through `postProcessNarration(...)`, so current EDU rules apply consistently.
- Strengthened EDU narration shaping for beginners:
  - generic/code-echo narration detection now rewrites to plain-English explanations.
  - enforced beginner-oriented explanation depth and stable `Example:` inclusion.
  - retained 20-30 word target cap behavior for non-blank educational output.
- Improved exact-mode line reference clarity by zero-padding source line refs (`L01`, `L10`, ...), reducing ambiguity for multi-digit lines.
- Fixed Command Help container wiring edge case by declaring help view as explicit `webview` contribution.
- Verified build + flow checks:
  - `npm run compile` PASS
  - `.\pg.ps1 narrate-check` PASS

Anchors:
- `extension/src/narration/narrationEngine.ts`
- `extension/src/narration/termMemory.ts`
- `extension/src/readingView/renderNarration.ts`
- `extension/package.json`

### [2026-02-26 03:03 UTC] - codex
Scope:
- Components: edu-beginner-depth-v2, exact-prefix-clarity, toolbar-short-labels
- Files touched: narration prompt/memory shaping + exact renderer + command labels + memory docs

Summary:
- Strengthened EDU rewriting so beginner output stays plain and deeper:
  - strips generic phrases more aggressively (`code statement`, `blank line`, etc.).
  - raises minimum explanation depth for non-blank lines before truncation.
  - improves examples and avoids punctuation artifacts.
  - increases code-echo detection sensitivity so token restatements are rewritten.
- Updated exact reading row prefix to bracketed format (`[L01] ... => ...`) to make source-line mapping visually clearer.
- Added short command titles (`Dev`, `Edu`, `View`, `Pane`, `Refresh`) so editor title controls are easier to use as real toggles.
- Verified:
  - `npm run compile` PASS
  - `.\pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/narration/termMemory.ts`
- `extension/src/narration/promptTemplates.ts`
- `extension/src/readingView/renderNarration.ts`
- `extension/package.json`

### [2026-02-26 21:40 UTC] - codex
Scope:
- Components: edu-beginner-clarity-v3, exact-line-readability-format
- Files touched: EDU narration shaping + exact reading renderer + memory docs

Summary:
- Strengthened EDU-mode narration output for absolute beginners:
  - simpler wording in type/interface/property explanations.
  - stronger rewrite trigger when narration looks syntax-heavy or code-token-like.
  - deeper non-blank minimum depth before final 30-word cap.
  - safer truncation behavior so examples remain readable and do not end with broken tails.
- Updated exact-mode line rendering for clearer visual mapping:
  - switched from bracketed format to `LNN | source -> narration`.
- Verified core checks after patch:
  - `npm run compile` PASS
  - `.\pg.ps1 narrate-check -SkipCompile` PASS
  - `.\pg.ps1 closure-check -ClosureMode local-core -SkipPublicChecks` PASS

Anchors:
- `extension/src/narration/termMemory.ts`
- `extension/src/narration/promptTemplates.ts`
- `extension/src/readingView/renderNarration.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`

### [2026-02-26 18:01 UTC] - codex
Scope:
- Components: edu-detail-level-v4, full-beginner-mode, exact-snippet-choice
- Files touched: reading renderer + mode state + command toggle cycle + provider parsing + package command/config + memory docs

Summary:
- Added optional third EDU depth level for absolute beginners:
  - `standard` (concise), `beginner` (plain 20-30 words), and `fullBeginner` (deeper plain-English + analogy).
- Kept strict line mapping in exact mode while preserving user choice for repeated code text:
  - `withSource`: `LNN | source -> narration`
  - `narrationOnly`: `LNN | narration`.
- Updated command/state/config plumbing so the Explain toggle cycles all 3 EDU levels across status bar, editor toolbar, URI/session state, and defaults.
- Verified runtime quality gates:
  - `npm run compile` PASS
  - `.\pg.ps1 narrate-check` PASS
  - `.\pg.ps1 closure-check -ClosureMode local-core -SkipPublicChecks` PASS

Anchors:
- `extension/src/types.ts`
- `extension/src/commands/modeState.ts`
- `extension/src/commands/switchEduDetailLevel.ts`
- `extension/src/readingView/renderNarration.ts`
- `extension/src/readingView/narrateSchemeProvider.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`

### [2026-02-26 22:15 UTC] - codex
Scope:
- Components: environment-doctor-baseline, command-surface-wiring
- Files touched: new extension command + command registry + package/help + memory docs

Summary:
- Added baseline `Narrate: Run Environment Doctor` command.
- Implemented deterministic workspace scan for env-variable references:
  - `process.env.*` and `import.meta.env.*` patterns.
- Implemented `.env` and `.env.example` parsing plus diff outputs:
  - missing in `.env`
  - missing in `.env.example`
  - unused keys in `.env`.
- Added safety-focused checks in report:
  - potentially exposed public-secret env keys (`NEXT_PUBLIC_*`/`VITE_*` + sensitive-name heuristic)
  - simple value type mismatch hints for number/boolean-like keys.
- Command opens markdown report and shows summary notification.
- Verified:
  - `npm run compile` PASS
  - `.\pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/runEnvironmentDoctor.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/structure-and-db.md`

### [2026-02-26 23:05 UTC] - codex
Scope:
- Components: environment-doctor-quick-fix, trust-score-baseline
- Files touched: env doctor command, trust score service, extension wiring, package/help/memory docs

Summary:
- Added Environment Doctor quick-fix command:
  - `Narrate: Environment Doctor Quick Fix (.env.example)`
  - appends missing referenced env keys to `.env.example` as `__REQUIRED__`.
- Added report-action shortcut:
  - `Narrate: Run Environment Doctor` now offers `Quick Fix .env.example` when missing example keys are detected.
- Implemented Trust Score baseline (Milestone 14B start):
  - new deterministic on-save scanner service with rule-ID findings.
  - scoring model: blockers/warnings -> `Trust: N/100` status-bar signal.
  - new report command: `Narrate: Show Trust Score Report`.
  - includes TS diagnostics, empty catch, console usage, large-function, and potential hardcoded-secret checks.
- Verified:
  - `npm run compile` PASS
  - `.\pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/runEnvironmentDoctor.ts`
- `extension/src/trust/trustScoreService.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`

### [2026-02-27 00:10 UTC] - codex
Scope:
- Components: trust-score-standards-enforcement, trust-score-panel-ux
- Files touched: trust score service/view provider + extension/package/help wiring + memory docs

Summary:
- Upgraded Trust Score from baseline heuristics to standards-enforcement checks in extension runtime.
- Added policy rules to local evaluator:
  - absolute file cap blocker at 500 LOC,
  - component target/hard limits (including controller hard cap 150),
  - controller anti-pattern blockers (branching complexity, try/catch, direct data-access references),
  - function target/hard thresholds,
  - existing TS diagnostics + security/code-hygiene findings.
- Added Trust Score UX panel (`narrate.trustScoreView`) with:
  - visible score/grade/status summary,
  - findings list with click-to-file navigation,
  - view-title quick actions (refresh, toggle, report).
- Added commands and settings:
  - `Narrate: Open Trust Score Panel`
  - `Narrate: Toggle Trust Score`
  - `Narrate: Refresh Trust Score`
  - `narrate.trustScore.autoRefreshOnSave`
- Verification:
  - `npm run compile` PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/trust/trustScoreService.ts`
- `extension/src/trust/trustScoreViewProvider.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 00:40 UTC] - codex
Scope:
- Components: trust-gated-pg-push, strict-relaxed-toggle-enforcement
- Files touched: pgPush command + extension wiring + package/help + memory docs

Summary:
- Added Trust Score gate to `Narrate: PG Push` with configurable mode:
  - `off`: no trust gate.
  - `relaxed`: warns and requires explicit "Continue Push" confirmation when trust is blocking/red or unavailable.
  - `strict`: blocks push when trust is red/blocking, disabled, or unavailable.
- Added new setting:
  - `narrate.trustScore.pgPushGateMode` (`off|relaxed|strict`, default `off`).
- Wired PG push command registration to receive trust service context.
- Updated command help copy and Memory-bank docs for gate behavior and rollout intent.
- Verification:
  - `npm run compile` PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/pgPush.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 01:05 UTC] - codex
Scope:
- Components: zod-validation-enforcement-baseline, runtime-input-safety-gate
- Files touched: trust score service + server coding policy + memory docs

Summary:
- Added missing input-validation blocker detection in extension Trust Score:
  - detects controller/route input surfaces (`req/request body/query/params`, `request.json`, route handlers)
  - blocks when no schema-validation signal is found (Zod or equivalent).
- Added matching missing validation blocker in server coding-standards verifier:
  - rule id `COD-VAL-001` for controller/route input handling without validation.
