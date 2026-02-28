# Narrate + Licensing Code Tree

LAST_UPDATED_UTC: 2026-02-28 18:19
UPDATED_BY: codex

## Extension Root
- `extension/package.json`: VS Code manifest, commands, settings, scripts.
- `extension/tsconfig.json`: TypeScript build config.
- `.vscode/settings.json`: repository workspace defaults (includes strict dead-code PG Push gate for this repo profile).
- `extension/src/extension.ts`: activation entrypoint and command/runtime wiring (status-bar orchestration delegated to activation helper module), post-write enforcement hook wiring, governance auto-sync worker startup, command-help sidebar provider registration, and Trust Score/dead-code/environment diagnostics command wiring.
- `extension/src/activation/statusBars.ts`: status-bar item factory + refresh controller helpers for mode/plan/reading controls.
- `extension/.vscode/launch.json`: extension-host debug profile.
- `extension/.vscode/tasks.json`: compile task used by debug prelaunch.
- `extension/resources/help.svg`: activity bar icon for the Narrate Help container.

## Extension Commands
- `extension/src/commands/toggleReadingMode.ts`: opens narration view; enforces Edu/trial gate before Edu mode.
- `extension/src/commands/switchNarrationMode.ts`: mode QuickPick; enforces Edu/trial gate for Edu selection.
- `extension/src/commands/setNarrationMode.ts`: explicit command wrappers for `setModeDev` / `setModeEdu`.
- `extension/src/commands/switchReadingViewMode.ts`: toggles reading display mode (`exact`/`section`) and re-renders current narration context.
- `extension/src/commands/switchReadingPaneMode.ts`: toggles pane placement (`sideBySide`/`fullPage`) and re-renders current narration context.
- `extension/src/commands/refreshReadingView.ts`: re-renders active narration view from source/narrate context.
- `extension/src/commands/requestChangePrompt.ts`: structured patch prompt generation/copy.
- `extension/src/commands/exportNarrationFile.ts`: current-file narration markdown export (Pro+ gate).
- `extension/src/commands/exportNarrationWorkspace.ts`: workspace narration export bundle (Pro+ gate).
- `extension/src/commands/generateChangeReport.ts`: narrated git diff report generation (Pro+ gate).
- `extension/src/commands/generateCodebaseTour.ts`: workspace architecture tour command orchestration (scan + report open).
- `extension/src/commands/codebaseTourReport.ts`: codebase-tour markdown report renderer.
- `extension/src/commands/codebaseTourTypes.ts`: shared codebase-tour types/settings/constants.
- `extension/src/commands/pgPush.ts`: safe PG git push workflow (enforcement preflight + Trust Score gate mode `off/relaxed/strict` + dead-code gate mode `off/relaxed/strict` for high-confidence unused findings with one-click `Apply Safe Fixes + Recheck` path + commit-quality gate mode `off/relaxed/strict` + git add/commit/push with confirmation).
- `extension/src/commands/authSignIn.ts`: email sign-in trigger.
- `extension/src/commands/authSignInGitHub.ts`: GitHub sign-in trigger.
- `extension/src/commands/startTrial.ts`: manual 48h trial start trigger.
- `extension/src/commands/upgradePlan.ts`: opens browser checkout via backend checkout session URL.
- `extension/src/commands/redeemCode.ts`: redeem code apply trigger.
- `extension/src/commands/manageDevices.ts`: device list/revoke trigger.
- `extension/src/commands/openCommandHelp.ts`: opens/focuses command-help sidebar container.
- `extension/src/commands/createDeadCodeCleanupBranch.ts`: safe dead-code cleanup branch workflow (create/switch branch, run scan, open report).
- `extension/src/commands/applySafeDeadCodeFixes.ts`: safe dead-code autofix workflow (organize imports on high-confidence files, then before/after rescan + report).
- `extension/src/commands/runCommandDiagnostics.ts`: runs one-click local diagnostics and opens markdown report with pass/fail + fix hints.
- `extension/src/commands/runDeadCodeScan.ts`: report-only dead-code candidate scanner with confidence tiers (TypeScript unused diagnostics + local import-graph orphan detection).
- `extension/src/commands/runEnvironmentDoctor.ts`: scans workspace env references, reports missing/unused/exposed `.env`/`.env.example` drift, and supports quick-fix `.env.example` placeholder append command.
- `extension/src/commands/runApiContractValidator.ts`: API Contract Validator command entrypoint (license gate + progress + report output), plus simplified aliases (`OpenAPI Check`) and fix-handoff command registration.
- `extension/src/commands/apiContractAnalyzer.ts`: contract-validation orchestrator (OpenAPI-first source selection + mismatch pipeline).
- `extension/src/commands/apiContractCodeScan.ts`: API source-scan orchestrator (delegates backend/frontend/model/field extraction modules).
- `extension/src/commands/apiContractSourceScanModel.ts`: shared scanner result model types and helper creators.
- `extension/src/commands/apiContractSourceScanFields.ts`: request/response field extraction helpers for scanner findings.
- `extension/src/commands/apiContractSourceScanBackend.ts`: backend route inference/source extraction module.
- `extension/src/commands/apiContractSourceScanFrontend.ts`: frontend API-call extraction module (fetch/axios + wrapper patterns).
- `extension/src/commands/apiContractOpenApi.ts`: OpenAPI JSON contract parser and schema field extraction.
- `extension/src/commands/apiContractCompare.ts`: request/response mismatch rule evaluator (`API-REQ-001/002`, `API-TYPE-001`, `API-RES-001`).
- `extension/src/commands/apiContractReport.ts`: markdown report renderer for API contract findings.
- `extension/src/commands/apiContractHandoffPrompt.ts`: LLM/Codex handoff prompt builder from API mismatch findings.
- `extension/src/commands/apiContractPath.ts`: path normalization + dynamic-segment endpoint matching helpers.
- `extension/src/commands/apiContractTypes.ts`: shared API contract validator types/constants/settings.
- `extension/src/commands/runTrustWorkspaceScan.ts`: scans workspace source files with Trust evaluator and opens aggregate markdown report (summary, worst files, blocker rule distribution, blocked files).
- `extension/src/commands/refreshLicense.ts`: entitlement refresh trigger.
- `extension/src/commands/licenseStatus.ts`: license status panel trigger.
- `extension/src/commands/activateProjectQuota.ts`: quota activation for current workspace.
- `extension/src/commands/showProjectQuota.ts`: quota usage/remaining view.
- `extension/src/commands/governanceSyncNow.ts`: manual governance decision sync command (`Narrate: Governance Sync Now`).
- `extension/src/commands/modeState.ts`: persisted narration mode helper + reading view/pane state helpers.
- `extension/src/commands/exportUtils.ts`: export path and workspace-relative utilities.

## Extension Licensing
- `extension/src/licensing/featureGates.ts`: licensing orchestration service (backend/placeholder checks, Pro/Edu gates, refresh/token handling, provider policy decisions), now delegating interactive action flows to helper module.
- `extension/src/licensing/featureGateActions.ts`: extracted licensing interactive action flows (email/GitHub sign-in loopback, trial/redeem, checkout selections/session launch, project quota actions, device revoke flow).
- `extension/src/licensing/entitlementClient.ts`: HTTP client for auth/trial/entitlement/quota/device/redeem/checkout endpoints.
- `extension/src/licensing/tokenVerifier.ts`: JWT verification/decoding.
- `extension/src/licensing/secretStorage.ts`: token/public key/install id secret persistence.
- `extension/src/licensing/projectQuota.ts`: workspace fingerprint generation.
- `extension/src/licensing/plans.ts`: plan normalization/labels.
- `extension/src/licensing/types.ts`: licensing API payload types.

## Narration / Reading Pipeline
- `extension/src/readingView/narrateSchemeProvider.ts`: `narrate://` virtual doc provider with session-aware context reopen and pane-mode handling.
- `extension/src/readingView/renderNarration.ts`: narration rendering (`exact` one-line mapping mode + `section` grouped mode).
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
- `extension/src/governance/powerShellRunner.ts`: shared PowerShell execution helper (`pwsh` fallback to Windows PowerShell).
- `extension/src/governance/postWriteEnforcer.ts`: debounced on-save enforcement trigger runner (`pg enforce-trigger -Phase post-write`).
- `extension/src/governance/decisionSyncWorker.ts`: background governance sync worker that runs `pg governance-worker -Once` on interval and supports manual one-shot sync.
- `extension/src/help/commandHelpViewProvider.ts`: sidebar webview provider for command quickstart and troubleshooting.
- `extension/src/help/commandHelpContent.ts`: static command-help HTML content model (local PG + Slack governance grammar + failure playbook).
- `extension/src/trust/trustScoreService.ts`: Trust Score orchestration service (status-bar + refresh/toggle/report UX + diagnostics/validation prompts); delegates policy evaluation/formatting helpers to trust analysis modules.
- `extension/src/trust/trustScoreAnalysis.ts`: deterministic Trust Score policy evaluator entrypoint and core rule scanners used by `TrustScoreService`.
- `extension/src/trust/trustScoreAnalysisUtils.ts`: shared Trust Score scoring/formatting/path/validation-library utility helpers (grade/status resolution, markdown report rendering, component detection, dependency detection cache).
- `extension/src/trust/trustScoreViewProvider.ts`: Trust Score tree-view provider (`narrate.trustScoreView`) with summary badge, findings list, view-title quick actions, and click-to-file finding navigation.
- `extension/src/utils/repoRootResolver.ts`: repo-root/`pg.ps1` resolver used by diagnostics, governance sync, post-write enforcer, and push preflight.
- `extension/src/utils/logSanitization.ts`: centralized log-line sanitization helper (CR/LF/control-char neutralization + truncation).
- `extension/src/utils/logger.ts`: output channel logger.

## Licensing Server Root
- `server/package.json`: dev/build/start scripts and dependencies (`@fastify/static`, `prisma`, `@prisma/client`).
- `server/tsconfig.json`: strict server TS config.
- `server/src/index.ts`: Fastify route composition/orchestration for catalog, auth (email/github/google), trial, entitlement, quota, refund, checkout/webhook, offline/redeem, affiliate, team/provider-policy admin, customer account dashboard APIs, governance APIs (EOD/mastermind/vote/decision/sync), signed Slack command bridge, team self-service APIs, super-admin board APIs with configurable admin route + optional Cloudflare Access gate, static page routing (`/` and `/app`), trusted OAuth callback origin checks, and automatic `.env` loading via `dotenv/config`.
- `server/src/serverRuntimeSetup.ts`: extracted runtime bootstrap setup (plugins, parsers, security headers, Cloudflare Access config warning).
- `server/src/adminRbacBootstrap.ts`: extracted admin RBAC baseline seeding helpers (permissions/roles/super-admin role assignment).
- `server/src/subscriptionGrant.ts`: extracted subscription/entitlement grant mutation helper used by manual/offline/stripe grant flows.
- `server/src/accountSummarySupport.ts`: extracted account/admin summary response helpers for catalog-plan payload, account team/billing/governance shaping, and admin board summary aggregation used by `server/src/index.ts`.
- `server/src/accountSummaryOrchestration.ts`: extracted account-summary orchestration helpers for user snapshot composition and admin-access snapshot resolution with injected dependencies.
- `server/src/authEmailVerifySupport.ts`: extracted email OTP verify/auth-session flow helpers for request payload validation, challenge/user/session mutation, and cookie/session response wiring.
- `server/src/policyRoutes.ts`: extracted `/account/policy/*` route registration module (dependency, coding, API contract, prompt-guard, MCP cloud score, observability check) with shared auth/log dependency injection.
- `server/src/governanceRoutes.ts`: thin governance route-registration aggregator.
- `server/src/governanceRoutes.shared.ts`: shared governance route dependency/type contract.
- `server/src/governanceSettingsRoutes.ts`: governance settings update, Slack test, EOD report/list, and thread-create routes.
- `server/src/governanceMastermindRoutes.ts`: mastermind threads/detail/entry/vote/decide route registrations.
- `server/src/governanceSyncRoutes.ts`: governance sync pull/ack route registrations.
- `server/src/governanceAdminBoardRoutes.ts`: admin governance Slack add-on + board route registrations.
- `server/src/dependencyVerification.ts`: dependency verification orchestration evaluator (policy decision flow + compatibility checks + blocker/warning aggregation).
- `server/src/dependencyVerificationContracts.ts`: shared dependency verification request/result/violation type contracts.
- `server/src/dependencyVerificationSupport.ts`: dependency verification helper module (deny/native maps, semver/normalization utilities, npm registry lookups, package-age helpers).
- `server/src/codingStandardsVerification.ts`: Coding standards policy evaluator orchestration (profile-aware LOC limits, controller/input-validation/function checks, blocker/warning aggregation).
- `server/src/codingStandardsQueryOptimization.ts`: query/index optimization policy module (`SELECT *`, N+1, deep `OFFSET`, non-SARGable predicates, HAVING misuse warning, Prisma FK-like index checks).
- `server/src/codingStandardsLogSafety.ts`: logging-safety policy module (blocks unsafe direct `console.*` and direct runtime `*.log.*` usage when sanitization wrappers are not used).
- `server/src/codingStandardsFunctionScan.ts`: shared function parsing helpers for coding policy evaluation.
- `server/src/apiContractVerification.ts`: API contract policy evaluator orchestrator for server-side verification route output (OpenAPI-first + backend inference + mismatch/warning findings).
- `server/src/mcpCloudScoring.ts`: metadata-only cloud scoring evaluator (scanner summary intake + cloud architecture/provider/control checks + deterministic score/grade/status output).
- `server/src/observabilityHealth.ts`: self-hosted observability adapter evaluator (`otlp|sentry|signoz`) with deployment profile checks (`pg-hosted|customer-hosted|hybrid`) and deterministic blocker/warning findings.
- `server/src/apiContract/types.ts`: shared API contract types/constants used by server verification modules.
- `server/src/apiContract/path.ts`: API path normalization and dynamic-segment matching helpers.
- `server/src/apiContract/openApi.ts`: OpenAPI parser (JSON + YAML) with local schema `$ref` resolution.
- `server/src/apiContract/codeScan.ts`: API source-scan orchestrator for policy evaluator.
- `server/src/apiContract/sourceScanModel.ts`: shared scanner model types/builders for API source scans.
- `server/src/apiContract/sourceScanFields.ts`: request/response field extraction helpers for API scanner modules.
- `server/src/apiContract/sourceScanBackend.ts`: backend route inference/source extraction module.
- `server/src/apiContract/sourceScanFrontend.ts`: frontend API-call extraction module (fetch/axios + wrapper patterns).
- `server/src/apiContract/compare.ts`: deterministic API mismatch comparator.
- `server/src/logSanitization.ts`: centralized server log sanitization helpers for string/value/object metadata (control-char neutralization, recursive sanitization, truncation).
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

## Root Scripts
- `scripts/pg.ps1`: memory-bank and governance wrapper command surface, now includes `governance-bind`, `dependency-verify`, `coding-verify`, `api-contract-verify`, MCP cloud scoring (`mcp-cloud-score`), observability adapter health (`observability-check`), DB maintenance check (`db-index-check`), DB remediation planning (`db-index-fix-plan` / `db-index-remediate`), Playwright smoke checks (`playwright-smoke-check` / `ui-smoke-check`), and `prod`.
- `scripts/dependency_verify.ps1`: local manifest-to-server dependency verification command helper.
- `scripts/coding_verify.ps1`: local source/schema-file-to-server coding verification command helper (includes Prisma/SQL scan roots).
- `scripts/api_contract_verify.ps1`: local source/spec-to-server API contract verification command helper.
- `scripts/mcp_cloud_score_verify.ps1`: local scanner orchestrator + metadata-only cloud scoring bridge helper.
- `scripts/observability_check.ps1`: local command helper for authenticated observability adapter readiness checks (PG-hosted default plus enterprise BYOC/on-prem profile support).
- `scripts/db_index_maintenance_check.ps1`: PostgreSQL index maintenance diagnostics helper (Prisma raw-query based, no `psql` dependency).
- `scripts/db_index_fix_plan.ps1`: PostgreSQL DB maintenance remediation plan helper (writes SQL checklist/report with `pg_stat_statements` enablement and candidate index drop/rollback SQL).
- `scripts/playwright_smoke_check.ps1`: local Playwright smoke verification helper (config/dependency/test detection + smoke-tag/full-suite execution).
- `scripts/pg_prod.ps1`: production baseline gate runner (API health + strict dependency + strict coding verification hard-fail, then profile-driven optional gates via `-ProdProfile legacy|standard|strict`; explicit `-EnableApiContractCheck`, `-EnableDbIndexMaintenanceCheck`, and `-EnablePlaywrightSmokeCheck` still force checks on).
- `scripts/governance_bind_action.ps1`: thread binding manager (`thread_id -> action_key`) for governance worker action routing.
- `scripts/governance_action_playbook.json`: allowlisted local action catalog consumed by governance worker.
