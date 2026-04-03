# Memory-bank Tooling Tree

LAST_UPDATED_UTC: 2026-03-28 03:30
UPDATED_BY: copilot

## Session Commands
- `pg.ps1`, `pg.cmd`: local command wrappers for start/status/end and governance worker utilities (root wrapper now prefers PowerShell 7 `pwsh` when available).
- `scripts/pg.ps1`: command router for memory-bank session, lifecycle auth/maintenance (`login`, `update`, `doctor`), scaffold upgrade (`upgrade-scaffold`, plus local `install ... -UpgradeScaffold` compatibility path), governance worker commands (including playbook thread binding), dependency verification (`dependency-verify`), coding verification (`coding-verify`), API contract verification (`api-contract-verify`), MCP cloud scoring bridge (`mcp-cloud-score`), observability adapter health bridge (`observability-check`), DB index maintenance verification (`db-index-check`), DB remediation planning (`db-index-fix-plan` / `db-index-remediate`), Playwright authored-suite generation (`playwright-author`), Playwright UI smoke verification (`playwright-smoke-check` / `ui-smoke-check`), authored full-suite wrapper (`playwright-full-check`), production baseline gate (`prod`), local dev profile vault commands (`dev-profile`), the frontend/backend integration workflow (`integration-init`, `backend-start`, `frontend-start`, `integration-status`, `integration-next`, `integration-ready`, `integration-complete`, `integration-watch`, `integration-export`, `integration-report`, `integration-respond`, `integration-summary`, `integration-open-page`), and the secure review workflow (`review-init`, `review-builder-start`, `review-reviewer-start`, `review-status`, `review-summary`, `review-report`, `review-respond`, `review-approve`, `review-stop`, `review-end`, `review-open-page`) with alias routing plus API/token forwarding for authenticated server-backed review sync.

## Session Lifecycle
- `scripts/start_memory_bank_session.ps1`
- `scripts/start_memory_bank_session.py`
- `scripts/session_status.py`
- `scripts/session_status.py`: session state reporter now also prints daily-retention status (`daily_reports_count`, keep-days cap, overflow/future hints).
- `scripts/end_memory_bank_session.py`
- `scripts/end_memory_bank_session.ps1`
- `scripts/enforcement_trigger.ps1`: enforcement orchestrator for `start-session`, `post-write`, and `pre-push` phases.
- `scripts/dev_profile.ps1`: local-only dev/test profile manager for runtime/tool/credential hints (`init/check/set/get/list/remove`), with required-field check and gitignore policy check.
- `scripts/pg_lifecycle.ps1`: lifecycle manager for `pg login/update/doctor`, stores CLI auth state, validates token/health/toolchain diagnostics, and syncs entitlement-aware `pg_cli_*` profile keys.
- `scripts/project_setup.ps1`: bootstrap scaffold writer for `.narrate/*`, `.editorconfig`, `Memory-bank/README.md`, and the scaffold version marker `Memory-bank/_generated/pg-scaffold-version.json`; defaults new scaffold governance enforcement to `strict`.
- `scripts/scaffold_upgrade.ps1`: manifest-driven scaffold upgrade engine that classifies replace/create/merge/manual-review files, writes preview/apply reports under `Memory-bank/_generated/scaffold-upgrades/`, preserves Memory-bank history, and can target another repo path from an updated PG root.
- `scripts/global_pg_cli_template.ps1`: machine-global `~\.pg-cli\pg.ps1` template that keeps the lightweight install/start/status surface while adding payload-backed scaffold-upgrade support for stale repos.
- `scripts/sync_global_pg_cli.ps1`: syncs the current repo's managed PG scaffold payload plus the global CLI template into `~\.pg-cli`, enabling stale repos to self-upgrade from their own root after a machine refresh.
- `scripts/local_extension_install.ps1`: one-command local extension compile -> VSIX package -> install flow for normal VS Code profile verification (`--force` by default, optional skip flags).
- `scripts/frontend_integration.ps1`: integration ledger engine that scaffolds/updates `Memory-bank/frontend-integration.md`, `state.json`, per-page markdown files, agent identity state, page status transitions, exports, and structured frontend/backend handoffs; now syncs through the authenticated server orchestration mirror when lifecycle/token auth is available and falls back to local-only mode otherwise.
- `scripts/review_workflow.ps1`: review ledger engine that scaffolds/updates `Memory-bank/review-workflow.md`, `Memory-bank/review-workflow/state.json`, per-page markdown files, role heartbeat state, structured reviewer findings, builder replies, approvals, authenticated server sync against `/account/review/orchestration/*`, redacted local projections in authenticated mode, and DPAPI-protected stop/end control in `Memory-bank/_generated/review-workflow-runtime.json`.
- `scripts/review_workflow_regression_check.ps1`: deterministic regression check that enforces `ConvertFrom-JsonCompat` staying ahead of `Resolve-AccessToken` in `scripts/review_workflow.ps1` and verifies null/blank `changed_paths` entries do not break review page markdown rendering.
- `server/src/reviewOrchestrationRoutes.ts`: authenticated review orchestration transport for `/account/review/orchestration/state|init|sync|audit`, including entitlement gate and rotating worker lease issuance.
- `server/src/reviewOrchestrationSupport.ts`: server-side review workflow validation, policy response shaping, stale-heartbeat detection, worker lease validation, and audit trimming helpers.
- `server/src/reviewOrchestrationTypes.ts`: extracted review workflow record/audit interfaces so the main `server/src/types.ts` stays within strict size limits while the store still references the same review orchestration entities.

## Governance Worker Utilities
- `scripts/governance_login.ps1`: persists API base + auth token + worker cursor state for local governance execution.
- `scripts/governance_worker.ps1`: pulls decision events, resolves decision command via override/state or thread-binding action playbook, executes mapped local commands, and sends ack status (`applied|conflict|skipped`); defaults to local handler when explicit mapping is not provided.
- `scripts/governance_bind_action.ps1`: binds `thread_id -> action_key` using allowlisted playbook actions, supports list/remove/update workflows.
- `scripts/governance_action_playbook.json`: local allowlisted action catalog (`default-handler`, `prod-check-on-approve`, `enforce-prepush-on-approve`).
- `scripts/governance_action_handler.ps1`: default local handler example that logs execution context and writes local agent queue records from worker-provided env vars.
- `scripts/slack_transport_check.ps1`: one-shot 10F closure matrix runner (local/public Slack transport checks + governance decision lifecycle + worker ack verification) with PASS/FAIL report output.
- `scripts/narrate_flow_check.ps1`: one-shot 10G closure matrix runner (Narrate command wiring, runtime registration markers, source file presence, extension compile) with PASS/FAIL report output.
- `scripts/milestone_closure_check.ps1`: one-shot combined closure runner that executes `slack-check` + `narrate-check` and writes a single consolidated report for milestone go/no-go review.
- `scripts/dependency_verify.ps1`: resolves all local service manifests by default (`extension`, `server`, plus top-level service folders with `package.json`), enriches dependency payload with local `npm audit --json --package-lock-only` severity metadata when available, sends authenticated verification request, and fails closed on blocker findings.
- `scripts/coding_verify.ps1`: reads source/schema files (including Prisma/SQL roots), sends authenticated coding policy verification request, and fails closed on blocker findings.
- `scripts/api_contract_verify.ps1`: reads source/spec files, sends authenticated API contract verification request, and fails closed on blocker findings.
- `scripts/mcp_cloud_score_verify.ps1`: runs local scanner set (including multi-manifest dependency aggregation with audit severity metadata) and submits metadata-only scanner summaries + cloud architecture context to server-side MCP cloud scorer.
- `scripts/observability_check.ps1`: runs authenticated self-hosted observability adapter readiness checks (`otlp|sentry|signoz`) against server policy route with deployment profile context (`pg-hosted|customer-hosted|hybrid`).
- `scripts/db_index_maintenance_check.ps1`: runs PostgreSQL index/maintenance diagnostics (invalid indexes, pg_stat_statements presence, sequential-scan pressure, unused indexes, vacuum/analyze lag) and fails closed on blocker findings.
- `scripts/db_index_fix_plan.ps1`: generates SQL remediation plan markdown (`pg_stat_statements` enablement + candidate index guard/drop/rollback SQL) at `Memory-bank/_generated/db-index-fix-plan-latest.md`.
- `scripts/playwright_smoke_check.ps1`: local Playwright verifier with `auto|smoke|full` run modes, browser matrix control, retained HTML/JSON/test-results evidence output, and generated `failures.json` / `failures.md` summaries for agent fix loops.
- `scripts/playwright_author_suite.ps1`: PowerShell entrypoint for PG-authored Playwright suite generation.
- `scripts/playwright_author_suite.py`: project scanner/generator that inspects routes/forms and writes managed specs plus helpers into `server/tests/pg-generated/`.
- `scripts/playwright_report_summary.py`: converts Playwright JSON output into machine-readable + markdown failure summaries with attachment references.
- `scripts/playwright_full_check.ps1`: one-shot author + run wrapper that updates `playwright-full-check-latest.json` after the authored suite finishes.
- `scripts/pg_prod.ps1`: production baseline runner (API health + strict dependency + strict coding policy gates, then profile-driven optional gates via `-ProdProfile legacy|standard|strict`; explicit `-Enable*` flags always force checks on, hard-fail on blockers).

## Summary/Generation
- `scripts/build_frontend_summary.py`
- `scripts/generate_memory_bank.py`

## Guard/Enforcement
- `scripts/memory_bank_guard.py`
- `scripts/memory_bank_guard_integration.py`: extracted frontend integration artifact validator (summary/state/page presence, <=500-line page enforcement, completion validation evidence checks).
- `scripts/memory_bank_guard_design.py`: UI-design enforcement helper for pre-commit guard (design-guide presence, shared token usage on changed style files, semantic layout/control checks on changed UI surfaces).
- `scripts/memory_bank_guard_daily.py`: extracted daily-retention validator (dated file cap + future/non-date diagnostics) consumed by main guard.
- `scripts/install_memory_bank_hooks.ps1`
- `scripts/install_memory_bank_hooks.sh`
- `.githooks/pre-commit`
- `.github/workflows/memory-bank-guard.yml`
- `.github/workflows/dependency-drift-weekly.yml`

## DevOps Utilities
- `scripts/setup_cloudflare_tunnel.ps1`: cloudflared helper for quick temporary tunnels, named-domain tunnel provisioning, and service-token install mode.

## Verification Artifacts
- `.verificaton-before-production-folder/SCALABILITY_ARCHITECTURE_GUIDE.md`: scalability decision intake and anti-pattern enforcement guidance for AI-assisted implementation planning.
- `docs/FRONTEND_DESIGN_GUARDRAILS.md`: default UI pattern guide for dashboard/app/help/pricing/admin work, with explicit user-guide precedence and similar-not-copy rules.
- `AI_ENFORCEMENT_GUIDE.md`: root explainer describing repo-enforced startup rules vs extension/editor-native behavior for AI agents.
- `.agents/workflows/startup.md`: optional repo-local startup workflow helper for tools that support workflow/slash-style bootstrapping.

