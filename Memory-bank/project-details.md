# Project Details - Scope, Plan, Feature Status

LAST_UPDATED_UTC: 2026-02-23 00:34
UPDATED_BY: codex

## Purpose
Track delivery status for Narrate extension milestones and licensing/commercial backend progress.

## Current Plan (Rolling)
| Plan Item | Status | Owner | Target Date | Notes |
|---|---|---|---|---|
| Initialize Memory-bank standards | Done | Platform | 2026-02-19 | Bootstrapped |
| Finalize packaging + pricing structure | Done | Product | 2026-02-19 | Captured in `building-plan-doc.md` |
| Milestone 1 scaffold (extension core) | Done | Engineering | 2026-02-20 | Core extension compiled |
| Milestone 2 (Edu refinements + sections) | Done | Engineering | 2026-02-20 | Section summaries + edu enrichment |
| Milestone 3 (export + basic gates) | Done | Engineering | 2026-02-20 | File/workspace export + placeholder gates |
| Milestone 4 (git diff change report) | Done | Engineering | 2026-02-20 | Local diff parser + narrated report |
| Milestone 5 (licensing backend + trial + refund) | Done | Engineering | 2026-02-20 | Auth, entitlement, quota, device, refund routes live |
| Milestone 6 (payments + offline + redeem + affiliate) | Done | Engineering | 2026-02-20 | Checkout/webhook + offline/redeem/affiliate flows implemented |
| Milestone 7 core (team/provider policy governance) | Done | Engineering | 2026-02-20 | Team seat admin routes + provider policy claim enforcement implemented |
| Milestone 7.5 (web landing + browser onboarding flow) | Done | Engineering | 2026-02-20 | Added hosted landing, pricing/security copy, web auth/checkout/offline/redeem controls |
| Milestone 7.6 (web auth wall + Google OAuth) | Done | Engineering | 2026-02-20 | Added auth-gated billing panel and Google OAuth start/callback routes |
| Milestone 7.7 (domain + tunnel deployment bootstrap) | Done | Engineering | 2026-02-20 | Added production-domain env wiring and Cloudflare tunnel automation script |
| Milestone 7.8 (OAuth runtime env activation) | Done | Engineering | 2026-02-20 | Added dotenv-based `.env` loading so Google/GitHub OAuth keys are applied in live runtime |
| Milestone 8A (Prisma + PostgreSQL schema provisioning) | Done | Engineering | 2026-02-20 | Added Prisma schema/client and pushed real tables to remote Postgres `narate_enterprise` schema |
| Milestone 8B (Admin RBAC schema separation) | Done | Engineering | 2026-02-20 | Added dedicated admin/operator tables (`admin_*`) for board/shop assistant governance without mixing customer `users` |
| Milestone 8C (customer account + team self-service web portal) | Done | Engineering | 2026-02-21 | Added account summary/billing/support/feedback APIs and owner/manager team-admin web controls |
| Milestone 8D (professional portal UX + super-admin board) | Done | Engineering | 2026-02-21 | Split marketing site and secure `/app` sidebar portal; added super-admin dashboard APIs for users/payments/support governance |
| Milestone 8E (auth hardening baseline) | Done | Engineering | 2026-02-21 | Added HttpOnly cookie sessions, OTP/OAuth rate limits, OTP feature toggles, DB-backed super-admin mode, and hardened admin route namespace |
| Milestone 8F (DB RBAC enforcement for privileged routes) | Done | Engineering | 2026-02-21 | Added permission-based admin auth (`ADMIN_AUTH_MODE=db|hybrid|key`), seeded RBAC baseline in `admin_*` tables, and removed hard dependency on frontend/admin-key for operational actions |
| Milestone 9A (PG EOD reporting domain model) | Done (JSON baseline) | Engineering | 2026-02-21 | Implemented EOD records + submit/list APIs + retention pruning in JSON runtime |
| Milestone 9B (PG Mastermind debate + decision model) | Done (JSON baseline) | Engineering | 2026-02-21 | Implemented debate threads/options/entries/votes/final outcomes + role-aware decision finalize |
| Milestone 10A (Slack secure integration gateway) | In Progress (signed commands + actions done) | Engineering | 2026-02-23 | Added signed `/integrations/slack/commands`, `/integrations/slack/actions`, outbound dispatch, and interactive vote/decision buttons; enterprise reviewer automation policy still pending |
| Milestone 10B (Local-memory sync bridge) | Done (server side baseline) | Engineering | 2026-02-21 | Implemented decision event queue + per-user ack APIs (`sync/pull`, `sync/ack`) for local client consumption |
| Milestone 10C (Runtime store backend mode) | Done | Engineering | 2026-02-21 | Added `STORE_BACKEND=json|prisma` and Prisma-backed table-by-table persistence across `narate_enterprise.*` tables |
| Milestone 10D (Cloudflare Access admin lock) | Done (optional gate) | Engineering | 2026-02-21 | Added optional `cf-access-jwt-assertion` verification on admin routes with env-configured team domain + AUD |
| Milestone 10E (Private framework/checklist policy vault) | Planned | Engineering | 2026-02-24 | Move framework/checklist assets behind server-private storage, tenant overlays, summary-only API exposure, and deterministic policy evaluation hooks |
| Milestone 10F (Slack launch validation + closure) | Planned (next) | Engineering | 2026-02-24 | Complete end-to-end Slack verification (`commands/actions/response_url`), close reviewer automation policy gaps, and publish launch checklist |
| Milestone 10G (Narrate flow completion validation) | Planned (next) | Engineering | 2026-02-24 | Validate full user flow: Dev/Edu toggle narration, request-change handoff, markdown exports, and report generation before new enterprise track starts |
| Milestone 10H (Dependency verification enforcement baseline) | Planned | Engineering | 2026-02-25 | Ingest strict dependency verification protocol (deny-list, registry/doc verification, compatibility matrices, vulnerability thresholds) into server-private policy vault with fail-closed evaluator |
| Milestone 11 (Enterprise reviewer digest and governance dashboard) | Planned | Engineering | 2026-02-24 | Add reviewer digest and operational KPIs: unresolved debates, approval latency, blocked tasks, weekly activity summaries |
| Milestone 12 (Optional PG mobile reviewer app) | Planned (post-MVP) | Product + Engineering | 2026-03-05 | Lightweight mobile app for reviewer approvals/comments; only after Slack workflow is stable |
| Milestone 13A (Policy boundary split: generic vs private) | Planned | Engineering | 2026-02-26 | Keep repo-facing AGENTS guidance generic; move premium framework/checklist bodies, scoring logic, and policy overlays to server-private vault |
| Milestone 13B (Plan packaging + entitlement matrix v2) | Planned | Product + Engineering | 2026-02-26 | Finalize Free/Student/Team/Enterprise package flags and no-reinstall upgrade path across modules |
| Milestone 13C (PG CLI auth/update lifecycle) | Planned | Engineering | 2026-02-27 | Add `pg login`, `pg update`, and `pg doctor` with entitlement-aware profile sync while preserving `pg start/end/status` |
| Milestone 13D (PG Prod gate + PG Push enforcement) | Planned | Engineering | 2026-02-27 | Add `pg prod` production blocker gate (static/type/zod + optional Playwright + strict dependency verification) and optional hard block before git push |
| Milestone 13E (MCP standard cloud scoring bridge) | Planned | Engineering | 2026-02-28 | Wire scanners into MCP standard runtime and submit metadata-only payload for server-side scoring |
| Milestone 13F (Enterprise offline encrypted rule pack) | Planned (post cloud-stable) | Engineering | 2026-03-03 | Add signed/encrypted offline policy pack for enterprise-only environments after cloud-first rollout proves stable |
| Production hardening phase | Planned | Engineering | 2026-02-24 | Postgres migration, Stripe rollout, OAuth rollout, security hardening |

## Feature Backlog Snapshot
| Feature | Priority | Status | Components | Decision Link |
|---|---|---|---|---|
| Reading mode virtual doc (dev/edu) | High | Done | `extension/src/readingView/*` | `building-plan-doc.md` |
| Narration engine + line cache | High | Done | `extension/src/narration/*`, `extension/src/cache/*` | `building-plan-doc.md` |
| Edu mode term/syntax enrichment | High | Done | `extension/src/narration/termMemory.ts` | `mastermind.md` |
| Section summaries in reading view | High | Done | `extension/src/readingView/sectionBuilder.ts`, `renderNarration.ts` | `mastermind.md` |
| Request change prompt handoff | High | Done | `extension/src/commands/requestChangePrompt.ts` | `building-plan-doc.md` |
| Export narration (current/workspace) | High | Done | `extension/src/commands/exportNarrationFile.ts`, `exportNarrationWorkspace.ts` | `mastermind.md` |
| Git diff change report | High | Done | `extension/src/commands/generateChangeReport.ts`, `extension/src/git/*` | `mastermind.md` |
| PG git push command (add/commit/push) | Medium | Done | `extension/src/commands/pgPush.ts`, `extension/src/extension.ts` | `mastermind.md` |
| Licensing backend mode (signin/trial/refresh/status/quota) | High | Done | `extension/src/licensing/*`, `server/src/index.ts` | `mastermind.md` |
| GitHub sign-in (loopback callback) | High | Done | `extension/src/licensing/featureGates.ts`, `server/src/index.ts` | `mastermind.md` |
| Upgrade plan checkout command | High | Done | `extension/src/commands/upgradePlan.ts`, `server/src/index.ts` | `mastermind.md` |
| Stripe signed webhook + checkout session endpoint | High | Done | `server/src/index.ts` | `building-plan-doc.md` |
| Offline payment + redeem code flow | High | Done | `server/src/index.ts`, `server/src/types.ts` | `building-plan-doc.md` |
| Affiliate tracking + payout approval | Medium | Done | `server/src/index.ts` | `building-plan-doc.md` |
| Team seat management admin routes | Medium | Done | `server/src/index.ts` | `building-plan-doc.md` |
| Provider policy governance (team/user) | Medium | Done | `server/src/index.ts`, `extension/src/llm/openAICompatibleProvider.ts` | `building-plan-doc.md` |
| Public landing + web onboarding/payment panel | High | Done | `server/public/*`, `server/src/index.ts` | `mastermind.md` |
| Web auth wall + Google sign-in | High | Done | `server/public/index.html`, `server/public/assets/site.js`, `server/src/index.ts` | `mastermind.md` |
| Cloudflare domain tunnel bootstrap | Medium | Done | `scripts/setup_cloudflare_tunnel.ps1`, `server/.env` | `mastermind.md` |
| OAuth env activation fix | High | Done | `server/src/index.ts`, `server/package.json` | `mastermind.md` |
| Prisma schema + DB push to Postgres | High | Done | `server/prisma/schema.prisma` | `mastermind.md` |
| Admin RBAC table separation (board/admin/assistant) | High | Done | `server/prisma/schema.prisma` | `mastermind.md` |
| Web account dashboard (summary/billing/support/feedback) | High | Done | `server/src/index.ts`, `server/public/index.html`, `server/public/assets/site.js` | `mastermind.md` |
| Team self-service portal (owner/manager seat + policy controls) | High | Done | `server/src/index.ts`, `server/public/index.html`, `server/public/assets/site.js` | `mastermind.md` |
| Super-admin board (user/payment/support governance) | High | Done | `server/src/index.ts`, `server/public/app.html`, `server/public/assets/site.js` | `mastermind.md` |
| Auth hardening (cookie session + rate limit + OTP controls + DB super-admin mode) | High | Done | `server/src/index.ts`, `server/public/assets/site.js` | `mastermind.md` |
| DB-backed admin RBAC permission enforcement | High | Done | `server/src/index.ts`, `server/prisma/schema.prisma`, `server/.env.example` | `mastermind.md` |
| PG End-of-Day reporting domain (agent + human productivity summary) | High | Done (JSON baseline) | `server/src/index.ts`, `server/src/store.ts`, `server/public/app.html`, `server/public/assets/site.js` | `mastermind.md` |
| PG Mastermind debate + decision workflow | High | Done (JSON baseline) | `server/src/index.ts`, `server/src/store.ts`, `server/public/app.html`, `server/public/assets/site.js` | `mastermind.md` |
| Slack signed webhook + command/action bridge | High | In Progress | `server/src/index.ts`, integration service, audit logs | `mastermind.md` |
| Slack gateway launch closure (e2e validation + reviewer policy completion) | High | Planned (next) | signed command/action runtime, response_url validation matrix, scope add-on checks | `mastermind.md` |
| Local decision-sync bridge to extension/agent runtime | High | Done (server baseline) | `server/src/index.ts` (`/account/governance/sync/*`), local client integration pending | `mastermind.md` |
| Narrate flow completion validation (toggle + handoff + export/report regression) | High | Planned (next) | `extension/src/commands/*`, `extension/src/readingView/*`, `extension/src/narration/*` | `mastermind.md` |
| Private framework policy vault + production checklist enforcement engine | High | Planned | server private policy module + tenant override store + enforcement/report API | `mastermind.md` |
| Dependency verification enforcement engine (server-side private policy) | High | Planned | server-side dependency verifier, curated deny-list/replacements, official-registry/documentation source map, compatibility matrix resolver, remediation-code API | `mastermind.md` |
| AGENTS policy split (generic local directives + server private profiles) | High | Planned | repo AGENTS docs + backend policy-profile resolver + entitlement guards | `mastermind.md` |
| PG CLI lifecycle (`pg login/update/doctor/prod`) | High | Planned | `pg.ps1` + `scripts/*` + entitlement sync + prod gate orchestration | `mastermind.md` |
| PG Prod pre-push enforcement | High | Planned | `pg prod` runner + extension `pgPush` preflight hook + fail-fast block output including dependency verification blocker codes | `mastermind.md` |
| MCP standard cloud scoring bridge | High | Planned | MCP stdio server + metadata-only API scoring path | `mastermind.md` |
| Enterprise offline encrypted policy pack | Medium | Planned (post cloud-stable) | enterprise MCP + machine-bound encrypted packs + expiry/rotation | `mastermind.md` |
| Optional private mobile reviewer app (React Native) | Medium | Planned (post-MVP) | separate mobile repo + server APIs | `mastermind.md` |
| Runtime persistence migration to Prisma | High | Done (baseline) | backend now supports `STORE_BACKEND=prisma` with table-by-table persistence; write-optimization can iterate later | `building-plan-doc.md` |
| WhatsApp/Telegram add-on | Medium | Planned (post-MVP) | remote daemon/backend | `building-plan-doc.md` |

## Open Risks
- Prisma mode now persists runtime state table-by-table but currently performs full-table rewrite on updates; optimize to incremental updates if write volume grows.
- Prisma typed insert hotfix applied on 2026-02-21 to cast placeholders to real DB column types and avoid UUID/text mismatch at runtime.
- Stripe checkout session endpoint requires valid `STRIPE_SECRET_KEY` + `STRIPE_PRICE_MAP`; production rollout docs/secrets still pending.
- GitHub/Google OAuth routes are implemented, but production app credentials and `OAUTH_CALLBACK_ORIGINS` must be configured.
- Team seat UX in extension is still backend-admin driven; web now has owner/manager controls but in-extension team-admin UI is still pending.
- Admin RBAC permissions now guard privileged routes in DB mode, but fallback key mode (`ADMIN_AUTH_MODE=hybrid|key`) can still be enabled for break-glass operations and must remain tightly controlled.
- Student free plan is currently messaging + manual verification workflow; no dedicated automated student-verification endpoint yet.
- Server-side EOD/Mastermind sync queue exists, but extension-side auto-pull/apply wiring is still pending.
- Slack command/action ingestion adds attack surface; keep signature verification, replay protection, and strict allowlists enabled in production.
- Slack timeout risk for live `/pg help` verification mitigated by fast-ack path that bypasses user-email/DB lookup for help-only command.
- Slack non-help command timeout risk mitigated by async `response_url` delivery (`summary/eod/thread/vote`) after immediate ack.
- Slack interactive button timeout risk mitigated by universal fast-ack on `/integrations/slack/actions`, with async follow-up delivery via `response_url` or `chat.postEphemeral` fallback when `response_url` is absent.
- Slack role-clarity UX updated so interactive cards display workflow guidance and only show finalize buttons to users who can finalize (owner/manager or personal-thread creator), reducing confusing unauthorized button clicks.
- Slack role transparency improved:
  - thread cards now show scope (`team` + team key) and role-specific access label (`owner/manager/member`) instead of generic reviewer/voter text.
  - account summary now includes team membership roles (`TEAM_KEY (role)`), so reviewers can verify effective rights from Slack directly.
- Slack `response_url post failed (500)` risk from rich block payload rejection mitigated by server fallback to plain-text response delivery when rich payload post fails.
- Slack `invalid_blocks` risk from duplicate button `action_id` values mitigated by unique per-button action IDs for vote/decision controls.
- If premium framework/checklist logic stays in local repo/client bundles, IP extraction risk remains high; policy vault split must be completed before broad rollout.
- If dependency verification datasets/rules are shipped in plaintext client-side, IP leakage and policy bypass risks increase; keep canonical datasets server-private.
- Registry/doc source outages can block strict dependency checks; mitigate with signed cached snapshots + explicit staleness windows and fail-safe messaging.
- Offline encrypted packs reduce but do not eliminate extraction risk; keep this mode enterprise-only and rotate pack format/version on schedule.
- `pg prod` strict gating can increase pre-push latency when Playwright checks are enabled; keep UI checks optional by default with explicit strict mode.
- Prisma pool-timeout risk mitigated by:
  - read-only Slack `summary` user resolution (skip user write path)
  - non-interactive sequential Prisma persist writes to avoid `Transaction API error: Transaction not found` from interactive transaction handles.

## Next Planning Review
- Date: 2026-02-26
- Owners: Product + Engineering
- Review focus: close Slack/Narrate validation and lock Milestone 13 (cloud-first policy enforcement) implementation backlog.
