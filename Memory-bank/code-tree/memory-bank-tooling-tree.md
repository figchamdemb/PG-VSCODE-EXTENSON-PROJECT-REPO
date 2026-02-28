# Memory-bank Tooling Tree

LAST_UPDATED_UTC: 2026-02-28 03:54
UPDATED_BY: codex

## Session Commands
- `pg.ps1`, `pg.cmd`: local command wrappers for start/status/end and governance worker utilities (root wrapper now prefers PowerShell 7 `pwsh` when available).
- `scripts/pg.ps1`: command router for memory-bank session, lifecycle auth/maintenance (`login`, `update`, `doctor`), governance worker commands (including playbook thread binding), dependency verification (`dependency-verify`), coding verification (`coding-verify`), API contract verification (`api-contract-verify`), MCP cloud scoring bridge (`mcp-cloud-score`), observability adapter health bridge (`observability-check`), DB index maintenance verification (`db-index-check`), DB remediation planning (`db-index-fix-plan` / `db-index-remediate`), Playwright UI smoke verification (`playwright-smoke-check` / `ui-smoke-check`), production baseline gate (`prod`), and local dev profile vault commands (`dev-profile`).

## Session Lifecycle
- `scripts/start_memory_bank_session.ps1`
- `scripts/start_memory_bank_session.py`
- `scripts/session_status.py`
- `scripts/end_memory_bank_session.py`
- `scripts/end_memory_bank_session.ps1`
- `scripts/enforcement_trigger.ps1`: enforcement orchestrator for `start-session`, `post-write`, and `pre-push` phases.
- `scripts/dev_profile.ps1`: local-only dev/test profile manager for runtime/tool/credential hints (`init/check/set/get/list/remove`), with required-field check and gitignore policy check.
- `scripts/pg_lifecycle.ps1`: lifecycle manager for `pg login/update/doctor`, stores CLI auth state, validates token/health/toolchain diagnostics, and syncs entitlement-aware `pg_cli_*` profile keys.

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
- `scripts/playwright_smoke_check.ps1`: local Playwright smoke verifier (detects config/dependency/test availability, prefers `@smoke`-tagged suites, fails closed on missing setup or test failures).
- `scripts/pg_prod.ps1`: production baseline runner (API health + strict dependency + strict coding policy gates, then profile-driven optional gates via `-ProdProfile legacy|standard|strict`; explicit `-Enable*` flags always force checks on, hard-fail on blockers).

## Summary/Generation
- `scripts/build_frontend_summary.py`
- `scripts/generate_memory_bank.py`

## Guard/Enforcement
- `scripts/memory_bank_guard.py`
- `scripts/install_memory_bank_hooks.ps1`
- `scripts/install_memory_bank_hooks.sh`
- `.githooks/pre-commit`
- `.github/workflows/memory-bank-guard.yml`
- `.github/workflows/dependency-drift-weekly.yml`

## DevOps Utilities
- `scripts/setup_cloudflare_tunnel.ps1`: cloudflared helper for quick temporary tunnels, named-domain tunnel provisioning, and service-token install mode.

## Verification Artifacts
- `.verificaton-before-production-folder/SCALABILITY_ARCHITECTURE_GUIDE.md`: scalability decision intake and anti-pattern enforcement guidance for AI-assisted implementation planning.

