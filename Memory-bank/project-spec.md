# Project Spec - Intent, Actors, Flows

LAST_UPDATED_UTC: 2026-02-27 21:30
UPDATED_BY: codex

## Purpose
Build a local-first VS Code extension (`Narrate`) that helps developers and learners understand source code line-by-line, generate change prompts for coding agents, and enforce licensing/module entitlements through a local backend milestone implementation.

## Scope
- In-scope:
  - VS Code extension with Reading Mode (dev + edu).
  - Line-level narration engine with OpenAI-compatible provider integration.
  - Local fallback narration when provider is not configured.
  - Local incremental cache for narrations.
  - Prompt handoff command for “request change”.
  - Export/report Pro-gated commands.
  - Local `PG Push` command path for guarded git add/commit/push from extension.
  - Licensing backend mode in extension:
    - email sign-in
    - GitHub sign-in (loopback callback)
    - trial/redeem/refresh/status/quota/device commands
    - upgrade checkout command that opens browser flow
  - Local Fastify licensing backend routes for entitlement, trial, refund, checkout/webhook, offline/redeem, affiliate, team seats, provider policy administration.
  - Prisma schema + PostgreSQL table provisioning for licensing domain (`narate_enterprise` schema).
  - Dedicated admin/operator RBAC data model (`admin_*` tables) separated from customer `users`.
  - Hosted web experience served by backend:
    - marketing + pricing + supported platform messaging at `/`
    - secure sidebar portal at `/app`
    - web email/GitHub/Google sign-in helper flow
    - signed-in account dashboard (summary + billing history)
    - support ticket + feedback submission from web
    - team owner/manager self-service controls (seat assignment/revoke + provider policy)
    - super-admin board (users, subscriptions, payments, support queue)
    - terms/privacy + checkout status pages
  - Security hardening controls:
    - `HttpOnly` cookie-based web sessions with secure/samesite controls
    - auth endpoint rate limiting for OTP/OAuth start
    - email OTP toggle/disable support and dev-code exposure toggle
    - super-admin resolution from DB (`admin_accounts`) with env fallback mode
    - DB-backed admin RBAC permission checks on privileged `/pg-global-admin/*` routes
    - configurable admin route namespace (`ADMIN_ROUTE_PREFIX`) and optional Cloudflare Access JWT gate for admin APIs
    - startup RBAC baseline seeding for admin permissions/roles/initial super-admin account mapping
    - hardened admin route namespace (`/pg-global-admin/*`)
  - Governance baseline (implemented in JSON runtime):
    - PG End-of-Day (EOD) report workflow for agents + developers
    - PG Mastermind debate/decision workflow with reviewer voting and final rulings
    - local decision-sync bridge so server decisions are pulled/acked by local clients
    - local governance worker commands (`pg governance-login`, `pg governance-worker`, `pg governance-bind`) to auto-apply approved decisions via allowlisted action playbook bindings and ack execution back to server
    - scope-level governance settings (vote mode, retention, Slack add-on toggle)
  - Slack integration (signed command bridge + outbound notifications):
    - signed slash-command intake (`/integrations/slack/commands`)
    - signed interactive action intake (`/integrations/slack/actions`)
    - slash command actions (`summary`, `eod`, `thread`, `vote`, `decide`)
    - interactive action buttons for vote + decision finalize
    - action ingress now fast-acks every click and executes authorization + state mutation asynchronously
    - interaction cards now render role-aware controls (voter controls vs reviewer finalize controls) with explicit workflow labels
    - optional outbound dispatch to Slack channel/webhook when scope add-on is active
    - remaining phase: richer workflow commands + enterprise-specific reviewer orchestration policy
  - Dependency verification baseline API:
    - authenticated route `POST /account/policy/dependency/verify`
    - fail-closed blocker output with rule IDs
    - npm official registry lookup + deny-list/native-alternative/compatibility checks
  - Coding standards verification baseline API:
    - authenticated route `POST /account/policy/coding/verify`
    - profile-aware LOC/function/controller structure checks with blocker/warning rule IDs
    - query-optimization enforcement checks (`SELECT *`, N+1 loops, deep `OFFSET`, non-SARGable `WHERE`, and Prisma FK-index signals)
    - fail-closed blocker output for production gating
  - Prompt exfiltration guard baseline API:
    - authenticated route `POST /account/policy/prompt/guard`
    - risk-scored allow/warn/block output with opaque rule IDs for jailbreak/policy-exfil attempts
  - MCP cloud scoring bridge baseline API:
    - authenticated route `POST /account/policy/mcp/cloud-score`
    - metadata-only scanner intake (status/counts/rule IDs) + cloud architecture context intake
    - deterministic score/grade/status output with rule IDs for network, secrets, IAM, monitoring, DR, and cost/provider guardrails
    - workload sensitivity profiles (`standard`, `regulated`) for stricter regulated enforcement
  - Self-hosted observability adapter baseline:
    - authenticated route `POST /account/policy/observability/check`
    - adapter scaffold coverage for `none|otlp|sentry|signoz` with deterministic blocker/warning findings
    - deployment profile split (`pg-hosted` default, optional `customer-hosted`/`hybrid`) for enterprise BYOC/on-prem without vendor lock-in
    - integration model is protocol/SDK-based (OpenTelemetry/Sentry/SigNoz-compatible endpoints), not vendor-locked hosted API dependence
  - Cloud architecture boundary alignment baseline:
    - explicit split between local agent/tool checks, server-private policy logic, MCP metadata scoring, and optional managed enterprise observability services
    - external architecture docs are used as policy sources, but only approved controls/rule IDs are exposed in runtime outputs
  - `pg` CLI production baseline:
    - `pg prod` command now runs strict dependency + coding verification and hard-fails on blocker findings
    - `pg prod` now supports rollout profiles:
      - `legacy`: dependency + coding only
      - `standard` (default): dependency + coding + API contract + DB index maintenance
      - `strict`: standard + Playwright smoke
    - explicit flags (`-EnableApiContractCheck`, `-EnableDbIndexMaintenanceCheck`, `-EnablePlaywrightSmokeCheck`) still force each check on.
    - `pg` CLI now includes DB remediation planner commands (`db-index-fix-plan`, `db-index-remediate`) that generate explicit SQL checklists from live DB findings.
  - Enforcement trigger baseline:
    - `enforce-trigger` script/command supports `start-session`, `post-write`, and `pre-push` phases
    - start-session trigger is wired into `pg start`
    - extension save-hook now runs post-write trigger (debounced, configurable warn/block behavior)
    - extension `Narrate: PG Push` command now runs pre-push trigger preflight before git push
    - pre-push git hook is wired to fail-closed unless bypass env is explicitly set
  - Local dev profile baseline:
    - `pg dev-profile` command family for local-only runtime/test credential map (`init`, `check`, `set`, `get`, `list`, `remove`)
    - default profile path `.narrate/dev-profile.local.json` (gitignored)
    - startup warning when required local dev fields are missing, to reduce agent retry loops
  - Extension-native governance auto-consumer baseline:
    - background poll loop in extension invokes local worker (`pg governance-worker -Once`) on configurable interval
    - manual command `Narrate: Governance Sync Now` triggers immediate sync/apply/ack cycle
    - uses existing local-first execution path and server audit via decision ack route
  - Command Help Center baseline:
    - extension sidebar container `Narrate Help` with webview guide for `pg` + Slack governance workflows
    - command palette entry `Narrate: Open Command Help` to focus help view quickly
    - command palette entry `Narrate: Run Command Diagnostics` for one-click local health/token/worker checks with saved markdown+JSON artifacts under `Memory-bank/_generated/`
    - includes DB index maintenance remediation runbook with copy/paste command flow and terminal troubleshooting for common student/operator errors
    - CLI one-shot closure command `pg slack-check` to print PASS/FAIL matrix and write markdown report for Slack transport/governance flow
    - CLI one-shot closure command `pg narrate-check` to print PASS/FAIL matrix and write markdown report for Narrate core flow wiring/compile validation
    - CLI combined closure command `pg closure-check` to execute both checks and emit a single milestone go/no-go report
    - built-in troubleshooting map for common local/Slack failure signatures
  - Runtime store backend mode:
    - `STORE_BACKEND=json` for local file store
    - `STORE_BACKEND=prisma` for live Postgres table-by-table persistence (`narate_enterprise.*`)
  - Runtime `.env` loading for backend OAuth/checkout configuration (`dotenv/config`).
  - Cloudflare tunnel bootstrap script for temporary demos and named domain ingress.
  - Provider policy enforcement for configured LLM endpoint in extension.
  - Memory-bank enforced workflow for this repo.
  - Planned post-current-milestone production-readiness enforcement track:
    - cloud-first scoring and policy evaluation for Free/Student/Team tiers with metadata-only scan payloads
    - strict split between generic local agent instructions and private server-side policy/rule logic
    - scalability architecture discovery gate before implementation for real-time/async/communication features:
      - mandatory discovery questions (expected concurrency/growth, channel direction, latency target, async job need, framework, greenfield vs existing infra)
      - mandatory options analysis with explicit rejection rationale for non-scalable defaults
      - mandatory user confirmation before code generation for architecture-affecting decisions
    - server-side dependency verification enforcement using official registry checks, deprecated deny-list, compatibility matrix, vulnerability thresholds, and activity/maintenance checks
    - server-private coding-standards enforcement with framework profiles and opaque rule IDs (client sees violations/hints, not full private policy corpus)
    - mandatory enforcement hooks: start-of-session baseline scan, post-write self-check, pre-push gate, and fail-closed `pg prod` full scan
    - server-side prompt-exfiltration/jailbreak detection for policy bypass attempts with audit and risk-based response controls
    - `pg` CLI lifecycle baseline shipped (`login`, `update`, `doctor`, `prod`) with entitlement-aware local profile sync and recommended prod-profile handoff; further command gating hardening remains iterative
    - `pg prod` hard-fail gate for dependency violations (deprecated package, incompatible version, vulnerable dependency, missing pinned range)
    - `pg prod` hard-fail gate for coding-standard blocker violations (controller/business-logic mixing, missing validation, excessive structural complexity)
    - sequencing lock: extension-native background automation starts only after dependency + coding + trigger guardrail milestones are active and passing on this repo
    - optional enterprise-only offline encrypted policy pack after cloud-first path is stable
  - Planned product-growth track (after enforcement baseline):
    - core extension modules:
      - Command Help Center (sidebar/web command guide for `pg` + Slack governance + troubleshooting)
      - Environment Doctor (missing/unused/exposed env validation)
      - AI Trust Score (status-bar trust signal from deterministic checks + policy rule-ID findings)
      - Commit Quality Gate (conventional commit enforcement + diff-aware suggestions)
      - Codebase Tour Generator baseline (guided markdown architecture onboarding map; graph/webview enhancement planned)
      - API Contract Validator baseline (OpenAPI-first JSON + backend-inference fallback mismatch detection with rule IDs; deeper schema/wrapper coverage planned)
    - standalone-first candidates (separate extension/add-on path):
      - Dead Code Cemetery
      - One-Click Project Setup bootstrap
      - Tech Debt Counter with cost reporting
- Out-of-scope (current phase):
  - Full runtime cutover from JSON store to Prisma persistence in API handlers.
  - Production infrastructure migration (NestJS service split, managed secrets, operational dashboards).
  - Full seat-management UI in extension (backend-admin routes exist).
  - WhatsApp/Telegram remote orchestration.
  - Dedicated private mobile reviewer app (post-MVP phase).
  - Full PG module runtime implementation inside this repo.
  - Production-readiness package rollout before Slack gateway closure and Narrate flow completion validation.

## Actors
| Actor | Capabilities | Notes |
|---|---|---|
| Individual developer | Reads narration, exports/reports with entitlement, requests code changes | Primary MVP user |
| Non-technical learner | Uses Edu mode and 48h trial flow | Free -> sign-in/trial upgrade path |
| Team/enterprise admin | Approves refunds/offline payments/payouts, manages seats/policies via admin API | Extension UI for team admin still pending |
| Senior reviewer / supervisor | Reviews PG EOD and PG Mastermind debates; issues final decisions | Governance and quality-control actor |
| Web buyer / evaluator | Uses landing page for sign-in, checkout, offline proof, redeem | Browser-first purchase and onboarding path |
| AI coding agent | Consumes generated prompt handoff | Prompt output copied to clipboard |

## Core Flows
### Flow 1: Reading Mode
1. User opens source file and runs `Narrate: Toggle Reading Mode (Dev|Edu)`.
2. For Edu mode, feature gate checks entitlement; backend mode can auto-attempt trial start for eligible signed-in users.
3. Extension generates/loads line narrations (cache first; provider/fallback for misses).
4. Extension opens `narrate://` virtual document beside source.

### Flow 2: Licensing + Checkout
1. User signs in (`Narrate: Sign In (Email|GitHub)`).
2. User runs `Narrate: Upgrade Plan (Checkout)` if upgrade is needed.
3. Extension calls backend checkout-session route and opens Stripe checkout URL in browser.
4. Stripe webhook updates entitlement; extension refresh command syncs plan/features.

### Flow 3: Redeem / Offline / Affiliate
1. Offline/admin flow can issue redeem code after payment validation.
2. Signed-in user applies redeem code via extension command.
3. Affiliate conversion/payout records are updated server-side.

### Flow 4: Team Policy Governance
1. Admin creates team, assigns/revokes seats, and configures team provider policy.
2. Backend injects provider policy into entitlement JWT claims.
3. Extension provider layer blocks disallowed model endpoints according to claims.

### Flow 5: Web Onboarding + Payment
1. User opens backend landing page (`/`) and reviews pricing/security/platform coverage.
2. User signs in (email verify, GitHub OAuth, or Google OAuth web callback).
3. Auth wall unlocks billing and redeem actions after token is present.
4. User starts Stripe checkout (or offline payment ref + proof + redeem path).
5. Entitlement status can be checked directly on web and then refreshed in extension.

### Flow 6: Customer Account + Team Admin
1. Signed-in user opens account dashboard in web panel.
2. User reviews plan, renewal window, quota, and billing/refund history.
3. User can submit support tickets and product feedback.
4. Team owner/manager can create team accounts, assign/revoke seats, and enforce provider policy.

### Flow 7: Super Admin Governance
1. A signed-in account that resolves as super-admin (DB/env/hybrid mode) opens the Admin Board tab in `/app`.
2. Admin reviews global metrics: registered users, paid users, active subscriptions, pending support/refunds/offline payments.
3. Admin can inspect users/subscriptions/payments/support queue and perform operational actions (ticket status update, subscription revoke, user-session revoke).

### Flow 8: PG EOD + Mastermind Governance
1. Agent/developer submits `PG EOD` report (work summary, changed files, time window, blockers).
2. If a decision is required, `PG Mastermind` thread is opened with options/arguments.
3. Senior reviewers vote/comment and submit final ruling (`approve`, `reject`, `needs-change`).
4. Server finalization emits immutable outcome + ordered decision event in local sync queue.
5. Local extension/agent pulls pending decisions (`sync/pull`) and maps final decision to local action command (approve/needs-change/reject), preferably through playbook allowlist bindings per `thread_id`.
6. Local worker acknowledges execution result (`sync/ack`) with `applied|conflict|skipped` and execution note for audit visibility.
7. Optional Slack dispatch is controlled by paid add-on toggle per scope; signed slash command bridge is active and advanced reviewer callback automation remains next phase.

### Flow 9: Slack Governance Command Bridge
1. Reviewer sends Slack slash command to `/integrations/slack/commands`.
2. Server verifies Slack HMAC signature + timestamp replay window.
3. Server resolves Slack user email via bot token and maps to Narrate user.
4. Command executes governance action (`summary`, `eod`, `thread`, `vote`) with normal RBAC/scope checks.
5. Interactive action payloads (vote/approve/reject) are verified via `/integrations/slack/actions`, immediately acked, then processed async with result delivery via `response_url` or `chat.postEphemeral` fallback.
6. For enabled scopes, outbound notifications are posted to configured Slack channel/webhook.

### Flow 10: Command Help Center (Quickstart + Troubleshooting)
1. User opens `Narrate: Open Command Help` from the sidebar/help entrypoint.
2. Help page shows copy-paste examples for:
   - `pg start/status/end`
   - governance worker setup (`governance-login`, `governance-bind`, `governance-worker`)
   - Slack decision grammar (`thread`, `vote`, `decide`, `summary`).
3. Page explains expected success outputs (health true, thread ID created, vote saved, ack applied).
4. If a command fails, user follows mapped troubleshooting steps (placeholder IDs, token missing, local API not running, Slack dispatch timeout).
5. User can run `Narrate: Run Command Diagnostics` and copy result snippets for support (includes Narrate flow baseline wiring check via `pg narrate-check -SkipCompile`), while `Memory-bank/_generated/command-diagnostics-latest.md` and `.json` store latest diagnostics for handoff.

## Business Rules
- Narration must describe only visible code text, no invented hidden behavior.
- Cache key is based on normalized line hash, file path, and mode.
- If provider config is missing/fails, fallback narration must preserve usability.
- Free plan does not include Edu mode in backend claims; trial/paid plans do.
- Project quota activation is idempotent per user/scope/repo fingerprint.
- Stripe webhook processing is signature-verified when `STRIPE_WEBHOOK_SECRET` is configured.
- OAuth callback URL must be loopback or in trusted `OAUTH_CALLBACK_ORIGINS`.
- Web onboarding now uses `HttpOnly` session cookie (token-in-URL is skipped for `/app` callback).
- OTP/OAuth start endpoints are rate-limited and OTP can be disabled via env.
- Admin operational routes default to DB RBAC (`ADMIN_AUTH_MODE=db`) and require server-side permission resolution (not frontend role flags).
- Admin routes can require Cloudflare Access JWT assertions before RBAC checks when `CLOUDFLARE_ACCESS_ENABLED=true`.
- Cloud workflows (Slack/reviewer) carry decisions and metadata only; source code context remains local-first and is not stored as cloud-owned memory state.
- Core product default remains local-first; managed observability hosting is optional enterprise scope and must not be required for base extension value.
- Decision sync must be acknowledged by local client before marked applied to prevent missed governance updates.
- Governance mutable data is retention-pruned by scope policy; finalized outcomes remain preserved for audit summary.
- Memory-bank docs are mandatory project memory and must be updated when structure/plan/features change.
- Agent workflow must run proactive as-you-go self-checks during implementation (`pg self-check`) so users are not left to discover fixable issues manually at the end.
- Premium framework/checklist policy content must not ship in plaintext with repo-facing AGENTS/runtime bundles for non-enterprise tiers.
- Default commercialization path is cloud-first policy/scoring for Free/Student/Team; enterprise offline encrypted policy packs are a later add-on.
- Dependency add/upgrade actions must pass strict server-side verification (registry freshness, deprecation, compatibility, vulnerability, maintenance, and native-alternative checks) before approval.
- `pg prod` must fail closed when dependency verification fails and return explicit remediation reasons.
- When enabled, `pg prod` Playwright smoke gate must fail closed if Playwright setup is missing or smoke tests fail.
- Coding standards enforcement should use profile-aware rule IDs and fail closed on blocker-level violations before production approval.
- Query optimization policy must reject unsafe database anti-patterns in enforcement paths (N+1 loops, `SELECT *`, deep `OFFSET`) and require schema/index signals for relational keys.
- Database maintenance diagnostics should be enforceable in strict paths (invalid indexes, missing `pg_stat_statements`, high sequential scan pressure, unused indexes, and autovacuum/analyze lag signals).
- Cloud production readiness checks should be evaluated from metadata-only scanner summaries plus explicit architecture evidence, with stricter blocker policy for regulated workloads.
- Local user-visible guidance may include generic verification outcomes, but private deny-lists/weights/rules remain server-side to protect IP.
- Requests to reveal private policy internals or bypass enforcement must be detected server-side and handled with risk-based controls (warn -> restrict -> escalate).
- Extension-native auto-consumer work is blocked until enforcement baseline milestones (dependency, coding standards, trigger/anti-exfil) are enabled and validated in this repo.
- After any agent file write, a self-check must run and report blocker rule IDs; unresolved blockers must be fixed before task completion.
- Extension auto-consumer must execute decisions locally and ack outcomes (`applied|conflict|skipped`) so Slack/server state reflects actual local execution result.
- For real-time/async/communication features, AI must run a pre-implementation architecture intake and cannot default to polling or synchronous blocking handlers without explicit documented justification and user confirmation.
- Command help content must use real, executable examples (no placeholder `<THREAD_ID>` or `<TOKEN>` in copy-paste blocks) and include an explicit troubleshooting matrix for common failure messages.
- Slack decision grammar must stay explicit in user help:
  - `thread` returns option keys (`opt1`, `opt2`, ...), and `vote`/`decide` should reference those keys.
  - slash command input must start with `/pg` as the first token (no prefixed numbering/text).
- Local dev profile is allowed for development/test credentials only and must remain gitignored local storage; production credentials remain `.env`/vault-managed and are still enforced by production gates.
- Commit guard must block likely real secret values in staged Memory-bank/verification docs; placeholders/examples are allowed but live secrets are not.


