# Structure & DB - Authoritative Snapshot

LAST_UPDATED_UTC: 2026-02-23 00:34
UPDATED_BY: codex
PROJECT_TYPE: frontend

## System Inventory
| Component | Type | Responsibility | Tech | Detail Doc |
|---|---|---|---|---|
| extension | frontend/tooling | VS Code Narrate commands, reading view, narration cache/LLM integration, exports, change reports, licensing UX commands, provider policy enforcement | TypeScript, VS Code API, Node runtime | `Memory-bank/code-tree/narrate-extension-tree.md` |
| licensing backend | backend/local-service | Auth, trial, entitlement token lifecycle, device binding, project quota, refund, checkout/webhook, offline/redeem, affiliate, team seats, provider policies, customer account history/support/feedback APIs, team-admin self-service routes, super-admin board APIs, governance workflows (EOD + mastermind + decision sync queue), signed Slack command bridge, optional Cloudflare Access admin gate | Fastify, TypeScript, JSON or Prisma runtime store | `Memory-bank/code-tree/narrate-extension-tree.md` |
| web onboarding pages | frontend/web | Public marketing site (`/`) plus secure portal app (`/app`) with sidebar navigation for customer billing/support, team management, and super-admin board | Static HTML/CSS/JS served by Fastify static | `Memory-bank/code-tree/narrate-extension-tree.md` |
| memory-bank tooling | local scripts | Start/end session enforcement, summary/index generation, guard checks, Cloudflare tunnel helper automation | Python + PowerShell | `Memory-bank/code-tree/memory-bank-tooling-tree.md` |

## High-Level Flow
- VS Code source file -> narration engine -> cache hit/miss evaluation.
- Cache miss -> OpenAI-compatible provider call (if configured) -> validated narration.
- Provider unavailable -> deterministic fallback narration.
- Narration output -> `narrate://` virtual document rendering.
- Edu mode selection checks entitlement and auto-attempts trial start for eligible signed-in users.
- Upgrade flow uses extension command -> backend checkout session endpoint -> browser Stripe Checkout.
- Web onboarding flow uses backend-hosted landing page (`/`) -> browser auth (email/GitHub/Google) -> auth wall unlocks checkout/offline/redeem actions.
- Signed-in users can load account summary + billing history, submit support/feedback, and manage enterprise seats/policies from the same web surface.
- Super admins/admin operators are authenticated by DB-backed RBAC (`admin_accounts` + role/permission mapping) and can monitor users, subscriptions, payments, and support queues from `/pg-global-admin/board/*`.
- Admin APIs can optionally require Cloudflare Access JWT assertions (`cf-access-jwt-assertion`) before RBAC checks.
- Team/enterprise users can configure governance controls (retention, vote mode, Slack toggle/add-on) through `/account/governance/settings*`.
- Team/enterprise users can submit EOD reports, create mastermind debate threads, vote, and finalize decisions from `/account/governance/*`.
- Finalized decisions are published to a local-first sync queue (`/account/governance/sync/pull`, `/account/governance/sync/ack`) for extension/agent consumption.
- Slack slash commands and interactive callbacks can submit governance actions through `/integrations/slack/commands` and `/integrations/slack/actions` with signature and replay protection.
- Webhook verifies signature then grants entitlement and updates affiliate conversion state.
- Backend issues signed entitlement JWTs and enforces plan/device/quota/rules.
- Team/user provider policies are injected into entitlement claims and enforced by extension provider calls.

## Schemas / Data Stores (Index)
| Schema or Store | Owned By | Count | Detail Doc |
|---|---|---:|---|
| Local JSON narration cache (`narration-cache.json`) | extension | 1 | `Memory-bank/code-tree/narrate-extension-tree.md` |
| Licensing backend JSON store (`server/data/store.json`) | licensing backend | 1 | `Memory-bank/db-schema/licensing-json-store-schema.md` |
| Licensing PostgreSQL schema (`narate_enterprise.*`) via Prisma | licensing backend | 28 tables | `Memory-bank/db-schema/narrate-postgres-prisma-schema.md` |
| Memory-bank generated state (`Memory-bank/_generated/*.json`) | memory-bank tooling | 3 | `Memory-bank/README.md` |

## Licensing Store Records (Current)
- `users`
- `auth_challenges`
- `sessions`
- `subscriptions`
- `product_entitlements`
- `project_quotas`
- `project_activations`
- `devices`
- `trials`
- `refund_requests`
- `offline_payment_refs`
- `redeem_codes`
- `stripe_events`
- `affiliate_codes`
- `affiliate_conversions`
- `affiliate_payouts`
- `provider_policies`
- `oauth_states`
- `teams`
- `team_memberships`
- `support_tickets`
- `feedback_entries`
- `governance_settings`
- `governance_eod_reports`
- `mastermind_threads`
- `mastermind_options`
- `mastermind_entries`
- `mastermind_votes`
- `mastermind_outcomes`
- `governance_decision_events`
- `governance_decision_acks`
- `keys`

## Notes
- `server/` now implements Milestone 5 + 6 + 7 core behavior.
- Account dashboard APIs and team self-service APIs are now available in runtime JSON-store mode.
- PostgreSQL tables are provisioned via Prisma in schema `narate_enterprise`.
- Runtime persistence now supports:
  - `STORE_BACKEND=json` -> file-backed `server/data/store.json`
  - `STORE_BACKEND=prisma` -> table-by-table persistence in `narate_enterprise.*` (no single `runtime_state` row).
- Admin/operator governance is separated from customer identities using dedicated `admin_*` tables.
- Privileged admin routes now default to DB RBAC auth mode (`ADMIN_AUTH_MODE=db`) with optional emergency fallback to `x-admin-key` only when explicitly configured (`hybrid` or `key`).
- Server now auto-loads `server/.env` at startup (`dotenv/config`) so OAuth/Stripe keys are active without shell-level env export.
- Governance baseline now runs in JSON and Prisma modes for Milestone 9A/9B/10B foundations:
  - EOD reports and mastermind vote/decision workflows
  - decision sync queue with per-user acknowledgment status
  - admin/team/user Slack add-on activation toggles and signed Slack command/action bridge
- Prisma store insert path now applies real Postgres column-type casts (uuid/enum/array/etc.) to prevent runtime write failures from typed parameter mismatches.
- Slack slash-command route now fast-acks `help`/empty commands before Slack user-email resolution to avoid 3s Slack timeout during integration verification.
- Slack non-help commands now return an immediate ack and execute asynchronously via Slack `response_url`, preventing `dispatch_failed` when DB work exceeds Slack's 3s window.
- Slack async response delivery now retries with a plain-text fallback when Slack rejects rich block payloads on `response_url` post, reducing user-facing `response_url post failed (500)` failures.
- Slack slash command set now includes `decide` so reviewers can finalize without interactive buttons when block rendering is unavailable.
- Slack interactive button payload now uses unique `action_id` values per button (vote/decision actions) to satisfy Slack block validation and restore open-thread button rendering.
- Slack interactive action route now always returns immediate ack (`Processing action...`) and completes auth/vote/decision work asynchronously; if Slack does not include `response_url`, follow-up response is posted with `chat.postEphemeral`.
- Slack thread interaction blocks are now viewer-role-aware:
  - vote actions shown only to users who can access/vote the thread
  - finalize actions shown only to users who can finalize (owner/manager for team scope; creator for personal scope)
  - card now includes explicit workflow and "Your access" context to reduce vote vs finalize confusion.
- Slack card context now exposes effective scope/team and concrete membership role labels (`owner`, `manager`, `member`) so role-to-permission mapping is visible during review.
- Slack `summary` response now includes team role per team key (`TEAM_KEY (role)`) to validate permission expectations without opening the web portal.
- Slack `summary` command now uses read-only user lookup (no user write/update) so routine checks avoid heavy persistence writes.
- Prisma runtime persist now uses non-interactive sequential writes (no Prisma interactive transaction callback) to avoid `Transaction API error: Transaction not found` under the current remote Postgres connection path.
- Extension command surface now includes local `PG Push` / `PG Git Push` workflow for guarded git add/commit/push execution from VS Code.
- SQLite cache remains planned for Milestone 8; extension currently uses JSON cache backend.
