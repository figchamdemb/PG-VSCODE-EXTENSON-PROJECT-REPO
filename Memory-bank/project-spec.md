# Project Spec - Intent, Actors, Flows

LAST_UPDATED_UTC: 2026-03-28 03:30
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
    - GitHub sign-in (browser -> editor callback with trusted deep-link return)
    - trial/redeem/refresh/status/quota/device commands
    - upgrade checkout command that opens browser flow and returns through hosted success/cancel pages into the installed editor when available
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
      - `legacy`: dependency + coding + Playwright smoke
      - `standard` (default): legacy + API contract + DB index maintenance
      - `strict`: standard + future strict-only overlays
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
  - [REQ-2026-03-12-01] Frontend design guardrails baseline:
    - repo-default UI pattern guide for dashboard/app/help/pricing/admin work
    - agent-facing policy metadata that points UI tasks to the design guide
    - guard checks that keep changed frontend files on semantic layout/control patterns and shared token usage
    - explicit rule that user-supplied design guides override repo defaults
    - explicit rule that implementations should be similar in pattern language, not copied one-to-one from references
  - [REQ-2026-03-12-02] Agent-specific startup override docs for Antigravity/Gemini:
    - root explainer for repo enforcement vs extension/editor enforcement boundaries
    - stronger top-of-file startup override language in `ANTIGRAVITY.md` and `GEMINI.md`
    - optional `.agents/workflows/startup.md` helper for tools that support repo workflow shortcuts
    - explicit stop-if-startup-fails wording so extension-based agents are less likely to skip Memory-bank bootstrapping
  - [REQ-2026-03-13-01] Extension-native startup context enforcement:
    - detect the nearest active `AGENTS.md` / `pg.ps1` context from the current file or workspace
    - auto-run `.\pg.ps1 start -Yes` once per context per day and require a rerun when the active context changes
    - surface clear startup-failure state in the extension instead of silently continuing
    - add an explicit manual retry command for the current context
    - keep repo hooks/scripts as backstop enforcement after extension-side startup gating
  - [REQ-2026-03-13-02] Validation-library detection/install must use the active project root:
    - resolve the nearest relevant `package.json` from the active file instead of assuming the VS Code workspace root
    - stop showing repeated Zod/install prompts when the current project already has supported validation configured
    - install libraries into the active app/service root, not the umbrella workspace folder
    - preserve safe warning behavior for non-Node stacks that legitimately do not use npm-based validation
  - [REQ-2026-03-15-01] Frontend design guardrails must cover secure mobile app pattern families and button grammar:
    - extend the repo-default UI guide with mobile secure-authenticator examples derived from user-supplied references
    - cover setup, approval, OTP reveal, and vault-state screens as reusable pattern families for Kotlin/Jetpack Compose and React-based mobile surfaces
    - document button hierarchy and interaction grammar for primary, secondary, destructive, biometric/FAB, and bottom-nav actions
    - keep the implementation rule as similar-not-copy even when the user provides rich reference screens
    - treat the approved references as selectable pattern families so builders pick the closest fit instead of reproducing every motif on every screen
    - update frontend guard enforcement so the mobile/button guidance remains part of the required policy surface
  - [REQ-2026-03-15-02] Annual Stripe SKU alignment + honest pricing surfaces:
    - keep Free and Trial / EDU outside Stripe billing while making that distinction explicit on public pricing surfaces
    - publish the exact 9 paid annual sellable SKUs (`pro|team|enterprise` x `narrate|memorybank|bundle`) across the public site and admin runtime guidance
    - describe the current payment truth accurately: Stripe checkout is one-time `payment` mode that represents one year of access, not native recurring subscription billing
    - align landing-page copy, `/pricing`, `/app` billing hints, and `.env.example` placeholders around the same SKU map and annual price guidance
    - avoid claiming automated per-seat or recurring subscription mechanics until the backend checkout model actually supports them
  - [REQ-2026-03-15-03] Admin-editable public pricing guide + lower starter pricing:
    - decouple public-facing pricing copy from Stripe price IDs so website and portal pricing can be adjusted from the admin board without editing HTML
    - add a public pricing-catalog route and admin runtime field for plan headlines, SKU copy, and starter-package notes
    - lower the default starter pricing guidance to modest annual entry points for solo developers and small teams
    - keep Free and Trial / EDU outside Stripe billing, while treating team and enterprise pricing as base packages rather than automatic per-seat billing
    - keep actual Stripe checkout mapping in the separate 9-key `STRIPE_PRICE_MAP`, so changing Stripe charge amounts later only requires new `price_...` IDs plus map updates
  - [REQ-2026-03-16-01] Structured admin pricing editor + self-check clarity:
    - replace the raw JSON-first pricing catalog admin input with field/card-based controls for plan cards, SKU pricing rows, and explanatory notes
    - keep the JSON payload contract (`pricing_catalog_raw`) stable underneath the friendlier editor so runtime/storage code and public pricing routes do not change shape
    - preserve an advanced JSON view/import path for manual overrides, but make the field editor the default operational path for non-technical admins
    - clarify in product/admin guidance that current strict self-check failures are local backend/policy API connectivity blockers when `127.0.0.1:8787` is unavailable, not necessarily Playwright browser failures
    - keep Cloudflare tunnel usage as a hosted/public ingress aid, but do not present it as a replacement for the local backend health required by `pg start` / `pg self-check`
  - [REQ-2026-03-16-02] Marketplace icon wiring + easier local admin sign-in:
    - wire a real Narrate Marketplace icon into the VS Code extension manifest instead of shipping without a package icon
    - use the Narrate product mark for the extension package rather than the Memory Bank logo, because the current Marketplace artifact is the Narrate extension
    - enable an easier local-only admin test path by allowing email OTP + dev-code exposure in the local runtime config, without changing production defaults in `.env.example`
    - keep local admin testing centered on `/app` and `127.0.0.1:8787`; Cloudflare tunnel remains optional for public-hostname checks, not a prerequisite for local verification
  - [REQ-2026-03-17-01] Frontend/backend staged integration handoff workflow:
    - always scaffold a dedicated frontend integration surface in Memory-bank for every installed project
    - use a shared staged ledger where backend publishes tested integration steps and frontend consumes them
    - structure that ledger as one summary dashboard markdown plus page-by-page markdown working files instead of one large transcript file
    - backend should extract and publish OpenAPI/Swagger inputs when present, with backend-route inference fallback and optional Postman support when available
    - each step should include request/response examples, headers, auth notes, smoke-test proof, DB verification notes, explicit frontend instructions, and credential/test-account prerequisites
    - frontend should poll or watch for `ready_for_frontend` steps, integrate them, run Playwright smoke, attach screenshots/proof, and mark completion back into the same ledger
    - frontend must not fix backend code directly; backend must not fix frontend code directly; both roles may only use the shared integration ledger for cross-role findings and responses
    - frontend must be able to raise structured findings for backend defects, missing credentials, wrong behavior, or developer-required auth/environment actions, and backend must answer those findings in the same ledger
    - both backend and frontend roles must publish explicit agent identities including role ID and model name in the summary and machine-readable state
    - the summary dashboard must act as the polling/index page, with links to dedicated page files such as login and dashboard, plus pending correction buckets and completion state
    - when frontend raises a backend correction, backend must see that from the same summary poll loop and respond back into the linked page with evidence and timestamp
    - support both canonical single-token CLI commands and natural-language alias forms that resolve to the same handlers
    - split local-visible Memory-bank evidence from server-side/private orchestration and policy enforcement so the harder-to-copy control layer can remain protected
    - enforce a maximum of 500 lines per integration markdown page and require frontend completion records to include frontend screen/page line-count and trust/self-check validation status
    - enforce the presence of the frontend integration artifacts through bootstrap and Memory-bank guard rules
  - [REQ-2026-03-17-02] Server-backed frontend integration orchestration mirror:
    - add authenticated server routes that persist per-repo frontend integration workflow state and audit history outside the local markdown ledger
    - let existing `pg` integration commands sync through the server when an access token is available, while preserving local-only fallback when the repo is offline or unauthenticated
    - enforce protected transition validation server-side for role claims, ready/completion handoffs, frontend findings, backend responses, heartbeat freshness signals, and frontend page line-count limits
    - keep the local Memory-bank summary/page files as the human-readable working surface, but treat server state as the authoritative orchestration mirror when authenticated sync is active
    - retain a per-workflow audit trail so the harder-to-copy orchestration and review history are no longer stored only in local markdown files
  - [REQ-2026-03-19-03] Persistent local integration role-watch mode:
    - allow `backend-start` and `frontend-start` to enter the existing integration watch loop directly when requested instead of forcing a second `integration-watch` command
    - keep the heartbeat loop local-first against `Memory-bank/frontend-integration/state.json` and summary markdown while preserving optional server sync when authenticated
    - use the same 30-second default cadence and stale-heartbeat policy already defined for the integration workflow so autonomous role sessions do not fork a second protocol
    - preserve the existing non-persistent role-claim behavior by default to avoid breaking current operator and agent workflows
  - [REQ-2026-03-19-04] Autonomous integration worker stop/end controls + minimal local runtime control:
    - allow a second local command to stop or end a running persistent backend/frontend integration worker without killing the entire shell manually
    - persistent workers must notice that stop/end request on the next heartbeat cycle and exit cleanly with a final `stopped` or `completed` role status
    - keep the runtime stop/end control surface minimal and local in a generated control file instead of adding more human-facing transcript files to Memory-bank
    - preserve the existing server-backed orchestration mirror and audit trail as the protected control layer when authenticated sync is active
  - [REQ-2026-03-19-05] Tamper-evident integration runtime + entitlement-gated worker lease:
    - keep full backend/frontend integration detail server-authoritative when authenticated and store only a redacted local projection on disk
    - encrypt the local runtime worker-control file so casual folder inspection or edits do not expose or trivially alter worker control state
    - require active integration entitlement server-side for authenticated orchestration access instead of trusting only a previously issued local token
    - issue and rotate a short-lived server-backed worker lease on every authenticated integration heartbeat so revoked access or copied local files stop working on the next sync cycle
    - expose a dedicated `integration-worker` command so persistent role workers use the guarded lease path directly rather than relying only on role-start ergonomics
  - [REQ-2026-03-19-06] Mandatory-until-stop local startup enforcement:
    - once Narrate sees PG, `AGENTS.md`, or `Memory-bank` evidence for a workspace, local startup enforcement stays active across restarts until the user explicitly stops it
    - if the normal `pg.ps1` startup context disappears or breaks later, the extension must fail closed locally with repeated modal prompts instead of silently skipping enforcement
    - save flow and guarded workflow commands must refuse continuation while mandatory startup enforcement is unresolved
    - provide explicit local stop/resume commands so the user can deliberately terminate or restore enforcement without depending on backend availability
  - [REQ-2026-03-19-07] Exact reading sync + PG terminal enforcement bridge:
    - when the user selects code lines in Narrate exact view, the matching narration rows should auto-highlight and scroll into view without manual line-number matching
    - when the user selects narration rows in the exact view, the matching source lines should mirror the same highlight so the mapping stays bidirectional
    - side-by-side exact view should preserve focus on the source editor so reading can start from code while the narration pane follows automatically
    - PG-branded terminal commands must be able to stop or resume the same local mandatory enforcement state through a minimal generated bridge file rather than requiring manual command-palette use
  - [REQ-2026-03-20-01] PG local review-worker orchestration:
    - add a local-first builder/reviewer workflow that reuses the existing PG worker heartbeat model instead of ad hoc chat handoff
    - builder and reviewer must communicate only through a shared PG review ledger plus machine-readable runtime state
    - builder writes code, runs validation, and posts review-ready results; reviewer posts structured findings, references, and verdicts without editing implementation code directly
    - builder must consume reviewer findings on the next heartbeat cycle, patch and re-test, then reply in the same review ledger until the reviewer marks the round approved
    - use the same local stop/end control style and heartbeat/stale-worker policy already proven by the frontend/backend integration workflow
    - start with a local-only baseline, then harden it without replacing the same builder/reviewer ledger model
  - [REQ-2026-03-20-02] Secure server-backed review workflow + customer-visible paid surfacing:
    - add authenticated server routes that persist per-repo review workflow state and audit history outside the local markdown ledger
    - let existing `pg review-*` commands sync through the server when an access token is available, while preserving local-only fallback when the repo is offline or unauthenticated
    - enforce protected transition validation server-side for role claims, review findings, builder responses, approvals, workflow completion, and heartbeat freshness signals
    - require active paid entitlement server-side for authenticated review orchestration access and rotate a short-lived worker lease on every authenticated sync so revoked access or copied local files stop working quickly
    - keep local Memory-bank summary/page/state files as the working surface, but write them as redacted projections when authenticated sync is active so full review detail remains server-authoritative
    - encrypt the local runtime worker-control file so stop/end control is not stored as editable plaintext JSON on disk
    - expose the secure review workflow clearly in customer-visible paid surfaces such as pricing/help copy for Pro, Team, and Enterprise while keeping it unavailable on Free and Trial
  - [REQ-2026-03-20-03] Non-breaking PG scaffold upgrade command:
    - add a first-class scaffold upgrade path that refreshes repo-local PG tooling files in existing user repositories without deleting project history or Memory-bank records
    - preserve user-authored Memory-bank history, generated project maps, repo-specific notes, and application source while only replacing versioned PG scaffold assets
    - support both a repo-local upgrade command for already-modern repos and a bootstrap-compatible upgrade entrypoint for stale repos whose local `pg.ps1` does not yet expose the new command
    - require dry-run preview, backup manifest output, overwrite classification rules, and explicit post-upgrade validation so enterprise rollout is auditable and reversible
    - keep additive install/bootstrap behavior available, but separate it clearly from the explicit scaffold-upgrade path so future releases can advance existing repos safely
  - [REQ-2026-03-20-04] Browser-to-editor licensing return flow:
    - allow extension sign-in to start in the browser and return directly into the installed editor without manual localhost callback handling by the customer
    - keep hosted OAuth and checkout web flows intact while adding trusted editor deep-link return targets for VS Code-family clients
    - preserve a secure allowlist for callback schemes and extension hosts instead of accepting arbitrary custom callback targets
    - route Stripe checkout through hosted success/cancel pages that can bounce back into the editor, because Stripe success/cancel URLs must remain normal web URLs
    - auto-refresh the entitlement on successful editor return so the license becomes active for the current device without requiring a manual second step in the common path
  - [REQ-2026-03-17-03] Mandatory Playwright enforcement + local auth smoke clarity:
    - make Playwright smoke mandatory in `pg self-check` and `pg prod` instead of leaving it as a UI-only or strict-profile-only option
    - keep the shipped mandatory smoke baseline credential-light by validating the local server `/health` and `/` routes first
    - document both local auth-path testing modes in `server/.env`: normal manual code entry with `ENABLE_EMAIL_OTP=true`, plus optional local-only `dev_code` exposure with `EXPOSE_DEV_OTP_CODE=true`, without changing the production-safe `.env.example` defaults
    - require Memory-bank finalization guards to reject latest strict self-check summaries that omit the mandatory Playwright stage
  - [REQ-2026-03-27-01] Evidence-first Playwright reporting + frontend baseline scaffold:
    - make `pg playwright-smoke-check`, `pg self-check`, and `pg prod` emit persistent Playwright evidence artifacts instead of console-only pass/fail output
    - capture HTML and JSON reports plus failure traces, screenshots, and videos under `Memory-bank/_generated/` so agents have concrete debugging proof
    - surface artifact/report paths in the latest self-check summary so users and agents can open the exact failing run quickly
    - support browser-matrix execution modes (`minimal`, `desktop`, `full`) so operators can choose between fast smoke validation and broader course-style coverage
    - auto-retry with browser installation when Playwright fails only because required browsers are missing
    - extend PG frontend project setup so Node-based frontend repos can start from a real Playwright config and smoke spec baseline instead of an empty testing policy
    - document the agent policy for project-specific Playwright authoring: inspect the frontend, create meaningful smoke flows, prefer stable locators, and rely on generated artifacts for fix-proof
  - [REQ-2026-03-27-02] Playwright authored full-suite workflow + failure evidence summaries:
    - add `pg playwright-author` so the local agent can inspect Node frontend routes/forms and generate a managed Playwright suite instead of relying only on hand-written smoke files
    - generate grouped authored specs for route coverage, form surfaces, suspicious-input hardening, baseline accessibility, and commerce-like flows under a PG-managed test directory
    - add `pg playwright-full-check` as the one-shot author + run wrapper that publishes a final latest summary after the authored full browser matrix completes
    - emit machine-readable and markdown failure summaries (`failures.json`, `failures.md`) from the Playwright JSON report so agents can open the exact failing test, artifact bundle, and attachment paths before fixing
    - keep retained HTML/JSON reports plus trace, screenshot, video, and error-context evidence bound to the authored suite so the fix loop is proof-driven rather than console-only
  - [REQ-2026-03-18-01] Stripe runtime secret hardening:
    - keep real Stripe test/live keys in `server/.env` or an external deployment secret manager, not in `server/.env.example`
    - allow the super-admin Stripe config board to persist secrets only when `STRIPE_RUNTIME_VAULT_KEY` is configured
    - encrypt Stripe secret values at rest inside `STRIPE_RUNTIME_CONFIG_PATH` when board-driven persistence is enabled
    - preserve masked hint-only admin UX so secret values are never echoed back into browser responses
    - keep env-seeded Stripe test keys fully supported for local testing when encrypted runtime persistence is not needed
  - [REQ-2026-03-18-02] Enterprise Custom pricing + integration entitlement clarity:
    - keep the standard 9-key Stripe self-serve SKU map intact for Pro, Team, and standard Enterprise annual checkout
    - add clear seat, device, and Memory-bank limit guidance to the public pricing surface for Free, Pro, Team, and Enterprise standard packages
    - introduce Enterprise Custom as a quote/invoice/manual-activation path on the pricing surfaces instead of a new public checkout plan enum
    - make the frontend/backend integration workflow explicitly visible as a Pro, Team, and Enterprise entitlement while keeping it unavailable on Free and Trial
    - keep custom enterprise expansions bounded by agreed caps rather than promising unlimited seats or unlimited Memory-bank usage
  - [REQ-2026-03-18-03] TapSign staged portal login protection UX:
    - add a visible `Sign Up with TapSign` action above the existing GitHub and Google login buttons in the secure portal auth shell without removing or blocking the current providers
    - make the portal explain that Google, GitHub, and email can still establish the base session first, but TapSign is intended to become the final device-backed login approval layer
    - once a user is signed in through an existing provider, keep prompting them inside the portal to finish TapSign protection until real SDK-backed enrollment is delivered
    - implement this as UX scaffolding only for now so the later SDK can plug in without having to redesign the portal auth shell or signed-in reminder surface
  - [REQ-2026-03-19-01] Referral discount + tiered affiliate rewards:
    - keep the existing affiliate-code and manual payout approval flow as the operational base instead of creating a second promotion system
    - allow a valid referral code to act as a buyer promotion on self-serve annual checkout so referred customers can receive a small fixed discount
  - [REQ-2026-03-19-02] AGENTS.md integrity protection + startup resilience:
    - protect the repo-root `AGENTS.md` with a local read-only attribute plus a sealed integrity hash stored under `Memory-bank/_generated/agents-integrity.json`
    - verify that seal during `./pg.ps1 start -Yes` before Memory-bank refresh and enforcement work continue
    - automatically initialize or repair read-only protection when the file contents still match the sealed hash, while failing closed on unexpected content changes
    - reseal AGENTS protection during hook installation so existing repos get the same safeguard without requiring a manual step
    - keep referrer earnings tied to confirmed paid conversions, not raw clicks or sign-ups, and preserve the existing manual payout approval step
    - support tiered referrer rewards so the effective commission can increase after more successful paid referrals instead of staying flat forever
    - make the referral-program rules visible in the public pricing guidance and secure portal billing hints so operators and influencers understand the current promotion model
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
- UI work must read the active design reference first: use the user's design guide when provided, otherwise use `docs/FRONTEND_DESIGN_GUARDRAILS.md`.
- UI implementations should preserve similar layout/control patterns (shell, cards, button hierarchy, dropdown treatment, dashboard flow) without copying external reference designs exactly unless the user explicitly requests a direct match.
- Secure mobile UI work should keep status-led shells and explicit action variants (`primary`, `secondary`, `destructive`, `fab`, `nav`) across Kotlin/Jetpack Compose and React-based surfaces when using the design guide or user-supplied references.
- Agent-specific repo instruction files (`ANTIGRAVITY.md`, `GEMINI.md`, similar tool entry docs) should mirror the startup contract from `AGENTS.md` with explicit stop-if-startup-fails wording, but they do not replace hook/script enforcement.
- Premium framework/checklist policy content must not ship in plaintext with repo-facing AGENTS/runtime bundles for non-enterprise tiers.
- Default commercialization path is cloud-first policy/scoring for Free/Student/Team; enterprise offline encrypted policy packs are a later add-on.
- Dependency add/upgrade actions must pass strict server-side verification (registry freshness, deprecation, compatibility, vulnerability, maintenance, and native-alternative checks) before approval.
- `pg prod` must fail closed when dependency verification fails and return explicit remediation reasons.
- `pg prod` Playwright smoke gate must fail closed if Playwright setup is missing or smoke tests fail.
- Latest strict `pg self-check` summaries must include the mandatory Playwright stage before code-change finalization is allowed.
- Coding standards enforcement should use profile-aware rule IDs and fail closed on blocker-level violations before production approval.
- Query optimization policy must reject unsafe database anti-patterns in enforcement paths (N+1 loops, `SELECT *`, deep `OFFSET`) and require schema/index signals for relational keys.
- Database maintenance diagnostics should be enforceable in strict paths (invalid indexes, missing `pg_stat_statements`, high sequential scan pressure, unused indexes, and autovacuum/analyze lag signals).
- Cloud production readiness checks should be evaluated from metadata-only scanner summaries plus explicit architecture evidence, with stricter blocker policy for regulated workloads.
- Local user-visible guidance may include generic verification outcomes, but private deny-lists/weights/rules remain server-side to protect IP.
- Requests to reveal private policy internals or bypass enforcement must be detected server-side and handled with risk-based controls (warn -> restrict -> escalate).
- Extension-native auto-consumer work is blocked until enforcement baseline milestones (dependency, coding standards, trigger/anti-exfil) are enabled and validated in this repo.
- After any agent file write, a self-check must run and report blocker rule IDs; unresolved blockers must be fixed before task completion.
- Extension auto-consumer must execute decisions locally and ack outcomes (`applied|conflict|skipped`) so Slack/server state reflects actual local execution result.
- Narrate extension startup guard must resolve the nearest active `AGENTS.md`/`pg.ps1` context, rerun `.\pg.ps1 start -Yes` once per context per UTC day, and keep a visible failure state until startup passes.
- For real-time/async/communication features, AI must run a pre-implementation architecture intake and cannot default to polling or synchronous blocking handlers without explicit documented justification and user confirmation.
- Command help content must use real, executable examples (no placeholder `<THREAD_ID>` or `<TOKEN>` in copy-paste blocks) and include an explicit troubleshooting matrix for common failure messages.
- Slack decision grammar must stay explicit in user help:
  - `thread` returns option keys (`opt1`, `opt2`, ...), and `vote`/`decide` should reference those keys.
  - slash command input must start with `/pg` as the first token (no prefixed numbering/text).
- Local dev profile is allowed for development/test credentials only and must remain gitignored local storage; production credentials remain `.env`/vault-managed and are still enforced by production gates.
- Commit guard must block likely real secret values in staged Memory-bank/verification docs; placeholders/examples are allowed but live secrets are not.
- [REQ-2026-03-13-03] Trust Score must become server-owned for private-policy enforcement:
  - add a private server trust evaluation route that accepts active file content plus local-editor diagnostics and returns final trust score/status/findings
  - move visible file-size/controller/validation/function-limit trust rules out of the extension runtime and into the backend evaluator
  - keep local diagnostics collection in Narrate, but let the server own the final trust decision and scoring output
  - make key Narrate workflow commands refuse execution when server-backed trust evaluation returns blockers or trust cannot be evaluated
  - keep only minimal client-side helpers in the extension for editor context, diagnostics capture, and report rendering
- [REQ-2026-03-13-04] Agent handoff must expose dependency/coding warnings and enforce official-doc review before major upgrades:
  - persist latest dependency and coding verification findings into `Memory-bank/_generated/self-check-latest.json`
  - include latest dependency/coding enforcement findings in Narrate change-handoff prompts so external agents can see them
  - when dependency freshness/major-version warnings exist, handoff policy must explicitly require checking official vendor docs/release notes/changelog before proposing or applying upgrades
- [REQ-2026-03-13-05] Server-backed dependency review advice must turn freshness warnings into actionable guidance:
  - add a backend dependency review route that accepts warning targets and returns recommendation status plus official vendor source links
  - include official registry/homepage/repository/release-note/changelog sources when they can be resolved from package metadata
  - persist dependency review results into `Memory-bank/_generated/self-check-latest.json` so external agents and handoff prompts can read them
  - extend Narrate handoff prompts to include review action/status and official source URLs for dependency warnings that need follow-up
- [REQ-2026-03-13-06] NestJS coding policy must explicitly cover module simplicity, naming, secret safety, and reuse:
  - document that NestJS modules should stay small and avoid over-engineered provider/import/controller aggregation
  - document that existing logic should be reused before creating another same-purpose service/helper/module block unless separation is necessary
  - document that secrets/credentials must never be committed in source code
  - document that NestJS module names should be meaningful and not placeholder/generic
  - add server-side coding checks for the enforceable subset: hardcoded secret literals/private-key blocks, overgrown NestJS module metadata, and placeholder-like NestJS module names
- [REQ-2026-03-15-01] Frontend design guardrails must cover secure mobile app pattern families and button grammar:
  - extend the repo-default UI guide with mobile secure-authenticator examples derived from user-supplied references
  - cover setup, approval, OTP reveal, and vault-state screens as reusable pattern families for Kotlin/Jetpack Compose and React-based mobile surfaces
  - document button hierarchy and interaction grammar for primary, secondary, destructive, biometric/FAB, and bottom-nav actions
  - keep the implementation rule as similar-not-copy even when the user provides rich reference screens
  - treat the approved references as selectable pattern families so builders pick the closest fit instead of reproducing every motif on every screen
  - update frontend guard enforcement so the mobile/button guidance remains part of the required policy surface


