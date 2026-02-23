# Mastermind - Decisions & Verification (Append-Only)

LAST_UPDATED_UTC: 2026-02-23 00:34
UPDATED_BY: codex

## Decision Log

### Topic: Expose concrete team role in Slack governance cards
Date_UTC: 2026-02-23
Owner: codex

Options:
1. Keep generic labels (`reviewer`, `voter`) only.
2. Show concrete role (`owner|manager|member`) and map it to permission text in Slack UI.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Removes ambiguity and makes finalize permissions auditable in-channel |
| Reviewer B | Option 2 | Helps teams validate role wiring without opening admin portal |

Decision:
- Implement Option 2.

Rationale:
- User requested clear understanding of why one account can vote + finalize while others can only vote.

Risks:
- Role labels could be stale if membership changes after a card is posted.

Mitigation:
- Keep `Refresh Thread` action and server-side permission checks as source-of-truth for each click.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Slack governance card UX for vote vs finalize responsibilities
Date_UTC: 2026-02-23
Owner: codex

Options:
1. Keep both vote and finalize buttons visible to all thread participants and rely on backend authorization errors.
2. Render role-aware Slack cards: voter-only controls for voters, finalize controls only for users with finalization rights, plus explicit workflow text.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces confusion and aligns with intended governance model (team votes, reviewer finalizes) |
| Reviewer B | Option 2 | Prevents avoidable unauthorized clicks and improves Slack usability for non-manager seats |

Decision:
- Implement Option 2.

Rationale:
- User requested clearer separation between voting and reviewer approval responsibilities.
- Backend already enforced permissions; UI now mirrors those rules to avoid mixed mental model.

Risks:
- Role-aware rendering depends on accurate user/team membership resolution per Slack action.

Mitigation:
- Keep backend authorization checks as source-of-truth and treat UI gating as additional clarity layer, not sole security control.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Slack interactive button timeout handling model
Date_UTC: 2026-02-23
Owner: codex

Options:
1. Keep synchronous fallback on `/integrations/slack/actions` when `response_url` is missing.
2. Fast-ack every action click and move user resolution + governance action execution to async path, with `chat.postEphemeral` fallback when `response_url` is absent.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Guarantees Slack 3-second SLA on button clicks and prevents `Operation timed out` UX failures |
| Reviewer B | Option 2 | Preserves button-first UX while keeping result delivery possible even without `response_url` |

Decision:
- Implement Option 2.

Rationale:
- Live button-click testing surfaced Slack 3-second timeout behavior that can occur before DB/auth work completes.
- Immediate ack on ingress is required for reliable interactive UX.

Risks:
- Async follow-up can still fail if Slack API rejects fallback ephemeral post.

Mitigation:
- Keep detailed server logs for async action failures and preserve slash-command fallback (`decide`) as operational backup.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Dependency verification enforcement placement and visibility model
Date_UTC: 2026-02-22
Owner: codex

Options:
1. Ship full dependency verification policy (deny-list, registry mapping, compatibility matrices, scoring logic) in local repo/agent-visible files.
2. Keep canonical dependency verification policy and evaluation logic server-side/private, expose only enforcement results/reason codes to local clients, and hard-fail `pg prod` on violations.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Protects IP and prevents users/agents bypassing private policy details while still enforcing quality gates |
| Reviewer B | Option 2 | Aligns with fail-closed production posture and supports centralized updates for deprecated/vulnerable dependencies |

Decision:
- Implement Option 2.

Rationale:
- User requires strict dependency verification as a top-tier blocker and wants core logic hidden from end users.
- A server-private policy dataset allows fast deny-list and compatibility updates without local bundle exposure.

Risks:
- Registry/doc source outages can block verification at runtime.
- Overly strict checks may increase false positives without clear remediation output.

Mitigation:
- Add signed cached policy snapshots with bounded staleness windows.
- Return deterministic blocker reason codes and migration suggestions to CLI/extension output.

Final Ruling:
- Option 2 approved. Canonical dependency policy remains server-private; `pg prod` fails closed when dependency verification fails.

### Topic: Cost-effective rollout order for production-readiness package (cloud-first vs offline-first)
Date_UTC: 2026-02-22
Owner: codex

Options:
1. Build offline encrypted policy-pack mode first for all tiers.
2. Finish current Slack + Narrate validation first, then ship cloud-first policy/scoring for Free/Student/Team and reserve encrypted offline pack for Enterprise add-on.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Lowest delivery risk and fastest path to monetizable quality gate while protecting core IP on server |
| Reviewer B | Option 2 | Keeps cost profile low for Free/Student/Team and defers heavier offline crypto operations to enterprise contract path |

Decision:
- Implement Option 2.

Rationale:
- User requested a cost-efficient commercialization path without blocking current milestone closure.
- Cloud-first preserves strongest IP protection for most users because checklist/scoring logic stays server-side.
- Enterprise offline mode still remains available for strict no-network environments, but should follow only after cloud path is stable.

Risks:
- Non-enterprise users depend on cloud scoring availability for premium checks.
- Delayed offline pack may postpone one enterprise sales scenario.

Mitigation:
- Keep deterministic local baseline checks available when cloud scoring is unavailable.
- Prioritize Milestones 10F/10G first, then implement MCP standard cloud bridge and entitlement packaging before offline pack.

Final Ruling:
- Option 2 approved. Sequence: close Slack + Narrate validation -> cloud-first rollout (Free/Student/Team) -> enterprise offline encrypted add-on.

### Topic: Framework skills/checklist IP protection and enforcement channel
Date_UTC: 2026-02-22
Owner: codex

Options:
1. Keep framework/checklist markdown files directly in repo and let agents read them locally.
2. Move framework/checklist assets behind server-side enterprise policy storage and expose only signed summaries + rule checks to clients.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Protects IP and prevents direct file scraping/cloning from client machines |
| Reviewer B | Option 2 | Supports tenant-specific overrides while keeping global baseline private |

Decision:
- Implement Option 2 as the target architecture.

Rationale:
- User requires the framework standards/checklists to remain private IP while still enforcing agent behavior for enterprise/team/student plans.

Risks:
- Enforcement can become expensive if every step requires LLM calls.

Mitigation:
- Use deterministic rule evaluation (no LLM required for core checks) and return compact rule summaries/actions.
- Keep tenant overlays small and versioned; compile effective policy server-side.

Final Ruling:
- Option 2 approved. Begin with server private-policy module + signed summary endpoint + entitlement-gated access levels.

### Topic: Prisma runtime persistence shape and Slack reviewer interaction surface
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Keep single `runtime_state` row persistence for Prisma mode and postpone Slack interactive callbacks.
2. Persist runtime state table-by-table in Postgres now and complete signed Slack interactive action handling (`/integrations/slack/actions`) with vote/decision buttons.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Eliminates runtime-state-row bottleneck and aligns with requested real DB migration |
| Reviewer B | Option 2 | Enables reviewer approvals directly in Slack with signed callbacks and no frontend-only trust |

Decision:
- Implement Option 2.

Rationale:
- User requested full Prisma migration and actionable Slack governance workflow in current phase.

Risks:
- Table-by-table rewrite can be heavier than incremental writes under high volume.

Mitigation:
- Keep this as baseline for correctness now; optimize hot tables to incremental updates in production hardening.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Immediate rollout order for live testing (Prisma mode + Cloudflare lock + Slack commands)
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Delay implementation and only run manual tests on existing JSON/toggle baseline.
2. Implement now: runtime Prisma store mode, optional Cloudflare admin JWT gate, and signed Slack command baseline so user can test live immediately.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | User asked for immediate live testing and real DB path this hour |
| Reviewer B | Option 2 | Keeps momentum and reduces configuration drift before production hardening |

Decision:
- Implement Option 2.

Rationale:
- User explicitly requested immediate end-to-end testability, with JSON fallback still available.

Risks:
- Existing local Prisma client can be locked by running processes during regenerate (`EPERM` on Windows).

Mitigation:
- Keep `STORE_BACKEND=json` fallback operational and add clear regenerate/dbpush step before enabling Prisma mode in production runtime.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Governance rollout order (EOD/Mastermind first, Slack webhook second)
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Build Slack inbound/outbound webhook bridge first, then add governance domain and sync model.
2. Ship governance core first (EOD, mastermind, decision queue, retention, role checks), then add signed Slack bridge on top.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Establishes a stable local-first governance data model before exposing external webhook surface |
| Reviewer B | Option 2 | Reduces security risk and budget risk by proving retention/pruning behavior first |

Decision:
- Implement Option 2.

Rationale:
- User prioritized enterprise-ready governance controls and local-first memory ownership while keeping costs controlled.
- Slack integration is valuable but must be staged with strict signature verification and replay protection.

Risks:
- Temporary gap where Slack add-on is toggleable but signed webhook transport is not yet active.

Mitigation:
- Keep add-on state as entitlement toggle only for now; complete signed webhook bridge in next phase (Milestone 10A).

Final Ruling:
- Option 2 approved and implemented for baseline.

### Topic: Memory-bank Enforcement Bootstrapped
Date_UTC: 2026-02-19
Owner: mb-init

Options:
1. Warn mode first, then strict.
2. Strict from day one.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 1 | Lower rollout friction |
| Reviewer B | Option 1 | Easier adoption |

Decision:
- Bootstrap with default mode `warn` (Option 1).

Rationale:
- Start with warnings until process is stable, then move to strict mode.

Risks:
- Warning mode can allow drift if ignored.

Mitigation:
- Flip mode to strict after team baseline is stable.

Final Ruling:
- Option 1 approved by majority vote.

### Topic: Narrate implementation starts with JSON cache before SQLite
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Implement SQLite immediately for Milestone 1.
2. Implement stable cache interface with JSON backend first, then swap to SQLite milestone.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Faster delivery of command/UI flow and provider integration |
| Reviewer B | Option 2 | Lower packaging complexity for first executable build |

Decision:
- Milestone 1 uses JSON cache with a clean `CacheProvider` interface.

Rationale:
- Lets team validate UX and narration behavior now while keeping SQLite upgrade path intact.

Risks:
- JSON cache may be slower at large scale versus SQLite.

Mitigation:
- Keep interface stable and ship SQLite provider in Milestone 8 as planned.

Final Ruling:
- Option 2 approved.

### Topic: Milestone 2 delivery style (section summaries + edu enrichment)
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Keep flat line-by-line output and rely only on model-generated narration quality.
2. Add deterministic section grouping/summaries and apply a local edu term glossary post-processing layer.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Better learner readability and stable UX even when provider is unavailable |
| Reviewer B | Option 2 | Keeps outputs consistent and testable without backend/licensing dependency |

Decision:
- Implement Option 2.

Rationale:
- Milestone 2 requires explicit section summaries and better edu clarity; deterministic local logic ensures predictable behavior.

Risks:
- Heuristic classification may mislabel some language constructs.

Mitigation:
- Keep section builder isolated (`sectionBuilder.ts`) so rules can be tuned quickly by language.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Professional web UX split (marketing vs secure portal)
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Keep all customer/team/admin interactions on the landing page (`/`) and incrementally tidy styling only.
2. Split into clean marketing site (`/`) and dedicated secure portal (`/app`) with sidebar navigation and role-based sections.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Enterprise buyers expect clear app-shell UX and separated control surface |
| Reviewer B | Option 2 | Reduces cognitive overload and improves security posture by isolating operational actions |

Decision:
- Implement Option 2.

Rationale:
- User explicitly rejected single-page operational layout as non-enterprise and requested sidebar application behavior.

Risks:
- Additional frontend routing/state complexity in static JS app.

Mitigation:
- Keep lightweight tab-state in one script and expose all operational behavior through authenticated APIs.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Customer account and enterprise team-admin UX channel
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Keep only `x-admin-key` routes for team governance and leave customer web panel checkout-only.
2. Add auth-based customer account APIs and owner/manager team self-service routes directly behind signed-in web session.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Required for real-world customer testing (billing/support/history) without exposing admin key |
| Reviewer B | Option 2 | Aligns enterprise onboarding requirement: delegated manager control and policy updates from secure user auth |

Decision:
- Implement Option 2.

Rationale:
- User explicitly requested real customer account capability plus enterprise team-admin operations for testing.

Risks:
- Runtime still JSON-store based and does not yet enforce full table-backed admin RBAC.

Mitigation:
- Keep management access restricted to authenticated team owner/manager memberships and plan Prisma RBAC cutover in hardening phase.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Postgres rollout strategy for current licensing server
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Replace JSON store with Prisma in one large cutover change.
2. Provision Prisma schema/tables first, then migrate runtime handlers incrementally.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces migration risk and allows DB validation immediately |
| Reviewer B | Option 2 | Keeps service operational while moving persistence in controlled slices |

Decision:
- Implement Option 2.

Rationale:
- User requested immediate real Postgres setup; this approach delivers a live schema now without destabilizing existing routes.

Risks:
- Temporary dual-state (JSON runtime vs Postgres schema) until handler migration is complete.

Mitigation:
- Document current state clearly and prioritize service-layer migration next milestone.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Access-panel exposure on public landing page
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Keep checkout/offline/redeem controls fully visible on public landing.
2. Gate billing/redeem controls behind authentication and reveal after sign-in.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces user confusion/noise and avoids unauthenticated error spam |
| Reviewer B | Option 2 | Cleaner buyer funnel: sign-in first, then transactional actions |

Decision:
- Implement Option 2.

Rationale:
- User requested that the page feel less exposed and suggested sign-in first for access.

Risks:
- Slightly more frontend state logic and OAuth path branching.

Mitigation:
- Added explicit auth-state banner and kept public marketing content unchanged.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Landing page architecture for payment + onboarding
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Build a separate web app/repo before shipping any browser onboarding.
2. Serve a static landing/onboarding surface from the existing Fastify backend now.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Fastest path to publishable pricing/security page and immediate checkout testing |
| Reviewer B | Option 2 | Keeps auth/payment API and onboarding UI in one deployable service for MVP |

Decision:
- Implement Option 2.

Rationale:
- User requested immediate web-first purchase flow and marketing page while keeping extension and backend velocity.

Risks:
- Hosting UI inside API service can become harder to scale independently later.

Mitigation:
- Keep pages static and isolated under `server/public`; production phase can split into dedicated frontend without breaking APIs.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Checkout UX channel (VS Code vs web)
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Attempt in-editor payment UX inside extension webviews.
2. Generate server checkout session and open external browser payment flow.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Aligns with Stripe Checkout best-practice and avoids sensitive payment handling in extension runtime |
| Reviewer B | Option 2 | Reduces compliance risk and keeps payment UI maintainable |

Decision:
- Implement Option 2.

Rationale:
- Payment should happen on hosted Stripe Checkout/web pages; extension only initiates session and refreshes entitlement.

Risks:
- Requires backend config (`STRIPE_SECRET_KEY`, price map, webhook secret) and web success/cancel URLs.

Mitigation:
- Added environment-based configuration and explicit server docs.

Final Ruling:
- Option 2 approved and implemented.

### Topic: GitHub sign-in integration strategy
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Keep GitHub auth as backend-only placeholder until production web app exists.
2. Implement loopback callback bridge so extension can complete OAuth in current local architecture.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Allows immediate GitHub sign-in validation for local extension users |
| Reviewer B | Option 2 | Preserves secure OAuth model while enabling extension token capture without embedding secrets |

Decision:
- Implement Option 2.

Rationale:
- Extension opens `/auth/github/start` and captures callback on localhost loopback, then stores access token and refreshes license.

Risks:
- Requires loopback callback restrictions to avoid token redirection abuse.

Mitigation:
- Server enforces localhost callback URL validation and one-time expiring OAuth state records.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Milestone 3 gate strategy before backend licensing
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Keep export features always enabled until backend is ready.
2. Introduce local placeholder plan gate now, then replace gate source with backend entitlements later.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Validates UX behavior for gated features early |
| Reviewer B | Option 2 | Avoids command contract changes when backend arrives |

Decision:
- Implement Option 2.

Rationale:
- Milestone 3 explicitly requires export with Pro-gating placeholder.

Risks:
- Local config can be manually changed and is not secure licensing enforcement.

Mitigation:
- Treat as development placeholder only; final enforcement moves server-side in licensing milestone.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Milestone 4 git report data source
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Build change report from local git diff (`git diff HEAD`) and parse unified diff directly in extension.
2. Delay report until backend service exists and rely on remote diff computation.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 1 | Milestone 4 requires local functionality now |
| Reviewer B | Option 1 | Keeps feature local-first and aligns with product goals |

Decision:
- Implement Option 1 for Milestone 4.

Rationale:
- Produces immediate user value with no backend dependency and supports offline/local-first workflow.

Risks:
- Untracked files are not fully represented in `git diff HEAD`.

Mitigation:
- Document current behavior and extend parser/data source in follow-up if needed.

Final Ruling:
- Option 1 approved and implemented.

### Topic: Milestone 6 delivery strategy (payments/offline/redeem/affiliate)
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Delay all commercial flow routes until production Postgres/OAuth/Stripe signature validation are complete.
2. Implement local milestone-complete routes now in Fastify JSON store, then harden provider-specific security in production phase.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Unblocks extension-side redeem/device flows and validates end-to-end contracts now |
| Reviewer B | Option 2 | Preserves roadmap momentum while keeping server-side business logic centralized |

Decision:
- Implement Option 2.

Rationale:
- Current phase required functional routes for payments/offline/redeem/affiliate and extension command integration, not production infra hardening.

Risks:
- Local webhook/OAuth behavior is intentionally simplified and not production-safe yet.

Mitigation:
- Explicitly document that Stripe signature validation, OAuth app wiring, and Postgres migration are next hardening tasks.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Admin identity separation from customer users
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Reuse `users` for both customers and admins with a role flag.
2. Create dedicated `admin_*` tables for admin accounts, roles, permissions, scope assignment, and audit logs.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Prevents accidental privilege crossover and keeps governance isolated |
| Reviewer B | Option 2 | Supports board/admin/shop-assistant hierarchy with clear scope boundaries |

Decision:
- Implement Option 2.

Rationale:
- User requested that admin tables not be mixed with end-user data, especially for delegated assistant operations when primary department owners are unavailable.

Risks:
- Initial runtime still uses header key admin auth and not table-backed RBAC checks.

Mitigation:
- Keep admin data model provisioned in Postgres now; migrate admin auth/policy handlers to Prisma-backed RBAC in hardening phase.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Production ingress strategy for `pg-ext.addresly.com`
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Keep direct A-record to server IP only.
2. Install Cloudflare Tunnel tooling now and keep both direct IP DNS and tunnel-ready automation.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Enables immediate live demo and safer migration path to tunnel-only ingress |
| Reviewer B | Option 2 | Avoids last-minute deployment risk by preparing scripts now |

Decision:
- Implement Option 2.

Rationale:
- User explicitly requested domain `pg-ext.addresly.com` and Cloudflare tunnel readiness now.

Risks:
- Named tunnel setup still requires Cloudflare account login/token interaction.

Mitigation:
- Added automated PowerShell helper (`scripts/setup_cloudflare_tunnel.ps1`) with quick, named, and service-token modes.

Final Ruling:
- Option 2 approved and implemented.

### Topic: OAuth runtime config source in backend
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Require shell/session env exports for OAuth keys and keep server code unchanged.
2. Load `server/.env` automatically in backend startup using `dotenv/config`.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Prevents live runtime drift where OAuth appears configured in file but missing in process |
| Reviewer B | Option 2 | Reduces operator error during domain/tunnel deployment |

Decision:
- Implement Option 2.

Rationale:
- User observed `Google/GitHub OAuth is not configured on this server` while keys were already present in `.env`.

Risks:
- Secret file handling remains sensitive on host machine.

Mitigation:
- Keep secrets in protected server environment and rotate keys if exposed.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Hide predictable admin route surface
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Keep `/admin/*` endpoint namespace and rely only on auth checks.
2. Move admin/super-admin operational routes to a non-obvious namespace and keep strict auth checks.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces low-effort route scanning/noise and better matches enterprise expectation of isolated control surface |
| Reviewer B | Option 2 | Preserves existing auth while removing publicly guessable admin path naming |

Decision:
- Implement Option 2.

Rationale:
- User requested that global admin controls should not appear under obvious `/admin` paths and should be separated from tenant enterprise UX.

Risks:
- Security-through-obscurity alone is insufficient.

Mitigation:
- Keep bearer/session auth, super-admin allowlist (`SUPER_ADMIN_EMAILS`), and admin key checks mandatory on all privileged routes.

Final Ruling:
- Option 2 approved and implemented using `/pg-global-admin/*`.

### Topic: Admin control auth model (DB RBAC vs header key)
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Keep `x-admin-key` as primary auth for privileged operations.
2. Enforce DB-backed RBAC permissions by default and keep key mode only as explicit fallback.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Role/permission checks must stay server-side in DB for enterprise trust and delegated admin controls |
| Reviewer B | Option 2 | Removes frontend-exposed privilege assumptions and aligns with zero-trust direction |

Decision:
- Implement Option 2.

Rationale:
- User explicitly requested DB-enforced roles/permissions and stronger security posture for enterprise onboarding.

Risks:
- If DB admin tables are empty, operators can be locked out.

Mitigation:
- Added startup RBAC baseline seeding (`ADMIN_RBAC_BOOTSTRAP=true`) and bootstrap email assignment (`ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS`).
- Kept controlled emergency mode via `ADMIN_AUTH_MODE=hybrid|key`.

Final Ruling:
- Option 2 approved and implemented (`ADMIN_AUTH_MODE=db` default).

### Topic: Governance sync channel for PG EOD / PG Mastermind
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Build dedicated mobile app first and defer Slack integration.
2. Launch Slack-first secure gateway, keep local Memory-bank as source-of-truth, and add mobile app later.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Faster enterprise rollout, lower delivery risk, and existing reviewer adoption via Slack |
| Reviewer B | Option 2 | Keeps code memory local while still enabling centralized governance decisions |

Decision:
- Implement Option 2.

Rationale:
- User requested immediate practical workflow and agreed Slack is simpler/safer for first integration.

Risks:
- Decision events can be missed if local client is offline for long periods.
- Slack command ingress can be abused if signature verification/replay checks are weak.

Mitigation:
- Add pull-based decision queue with cursor + explicit local ack states (`pending/applied/conflict`).
- Enforce signed webhook verification, nonce/timestamp replay protection, RBAC checks, and audit logs.

Final Ruling:
- Option 2 approved as roadmap baseline (Milestone 9-12 planning).
