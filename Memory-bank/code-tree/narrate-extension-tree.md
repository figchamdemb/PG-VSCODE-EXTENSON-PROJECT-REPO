# Narrate + Licensing Code Tree

LAST_UPDATED_UTC: 2026-02-21 23:40
UPDATED_BY: codex

## Extension Root
- `extension/package.json`: VS Code manifest, commands, settings, scripts.
- `extension/tsconfig.json`: TypeScript build config.
- `extension/src/extension.ts`: activation entrypoint, command wiring, status bar state.
- `extension/.vscode/launch.json`: extension-host debug profile.
- `extension/.vscode/tasks.json`: compile task used by debug prelaunch.

## Extension Commands
- `extension/src/commands/toggleReadingMode.ts`: opens narration view; enforces Edu/trial gate before Edu mode.
- `extension/src/commands/switchNarrationMode.ts`: mode QuickPick; enforces Edu/trial gate for Edu selection.
- `extension/src/commands/requestChangePrompt.ts`: structured patch prompt generation/copy.
- `extension/src/commands/exportNarrationFile.ts`: current-file narration markdown export (Pro+ gate).
- `extension/src/commands/exportNarrationWorkspace.ts`: workspace narration export bundle (Pro+ gate).
- `extension/src/commands/generateChangeReport.ts`: narrated git diff report generation (Pro+ gate).
- `extension/src/commands/pgPush.ts`: safe PG git push workflow (git add/commit/push with confirmation).
- `extension/src/commands/authSignIn.ts`: email sign-in trigger.
- `extension/src/commands/authSignInGitHub.ts`: GitHub sign-in trigger.
- `extension/src/commands/startTrial.ts`: manual 48h trial start trigger.
- `extension/src/commands/upgradePlan.ts`: opens browser checkout via backend checkout session URL.
- `extension/src/commands/redeemCode.ts`: redeem code apply trigger.
- `extension/src/commands/manageDevices.ts`: device list/revoke trigger.
- `extension/src/commands/refreshLicense.ts`: entitlement refresh trigger.
- `extension/src/commands/licenseStatus.ts`: license status panel trigger.
- `extension/src/commands/activateProjectQuota.ts`: quota activation for current workspace.
- `extension/src/commands/showProjectQuota.ts`: quota usage/remaining view.
- `extension/src/commands/modeState.ts`: persisted narration mode helper.
- `extension/src/commands/exportUtils.ts`: export path and workspace-relative utilities.

## Extension Licensing
- `extension/src/licensing/featureGates.ts`: backend/placeholder checks, Pro gates, Edu auto-trial attempt, redeem flow, GitHub loopback signin, checkout launch, provider policy checks.
- `extension/src/licensing/entitlementClient.ts`: HTTP client for auth/trial/entitlement/quota/device/redeem/checkout endpoints.
- `extension/src/licensing/tokenVerifier.ts`: JWT verification/decoding.
- `extension/src/licensing/secretStorage.ts`: token/public key/install id secret persistence.
- `extension/src/licensing/projectQuota.ts`: workspace fingerprint generation.
- `extension/src/licensing/plans.ts`: plan normalization/labels.
- `extension/src/licensing/types.ts`: licensing API payload types.

## Narration / Reading Pipeline
- `extension/src/readingView/narrateSchemeProvider.ts`: `narrate://` virtual doc provider.
- `extension/src/readingView/renderNarration.ts`: markdown rendering by section.
- `extension/src/readingView/sectionBuilder.ts`: contiguous code section grouping.
- `extension/src/narration/narrationEngine.ts`: cache-first narration orchestration.
- `extension/src/narration/promptTemplates.ts`: model prompts.
- `extension/src/narration/outputValidator.ts`: schema validation.
- `extension/src/narration/termMemory.ts`: Edu syntax/glossary enrichment.

## Extension Infrastructure
- `extension/src/cache/cacheProvider.ts`: cache interface.
- `extension/src/cache/jsonCacheProvider.ts`: JSON cache backend.
- `extension/src/cache/hashing.ts`: normalized line hashing.
- `extension/src/llm/provider.ts`: provider interface.
- `extension/src/llm/config.ts`: model/provider config resolution.
- `extension/src/llm/openAICompatibleProvider.ts`: OpenAI-compatible request implementation with provider policy checks.
- `extension/src/git/gitClient.ts`: git CLI integration.
- `extension/src/git/diffParser.ts`: unified diff parser.
- `extension/src/git/types.ts`: diff types.
- `extension/src/utils/logger.ts`: output channel logger.

## Licensing Server Root
- `server/package.json`: dev/build/start scripts and dependencies (`@fastify/static`, `prisma`, `@prisma/client`).
- `server/tsconfig.json`: strict server TS config.
- `server/src/index.ts`: Fastify routes for catalog, auth (email/github/google), trial, entitlement, quota, refund, checkout/webhook, offline/redeem, affiliate, team/provider-policy admin, customer account dashboard APIs, governance APIs (EOD/mastermind/vote/decision/sync), signed Slack command bridge, team self-service APIs, super-admin board APIs with configurable admin route + optional Cloudflare Access gate, static page routing (`/` and `/app`), trusted OAuth callback origin checks, and automatic `.env` loading via `dotenv/config`.
- `server/src/store.ts`: JSON persistence store with schema normalization (`normalizeLoadedState`) for migrations, including governance records (`governance_*`, `mastermind_*`).
- `server/src/prismaStore.ts`: Prisma-backed runtime state store for `STORE_BACKEND=prisma` mode (table-by-table persistence across `narate_enterprise.*` runtime tables).
- `server/src/rules.ts`: plan/device/export/report/quota rules.
- `server/src/types.ts`: store record types for auth/subscriptions/entitlements/quota/payments/redeem/affiliate/team/policy/oauth/support/feedback plus governance (EOD/mastermind/sync events/acks).
- `server/prisma/schema.prisma`: PostgreSQL Prisma data model for licensing domain tables in `narate_enterprise` schema, including dedicated `admin_*` governance tables.
- `server/.env.example`: `DATABASE_URL` template for Prisma/Postgres.
- `server/README.md`: endpoint and environment documentation.

## Hosted Web Surface
- `server/public/index.html`: marketing landing page with enterprise positioning and CTA to secure portal.
- `server/public/app.html`: secure sidebar portal app for sign-in, customer billing/support, team admin, governance controls (EOD/mastermind), and super-admin board.
- `server/public/assets/site.css`: branded responsive design system and motion.
- `server/public/assets/app.css`: dedicated portal shell/sidebar/panel styles.
- `server/public/assets/site.js`: browser app logic for sidebar routing, auth state, billing actions, support/feedback, team-admin, governance workflows, and super-admin operations.
- `server/public/terms.html`: terms page.
- `server/public/privacy.html`: privacy page.
- `server/public/checkout-success.html`: payment success page.
- `server/public/checkout-cancel.html`: payment cancel page.
- `server/public/oauth-complete.html`: shared OAuth web callback bridge page (GitHub/Google).
- `server/scripts/smoke-web.mjs`: automated smoke test for landing page assets and web routes.
