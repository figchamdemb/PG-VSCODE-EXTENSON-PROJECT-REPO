# Project Spec - Intent, Actors, Flows

LAST_UPDATED_UTC: 2026-02-23 00:26
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
    - server-side dependency verification enforcement using official registry checks, deprecated deny-list, compatibility matrix, vulnerability thresholds, and activity/maintenance checks
    - `pg` CLI lifecycle expansion (`login`, `update`, `doctor`, `prod`) with entitlement-aware command gating
    - `pg prod` hard-fail gate for dependency violations (deprecated package, incompatible version, vulnerable dependency, missing pinned range)
    - optional enterprise-only offline encrypted policy pack after cloud-first path is stable
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
5. Local extension/agent pulls and acknowledges decision (`sync/pull` + `sync/ack`) to update local Memory-bank/task context.
6. Optional Slack dispatch is controlled by paid add-on toggle per scope; signed slash command bridge is active and advanced reviewer callback automation remains next phase.

### Flow 9: Slack Governance Command Bridge
1. Reviewer sends Slack slash command to `/integrations/slack/commands`.
2. Server verifies Slack HMAC signature + timestamp replay window.
3. Server resolves Slack user email via bot token and maps to Narrate user.
4. Command executes governance action (`summary`, `eod`, `thread`, `vote`) with normal RBAC/scope checks.
5. Interactive action payloads (vote/approve/reject) are verified via `/integrations/slack/actions`, immediately acked, then processed async with result delivery via `response_url` or `chat.postEphemeral` fallback.
6. For enabled scopes, outbound notifications are posted to configured Slack channel/webhook.

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
- Decision sync must be acknowledged by local client before marked applied to prevent missed governance updates.
- Governance mutable data is retention-pruned by scope policy; finalized outcomes remain preserved for audit summary.
- Memory-bank docs are mandatory project memory and must be updated when structure/plan/features change.
- Premium framework/checklist policy content must not ship in plaintext with repo-facing AGENTS/runtime bundles for non-enterprise tiers.
- Default commercialization path is cloud-first policy/scoring for Free/Student/Team; enterprise offline encrypted policy packs are a later add-on.
- Dependency add/upgrade actions must pass strict server-side verification (registry freshness, deprecation, compatibility, vulnerability, maintenance, and native-alternative checks) before approval.
- `pg prod` must fail closed when dependency verification fails and return explicit remediation reasons.
- Local user-visible guidance may include generic verification outcomes, but private deny-lists/weights/rules remain server-side to protect IP.
