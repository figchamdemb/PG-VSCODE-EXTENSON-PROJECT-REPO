# Tools & Commands

LAST_UPDATED_UTC: 2026-02-28 03:54
UPDATED_BY: codex
PROJECT_TYPE: frontend

## Purpose
Single source for local run commands, runtime inventory, and command-surface references.

## Runtime Versions
| Tool | Version | Where Used | Notes |
|---|---|---|---|
| Node.js | v20.20.0 | extension + server runtime/tooling | required for build/dev scripts |
| npm | 10.8.2 | extension + server dependency/build | uses `npm install`, `npm run compile`, `npm run build` |
| Python | 3.14.0 | memory-bank scripts | summary/generator/guard |
| PowerShell | 7+/Windows PowerShell | local command flow | required for `pg.ps1` workflows |
| cloudflared | 2025.8.1 | local tunnel/public domain ingress | installed via winget (`Cloudflare.cloudflared`) |

## Core Commands
### Memory-bank session (project root)
- Start:
  - `.\pg.ps1 start -Yes`
  - `.\pg.ps1 start -Yes -EnforcementMode warn|strict`
- Status:
  - `.\pg.ps1 status`
- End:
  - `.\pg.ps1 end -Note "finished for today"`
- Alternate start:
  - `powershell -ExecutionPolicy Bypass -File scripts/start_memory_bank_session.ps1`
- Rebuild summary:
  - `python scripts/build_frontend_summary.py`
- Generate/update Memory-bank:
  - `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`
- Install hooks:
  - `powershell -ExecutionPolicy Bypass -File scripts/install_memory_bank_hooks.ps1 -Mode warn`

### PG CLI lifecycle (project root)
- Login and persist CLI auth/profile state:
  - `.\pg.ps1 login -Email "you@example.com"`
  - `.\pg.ps1 login -AccessToken "<TOKEN>"`
- Refresh entitlement/profile sync:
  - `.\pg.ps1 update`
- Run local diagnostics for auth/path/tools/profile:
  - `.\pg.ps1 doctor`
- Notes:
  - lifecycle state file: `Memory-bank/_generated/pg-cli-state.json` (gitignored).
  - `login`/`update` sync entitlement snapshot to local dev profile keys (`pg_cli_*`) and derive `pg_cli_recommended_prod_profile`.
  - `update`/`doctor` resolve API base from lifecycle state when `-ApiBase` is omitted.
  - when `pg prod` is run without explicit `-ProdProfile`, router now prefers the lifecycle recommended profile from state.

### Local dev profile (project root, dev/test only)
- Purpose:
  - keep local runtime/tool/credential hints for agent-assisted development.
  - reduce retry loops when DB/tool credentials are missing during local testing.
- Security boundary:
  - file is local-only: `.narrate/dev-profile.local.json` (gitignored).
  - use for development/test credentials only.
  - production credentials remain `.env`/vault-managed and are still enforced by production gates.
- Commands:
  - initialize:
    - `.\pg.ps1 dev-profile -DevProfileAction init`
  - check required fields + gitignore policy:
    - `.\pg.ps1 dev-profile -DevProfileAction check`
  - set non-secret value:
    - `.\pg.ps1 dev-profile -DevProfileAction set -ProfileKey db_host -ProfileValue 127.0.0.1`
  - set secret with secure prompt input:
    - `.\pg.ps1 dev-profile -DevProfileAction set -ProfileKey db_password -Secret -Prompt`
  - read value:
    - `.\pg.ps1 dev-profile -DevProfileAction get -ProfileKey db_host`
  - list all keys (secrets masked):
    - `.\pg.ps1 dev-profile -DevProfileAction list`
  - list with revealed secrets (local machine only):
    - `.\pg.ps1 dev-profile -DevProfileAction list -Reveal`
  - remove key:
    - `.\pg.ps1 dev-profile -DevProfileAction remove -ProfileKey db_password`

### Governance decision bridge (project root)
- Login state bootstrap (use existing bearer token):
  - `.\pg.ps1 governance-login -ApiBase http://127.0.0.1:8787 -AccessToken "<TOKEN>"`
- Login via email OTP (when enabled in runtime):
  - `.\pg.ps1 governance-login -ApiBase http://127.0.0.1:8787 -Email "user@company.com"`
- Run worker once:
  - `.\pg.ps1 governance-worker -Once`
- Run worker continuously:
  - `.\pg.ps1 governance-worker -PollSeconds 15 -ApproveCommand "& '.\scripts\governance_action_handler.ps1'" -NeedsChangeCommand "& '.\scripts\governance_action_handler.ps1'" -RejectCommand "& '.\scripts\governance_action_handler.ps1'"`
- Dry run mode (no command execution; still validates pull/flow):
  - `.\pg.ps1 governance-worker -Once -DryRun`
- Bind a thread to an allowlisted local action key:
  - `.\pg.ps1 governance-bind -ThreadId "6c920350-9b8c-4067-a0f0-92c8a9b9b42a" -ActionKey default-handler`
  - `.\pg.ps1 governance-bind -ThreadId "6c920350-9b8c-4067-a0f0-92c8a9b9b42a" -ActionKey prod-check-on-approve`
  - `.\pg.ps1 governance-bind -List`
  - `.\pg.ps1 governance-bind -ThreadId "6c920350-9b8c-4067-a0f0-92c8a9b9b42a" -Remove`
- Optional playbook override path:
  - `.\pg.ps1 governance-bind -PlaybookPath .\scripts\governance_action_playbook.json -List`
  - `.\pg.ps1 governance-worker -PlaybookPath .\scripts\governance_action_playbook.json -Once`
- Worker state file:
  - `Memory-bank/_generated/governance-agent-state.json`
- Worker local queue/log outputs:
  - `Memory-bank/_generated/governance-worker-execution.log`
  - `Memory-bank/_generated/governance-agent-queue.jsonl`
- Worker defaults:
  - If explicit `Approve/NeedsChange/Reject` commands are not provided, worker resolves by this order:
    1. thread binding (`thread_id -> action_key`) using playbook
    2. state/global decision command overrides
    3. `default_action_key` from state (if configured)
    4. fallback to `scripts/governance_action_handler.ps1`.
- Worker execution context env vars (available to mapped command):
  - `PG_GOV_EVENT_ID`
  - `PG_GOV_THREAD_ID`
  - `PG_GOV_DECISION`
  - `PG_GOV_WINNING_OPTION_KEY`
  - `PG_GOV_SUMMARY`
  - `PG_GOV_EVENT_JSON`

### Slack transport closure check (project root)
- One command PASS/FAIL matrix for 10F validation:
  - `.\pg.ps1 slack-check -ApiBase http://127.0.0.1:8787 -PublicBaseUrl https://pg-ext.addresly.com`
- What it checks:
  - local `/health`
  - local `/integrations/slack/health`
  - public `/health`
  - public `/integrations/slack/health`
  - auth token from governance state file
  - governance thread create -> vote -> decide
  - local worker apply
  - sync ack status (`applied`)
- Useful flags:
  - `-SkipPublicChecks` (when tunnel/domain is down but local checks are needed)
  - `-SkipWorker` (transport-only, no local execution)
  - `-Json` (machine-readable output)
- Runtime note:
  - thread create can take ~45-60s on loaded environments; script POST timeout is set to 90s to avoid false transport failures.
- Report output:
  - `Memory-bank/_generated/slack-transport-check-latest.md`

### Narrate flow closure check (project root)
- One command PASS/FAIL matrix for Milestone 10G baseline:
  - `.\pg.ps1 narrate-check`
- What it checks:
  - required Narrate command IDs in `extension/package.json`
  - command/runtime registration in `extension/src/extension.ts`
  - core source files for reading/toggle/export/report flow
  - extension compile (`npm run compile`)
- Useful flags:
  - `-SkipCompile` (quick structural check only)
  - `-Json` (machine-readable output)
- Report output:
  - `Memory-bank/_generated/narrate-flow-check-latest.md`

### Combined milestone closure check (project root)
- One command to run both 10F + 10G checks:
  - `.\pg.ps1 closure-check -ApiBase http://127.0.0.1:8787 -PublicBaseUrl https://pg-ext.addresly.com`
  - `.\pg.ps1 closure-check -ClosureMode local-core -ApiBase http://127.0.0.1:8787 -PublicBaseUrl https://pg-ext.addresly.com`
- What it checks:
  - runs `pg slack-check` (Slack transport + governance decision apply/ack)
  - runs `pg narrate-check` (Narrate flow wiring + compile)
  - writes one combined summary report with both command exit codes and PASS/FAIL counts.
- Closure modes:
  - `strict` (default): requires both subcommands to exit with zero.
  - `local-core`: allows public tunnel failures and account-summary flakiness, but still requires core local governance flow steps to pass (`thread`, `vote`, `decide`, `bind`, `worker`, `ack`).
- Useful flags:
  - `-ClosureMode strict|local-core`
  - `-SkipPublicChecks` (ignore tunnel/public endpoint checks)
  - `-SkipWorker` (transport-only; skip local apply/ack step)
  - `-SkipCompile` (quick Narrate structural check only)
  - `-Json` (machine-readable output)
- Report output:
  - `Memory-bank/_generated/milestone-closure-check-latest.md`

### Dependency verification bridge (project root)
- Verify dependencies from a package manifest against server-side policy:
  - `.\pg.ps1 dependency-verify -ApiBase http://127.0.0.1:8787 -AccessToken "<TOKEN>" -ManifestPath .\server\package.json`
  - `.\pg.ps1 dependency-verify` (default scans all local service manifests: `extension/package.json`, `server/package.json`, plus other top-level service folders that contain `package.json`)
- Optional flags:
  - `-DependenciesOnly` (exclude `devDependencies`)
  - `-ProjectFramework nextjs|nestjs|react|unknown`
  - `-NodeVersion 20.20.0`
  - `-SkipRegistryFetch` (for offline/debug only; not for strict prod gate)
- Notes:
  - dependency payload now includes local `npm audit --json --package-lock-only` severity metadata per package when lockfiles are present.
  - high/critical vulnerability severity in dependency scanner input is treated as blocker by server policy (`DEP-SEC-001`).
  - stale `@types/*` packages are now warning-only (`DEP-MAINT-003`) to reduce false hard blocks while keeping vulnerability severity gates strict.

### Scheduled dependency drift check (CI)
- Workflow:
  - `.github/workflows/dependency-drift-weekly.yml`
- Schedule:
  - weekly on Mondays (`08:00 UTC`) and manual `workflow_dispatch`.
- What it runs:
  - per service (`extension`, `server`): `npm ci`, `npm audit --audit-level=high --omit=optional` (fails job on high/critical findings),
  - `npm outdated --json` report output for upgrade planning,
  - optional policy-level dependency verification job when repo secrets `PG_API_BASE` and `PG_ACCESS_TOKEN` are configured.

### Coding standards verification bridge (project root)
- Verify source files against server-side coding standards policy:
  - `.\pg.ps1 coding-verify -ApiBase http://127.0.0.1:8787 -AccessToken "<TOKEN>" -ScanPath .\server\src,.\extension\src`
- Optional flags:
  - `-ProjectFramework nextjs|nestjs|spring|react|unknown`
  - `-MaxFiles 400`
  - `-SkipFunctionChecks` (debug only; not for strict prod gate)
- Notes:
  - default scan roots include `server/src`, `server/prisma`, and `extension/src`.
  - query-optimization policy checks now include N+1 loop patterns, `SELECT *`, deep `OFFSET`, non-SARGable `WHERE` signals, `HAVING` misuse signals, and Prisma FK-index enforcement.

### API contract verification bridge (project root)
- Verify frontend/backend API contract alignment against server-side policy evaluator:
  - `.\pg.ps1 api-contract-verify -ApiBase http://127.0.0.1:8787 -AccessToken "<TOKEN>" -ScanPath .\server\src,.\extension\src`
- Optional flags:
  - `-MaxFiles 1200`
  - `-ScanPath .\server\src,.\extension\src`
- Notes:
  - evaluator uses OpenAPI-first parsing (JSON + YAML with local `$ref` schema support), then backend route inference fallback.
  - mismatches include blocker/warning rule IDs and unmatched frontend-call warnings.

### MCP cloud scoring bridge (project root)
- Run local policy scanners and submit metadata-only cloud architecture evidence for server-side scoring:
  - `.\pg.ps1 mcp-cloud-score -ApiBase http://127.0.0.1:8787 -WorkloadSensitivity regulated`
  - `.\pg.ps1 cloud-score -WorkloadSensitivity regulated` (short alias)
- Typical regulated command with explicit security control evidence:
  - `.\pg.ps1 mcp-cloud-score -WorkloadSensitivity regulated -ControlCloudflareTunnel pass -ControlCloudflareFullStrictTls pass -ControlEc2PrivateSubnetOnly pass -ControlDbPublicAccessDisabled pass -ControlWireguardDbTunnel pass -ControlSecretsManager pass -ControlIamRoleNoAccessKeys pass -ControlCloudTrailMultiRegion pass -ControlBackupRestoreTested30d pass`
- Optional cloud-control flags (all support `unknown|pass|fail`):
  - `-ControlImdsV2Enforced`
  - `-ControlSshPortClosedPublic`
  - `-ControlDbPortNotPublic`
  - `-ControlWafManagedRulesEnabled`
  - `-ControlAuthRateLimitsEnabled`
  - `-ControlCiSecretScanningEnabled`
  - `-ControlWireguardAlertEnabled`
  - `-ControlCloudTrailRootLoginAlert`
  - `-ControlEc2MultiAz`
- Provider/cost context flags:
  - `-ProviderCloudflare on|off|unknown`
  - `-ProviderAws on|off|unknown`
  - `-ProviderHetzner on|off|unknown`
  - `-ProviderCloudfront on|off|unknown`
  - `-ProviderAwsShieldAdvanced on|off|unknown`
  - `-MonthlyBudgetUsd 300`
- Notes:
  - scanner payload is metadata-only (counts/rule IDs/status), not full source upload to MCP scorer.
  - scoring endpoint: `POST /account/policy/mcp/cloud-score`.
  - regulated profile enforces stricter cloud architecture controls and provider requirements.

### Observability adapter health bridge (project root)
- Run self-hosted observability readiness check (`none|otlp|sentry|signoz`) via authenticated server policy route:
  - `.\pg.ps1 observability-check`
  - `.\pg.ps1 obs-check` (short alias)
- Typical PG-hosted managed profile command:
  - `.\pg.ps1 observability-check -ObservabilityDeploymentProfile pg-hosted -ObservabilityOtlpEnabled on -ObservabilityOtlpEndpoint https://otel.yourdomain.com/v1/traces -ObservabilityOtlpHostedBy pg -ObservabilityOtlpToken present`
- Typical enterprise BYOC/on-prem command:
  - `.\pg.ps1 observability-check -ObservabilityDeploymentProfile customer-hosted -ObservabilitySignozEnabled on -ObservabilitySignozHostedBy customer -ObservabilitySignozEndpoint https://signoz.customer.local -ObservabilitySignozToken present`
- Optional flags:
  - `-ObservabilityDeploymentProfile auto|pg-hosted|customer-hosted|hybrid`
  - `-ObservabilityOtlpEnabled auto|on|off`
  - `-ObservabilityOtlpHostedBy auto|pg|customer|unknown`
  - `-ObservabilityOtlpToken auto|present|missing`
  - `-ObservabilitySentryEnabled auto|on|off`
  - `-ObservabilitySentryHostedBy auto|pg|customer|unknown`
  - `-ObservabilitySentryToken auto|present|missing`
  - `-ObservabilitySignozEnabled auto|on|off`
  - `-ObservabilitySignozHostedBy auto|pg|customer|unknown`
  - `-ObservabilitySignozToken auto|present|missing`
  - `-Json` for machine-readable output
- Notes:
  - default product posture remains PG-hosted for easier onboarding.
  - enterprise customers can use customer-hosted/BYOC mode without vendor lock-in.
  - endpoint returns deterministic blocker/warning findings: `POST /account/policy/observability/check`.

### DB index maintenance verification bridge (project root)
- Run PostgreSQL maintenance diagnostics gate:
  - `.\pg.ps1 db-index-check`
  - `.\pg.ps1 db-check` (short alias)
- Optional flags:
  - `-DatabaseUrl "postgresql://..."`
- Typical remediation flow:
  - `.\pg.ps1 db-index-check`
  - `.\pg.ps1 db-index-fix-plan -DbMaxRows 5 -DbPlanOutputPath .\Memory-bank\_generated\db-index-fix-plan-next5.md`
  - run SQL from generated plan in PostgreSQL (psql/Prisma/pgAdmin)
  - `.\pg.ps1 db-index-check`
- Checks:
  - invalid indexes (`DBM-IND-001`, blocker)
  - `pg_stat_statements` extension presence (`DBM-EXT-001`, blocker)
  - high sequential scan pressure (`DBM-SCAN-001`, warning)
  - unused non-primary, non-unique indexes (`DBM-IND-002`, warning)
  - vacuum/analyze lag signals (`DBM-MAINT-001`, warning)
- Quick remediation hint:
  - when findings exist, `db-index-check` prints `.\pg.ps1 db-index-fix-plan`.
- Troubleshooting:
  - if command-set error shows `install,start,...`, you executed global `pg.ps1`; rerun with local `.\pg.ps1`.
  - if `.\pg.ps1` is not recognized, `cd` into repo root first.
  - if terminal shows `>>`, press `Ctrl+C` once then rerun command.
  - SQL (`SHOW/ALTER/CREATE/DROP`) must run in PostgreSQL, not directly in PowerShell.

### DB index remediation plan bridge (project root)
- Generate exact SQL remediation plan from live DB findings:
  - `.\pg.ps1 db-index-fix-plan`
  - `.\pg.ps1 db-fix` (short alias)
  - `.\pg.ps1 db-index-remediate` (alias)
- Optional flags:
  - `-DatabaseUrl "postgresql://..."`
  - `-DbMaxRows 25`
  - `-DbPlanOutputPath .\Memory-bank\_generated\db-index-fix-plan-latest.md`
- Output:
  - default report path: `Memory-bank/_generated/db-index-fix-plan-latest.md`
- Includes:
  - `pg_stat_statements` enablement SQL checklist
  - safety checklist for unused index removal
  - candidate-specific `DROP INDEX CONCURRENTLY` and rollback `CREATE INDEX CONCURRENTLY` SQL.
- Warning cleanup workflow (`DBM-IND-002`):
  - generate plan with smaller batch:
    - `.\pg.ps1 db-index-fix-plan -DbMaxRows 5 -DbPlanOutputPath .\Memory-bank\_generated\db-index-fix-plan-next5.md`
  - for each candidate:
    - run `Guard check` SQL first,
    - drop only when `idx_scan` stays zero in real traffic windows,
    - rerun `.\pg.ps1 db-index-check` after each small batch.

### Playwright UI smoke bridge (project root)
- Run Playwright smoke checks for UI/runtime behavior:
  - `.\pg.ps1 playwright-smoke-check`
  - `.\pg.ps1 ui-smoke-check`
- Optional flags:
  - `-PlaywrightWorkingDirectory .\server` (or any repo-relative path with Playwright config/tests)
  - `-PlaywrightConfigPath .\playwright.config.ts`
- Behavior:
  - fails closed when Playwright config/dependency/tests are missing.
  - if `@smoke` tag exists in tests, runs only smoke-tagged tests; otherwise runs full Playwright suite.

### Enforcement trigger bridge (project root)
- Run trigger phase manually:
  - `.\pg.ps1 enforce-trigger -Phase start-session -ApiBase http://127.0.0.1:8787`
  - `.\pg.ps1 enforce-trigger -Phase post-write -ChangedPath .\server\src\index.ts`
  - `.\pg.ps1 enforce-trigger -Phase pre-push -ProjectFramework nestjs`
- Optional flags:
  - `-WarnOnly` (non-blocking mode for setup/debug)
  - `-ScanPath .\server\src,.\extension\src`
  - `-ChangedPath <file1,file2,...>`
  - `-EnableDbIndexMaintenanceCheck` (runs DB maintenance diagnostics as part of trigger)
  - `-DatabaseUrl "postgresql://..."` (override connection for DB maintenance diagnostics)

### As-you-go self-check bridge (project root, agent-first)
- Run proactive verification while implementing changes:
  - `.\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`
  - `.\pg.ps1 as-you-go-check -WarnOnly -EnableDbIndexMaintenanceCheck` (alias)
- Web/UI tasks:
  - `.\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck -EnablePlaywrightSmokeCheck`
- Strict completion check (before declaring task done):
  - `.\pg.ps1 self-check -EnableDbIndexMaintenanceCheck`
- Behavior:
  - runs post-write enforcement trigger against changed files,
  - runs DB index maintenance diagnostics (JSON mode),
  - auto-generates DB fix plan when DB findings exist (unless `-SkipAutoDbFixPlan` is used),
  - optionally runs Playwright smoke checks.
- Optional flags:
  - `-ChangedPath <file1,file2,...>` (override changed-file detection)
  - `-ScanPath <path1,path2,...>`
  - `-DbMaxRows 5`
  - `-DbPlanOutputPath .\Memory-bank\_generated\db-index-fix-plan-next5.md`
  - `-SkipAutoDbFixPlan`

### Production baseline gate (project root)
- Run strict production preflight dependency + coding gate:
  - `.\pg.ps1 prod -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json`
  - `.\pg.ps1 prod -ProdProfile standard -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json`
  - `.\pg.ps1 prod -ProdProfile strict -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json`
  - `.\pg.ps1 prod -ProdProfile legacy -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json`
- Token resolution order:
  - `-AccessToken` argument
  - `PG_ACCESS_TOKEN` environment variable
  - `Memory-bank/_generated/governance-agent-state.json` (`access_token`)
- Prod profile behavior:
  - `legacy`: dependency + coding only
  - `standard` (default): dependency + coding + API contract + DB index maintenance
  - `strict`: standard + Playwright smoke
  - if `-ProdProfile` is omitted and lifecycle state exists, `pg prod` auto-uses entitlement-synced `recommended_prod_profile` from `pg-cli-state.json`.
- Optional flags:
  - `-IncludeDevDependencies` (default checks only runtime dependencies)
  - `-ProjectFramework nextjs|nestjs|react|unknown`
  - `-NodeVersion 20.20.0`
  - `-ScanPath .\server\src,.\extension\src`
  - `-MaxFiles 400`
  - `-ProdProfile legacy|standard|strict`
  - `-SkipFunctionChecks` (debug only; not for strict prod gate)
  - `-EnableApiContractCheck` (forces API contract gate on regardless of selected profile)
  - `-EnableDbIndexMaintenanceCheck` (forces DB index maintenance gate on regardless of selected profile)
  - `-DatabaseUrl` (optional DB connection override for DB maintenance gate)
  - `-EnablePlaywrightSmokeCheck` (forces Playwright smoke gate on regardless of selected profile)
  - `-PlaywrightWorkingDirectory` (path passed to Playwright smoke checker when prod gate is enabled)
  - `-PlaywrightConfigPath` (explicit Playwright config path passed to smoke checker)

### Cloudflare tunnel (project root)
- Install cloudflared:
  - `winget install -e --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements`
- Quick temporary demo URL:
  - `powershell -ExecutionPolicy Bypass -File scripts/setup_cloudflare_tunnel.ps1 -Mode quick -OriginUrl http://127.0.0.1:8787`
- Named domain tunnel:
  - `powershell -ExecutionPolicy Bypass -File scripts/setup_cloudflare_tunnel.ps1 -Mode named -TunnelName pg-ext-narrate -Hostname pg-ext.addresly.com -OriginUrl http://127.0.0.1:8787`

### Narrate extension (from `extension/`)
- Install dependencies:
  - `npm install`
- Compile:
  - `npm run compile`
- Watch:
  - `npm run watch`

### Licensing backend (from `server/`)
- Install dependencies:
  - `npm install`
- Build:
  - `npm run build`
- Dev server (watch):
  - `npm run dev`
- Start compiled server:
  - `npm run start`
- Web smoke test (starts server on temp port and validates landing/css/js + web pages):
  - `npm run smoke:web`
- Prisma client generation:
  - `npm run prisma:generate`
- Push Prisma schema to DB:
  - `npm run prisma:dbpush`
- Prisma studio (optional):
  - `npm run prisma:studio`
- Open hosted landing page:
  - `http://127.0.0.1:8787/`
- Open secure portal app:
  - `http://127.0.0.1:8787/app`

### Local extension host testing
- Option A (preferred): open project root and run `Run -> Start Debugging`.
- Choose `Run Narrate Extension (root workspace)` from `.vscode/launch.json`.
- Option B: open `extension/` directly and run `Run Narrate Extension`.
- If commands show `...not found` in Extension Development Host, restart using root workspace debug profile and rerun `Narrate: Run Command Diagnostics`.

### Scalability architecture intake (policy workflow)
- Policy source:
  - `.verificaton-before-production-folder/SCALABILITY_ARCHITECTURE_GUIDE.md`
- Use this intake before implementing features that include:
  - real-time updates/notifications
  - async/background jobs
  - service-to-service messaging
  - distributed/shared runtime state
- Required workflow:
  1. ask the discovery questions
  2. evaluate options with scale rationale
  3. explicitly reject non-scalable anti-patterns
  4. get user confirmation before implementation

### Key extension commands (Command Palette)
- `Narrate: Toggle Reading Mode (Dev)`
- `Narrate: Toggle Reading Mode (Edu)`
- `Narrate: Switch Narration Mode`
- `Narrate: Set Mode (Dev)`
- `Narrate: Set Mode (Edu)`
- `Narrate: Switch Reading View Mode` (`exact` <-> `section`)
- `Narrate: Switch Reading Pane Mode` (`sideBySide` <-> `fullPage`)
- `Narrate: Toggle Source Snippet (Code/Meaning)` (`withSource` <-> `narrationOnly`)
- `Narrate: Toggle EDU Detail Level (Standard/Beginner/Full Beginner)` (cycles 3 levels)
- `Narrate: Refresh Reading View`
- `Narrate: Request Change Prompt`
- `Narrate: Export Narration (Current File)` (Pro+ gate)
- `Narrate: Export Narration (Workspace)` (Pro+ gate)
- `Narrate: Generate Change Report (Git Diff...)` (Pro+ gate)
- `Narrate: PG Push (Git Add/Commit/Push)` (runs `enforce-trigger -Phase pre-push` plus optional Trust/Dead-Code/Commit-Quality gates before git push)
- `Narrate: PG Git Push` (alias for PG Push)
- `Narrate: Governance Sync Now` (manual one-shot pull/apply/ack for governance decisions)
- `Narrate: Sign In (Email)`
- `Narrate: Sign In (GitHub)`
- `Narrate: Redeem Code`
- `Narrate: Start Trial (48h)`
- `Narrate: Upgrade Plan (Checkout)`
- `Narrate: Refresh License`
- `Narrate: License Status`
- `Narrate: Activate Current Project Quota`
- `Narrate: Show Project Quota`
- `Narrate: Manage Devices`
- `Narrate: Open Command Help` (opens/focuses the `Narrate Help` sidebar with command runbook + troubleshooting)
- `Narrate: Run Command Diagnostics` (runs local health + Slack health + dev-profile + governance worker + Narrate baseline checks, then auto-saves `Memory-bank/_generated/command-diagnostics-latest.md` and `.json` plus timestamped snapshots; completion toast includes quick actions to open/copy paths)
- `Narrate: Generate Codebase Tour` (scans workspace architecture and opens onboarding report with entrypoints, route/controller surface, dependency hotspots, and coupling hotspots)
- `Narrate: Run Dead Code Scan` (opens confidence-tiered dead-code candidate report; high confidence from TS unused diagnostics, medium/low from import-graph orphan detection)
- `Narrate: Create Dead Code Cleanup Branch` (creates/switches to dedicated cleanup branch, runs dead-code scan, and opens report)
- `Narrate: Apply Safe Dead Code Fixes` (runs organize-imports across high-confidence dead-code files and opens before/after scan report)
- `Narrate: Run Environment Doctor` (scans workspace env usage, compares `.env` and `.env.example`, and opens a missing/unused/exposed report)
- `Narrate: Run API Contract Validator` (runs OpenAPI-first request/response contract checks with JSON+YAML support and local schema `$ref` resolution, then falls back to backend inference when spec contracts are unavailable; frontend extraction includes axios wrapper clients and `.request({...})` calls)
- `Narrate: OpenAPI Check` (short alias command for fast API contract validation run)
- `Narrate: OpenAPI Fix Handoff Prompt` (runs validator and copies an LLM-ready mismatch-fix prompt to clipboard)
- `Narrate: Environment Doctor Quick Fix (.env.example)` (runs doctor and appends missing referenced keys into `.env.example` placeholders)
- `Narrate: Show Trust Score Report` (opens latest trust score findings with rule IDs, blockers, warnings, score, and grade)
- `Narrate: Open Trust Score Panel` (focuses sidebar panel with summary badge + findings)
- `Narrate: Toggle Trust Score` (enable/disable trust scoring from UI)
- `Narrate: Refresh Trust Score` (manual trust evaluation run for current active file)
- `Narrate: Run Trust Score Workspace Scan` (runs aggregate trust scan across workspace source files and opens markdown summary report)
- `Narrate: Restart TypeScript + Refresh Trust Score` (save all + restart TS server + trust refresh when Problems tab is stale)
- `Narrate: Setup Validation Library` (install latest validation package with Zod recommended default, then refresh trust)

### Reading-view defaults (settings)
- `narrate.reading.defaultViewMode`: `exact | section` (default `exact`)
- `narrate.reading.defaultPaneMode`: `sideBySide | fullPage` (default `sideBySide`)
- `narrate.reading.showStatusBarControls`: `true | false` (default `true`)
- `narrate.trustScore.enabled`: `true | false` (default `true`)
- `narrate.trustScore.showStatusBar`: `true | false` (default `true`)
- `narrate.trustScore.autoRefreshOnSave`: `true | false` (default `true`; when `false`, use `Narrate: Refresh Trust Score`)
- `narrate.trustScore.pgPushGateMode`: `off | relaxed | strict` (default `off`; strict blocks push on trust blockers/red status, relaxed warns and allows manual continue)
- `narrate.trustScore.workspaceScanMaxFiles`: integer (default `250`)
- `narrate.trustScore.workspaceScanIncludeGlob`: glob (default `**/*.{ts,tsx,js,jsx,py,java,go,rs,cs,php,rb}`)
- `narrate.trustScore.workspaceScanExcludeGlob`: glob (default excludes build/vendor folders)
- `narrate.deadCodeScan.maxFiles`: integer (default `600`)
- `narrate.deadCodeScan.includeGlob`: glob (default `**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}`)
- `narrate.deadCodeScan.excludeGlob`: glob (default excludes build/vendor/memory-bank folders)
- `narrate.deadCodeScan.pgPushGateMode`: `off | relaxed | strict` (default `off`; strict blocks PG push on high-confidence unused findings)
- `narrate.apiContract.maxFiles`: integer (default `1200`)
- `narrate.apiContract.includeGlob`: glob (default includes TS/JS plus JSON/YAML specs for contract discovery)
- `narrate.apiContract.excludeGlob`: glob (default excludes build/vendor/memory-bank folders)
- `narrate.codebaseTour.maxFiles`: integer (default `1500`)
- `narrate.codebaseTour.includeGlob`: glob (default includes source/config file extensions for architecture scan)
- `narrate.codebaseTour.excludeGlob`: glob (default excludes build/vendor/memory-bank folders)
- Dead-code PG push prompt actions:
  - `Apply Safe Fixes + Recheck` (runs imports-only safe autofix command, then rescans)
  - `Open Dead Code Report`
  - `Continue Push` (relaxed mode only) / block in strict mode until resolved
- Repo profile note:
  - this repository currently sets `.vscode/settings.json` to `narrate.deadCodeScan.pgPushGateMode = strict`.
  - fallback remains available by switching setting to `relaxed` for legacy cleanup windows.
- Dead code scan interpretation note:
  - `High` confidence candidates come from explicit TypeScript unused diagnostics.
  - `Medium/Low` confidence candidates come from static import-graph heuristics and require manual review.
- Trust validation rule note:
  - Trust/coding gates now include missing input-validation detection for controller/route input surfaces.
  - Validation signal is Zod-or-equivalent (for example: `zod`, `safeParse`, `ValidationPipe`, `Joi`, `yup`, `valibot`).

### Planned governance command aliases (Milestone 9+)
- `PG EOD` / `PG EndOfDay`
- `PG Mastermind` / `PG MM`
- `PG Decision`
- `PG Plan` (opens mastermind/planning thread context for multi-agent debate)
- Slack slash command grammar:
  - `summary`
  - `eod <title> :: <summary>`
  - `thread <title> :: <question> :: <option1|option2|...>`
  - `vote <thread_id> <option_key> [rationale]` (team vote step; use `opt1/opt2/...` returned by thread create)
  - `decide <thread_id> <approve|reject|needs_change> [option_key] [note]` (owner/manager final step)
  - Input must start directly with `/pg ...` in Slack composer (no prefixed numbering text like `1. /pg ...`).
- Slack role visibility checks:
  - `summary` now returns team memberships as `TEAM_KEY (role)`.
  - `Refresh Thread` card context now prints scope and your effective access label (e.g., `manager (can vote + finalize)`).

### Backend mode settings
- `narrate.licensing.mode = backend`
- `narrate.licensing.apiBaseUrl = http://127.0.0.1:8787`
- `narrate.licensing.publicKeyPem = <optional pinned key>`
- `narrate.licensing.autoRefreshOnStartup = true|false`
- `narrate.governance.autoSync.enabled = true|false`
- `narrate.governance.autoSync.intervalSeconds = <seconds>`
- `narrate.governance.autoSync.requireBackendMode = true|false`
- `narrate.governance.autoSync.dryRun = true|false`
- `narrate.governance.autoSync.showNotifications = true|false`
- `narrate.governance.stateFile = <optional path to worker state file>`

### Placeholder mode settings
- `narrate.licensing.mode = placeholder`
- `narrate.licensing.placeholderPlan = free|trial|pro|team|enterprise`

### Backend environment (checkout/OAuth)
- `.env` is auto-loaded by server startup (`dotenv/config`).
- `PUBLIC_BASE_URL` (default `http://127.0.0.1:8787`)
- `DATABASE_URL` (Postgres URL, recommended with `?schema=narate_enterprise`)
- `STORE_BACKEND` (`json|prisma`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MAP` (JSON map: `plan:module -> price_id`)
- `CHECKOUT_SUCCESS_URL`
- `CHECKOUT_CANCEL_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `OAUTH_CALLBACK_ORIGINS` (comma-separated trusted origins for web callback URLs)
- `ADMIN_KEY`
- `ADMIN_ROUTE_PREFIX` (default `/pg-global-admin`)
- `ADMIN_AUTH_MODE` (`db|hybrid|key`)
- `ADMIN_RBAC_BOOTSTRAP` (`true|false`)
- `ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS` (comma-separated bootstrap list for DB admin accounts)
- `SUPER_ADMIN_EMAILS` (comma-separated emails allowed to access `/pg-global-admin/board/*` routes through normal auth)
- `SUPER_ADMIN_SOURCE` (`db|env|hybrid`)
- `ENABLE_EMAIL_OTP` (`true|false`)
- `EXPOSE_DEV_OTP_CODE` (`true|false`)
- `SESSION_COOKIE_NAME`
- `SESSION_COOKIE_SECURE`
- `SESSION_COOKIE_SAMESITE`
- `AUTH_START_RATE_LIMIT_MAX`
- `AUTH_START_RATE_LIMIT_WINDOW`
- `AUTH_VERIFY_RATE_LIMIT_MAX`
- `AUTH_VERIFY_RATE_LIMIT_WINDOW`
- `CLOUDFLARE_ACCESS_ENABLED` (`true|false`)
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN` (e.g. `your-team.cloudflareaccess.com`)
- `CLOUDFLARE_ACCESS_AUD`
- `CLOUDFLARE_ACCESS_JWKS_TTL_SECONDS`
- `GOVERNANCE_ALLOW_PRO`
- `GOVERNANCE_DEFAULT_RETENTION_DAYS`
- `GOVERNANCE_DEFAULT_MAX_DEBATE_CHARS`
- `GOVERNANCE_SLACK_ADDON_SEAT_PRICE_CENTS`
- `SLACK_COMMANDS_ENABLED` (`true|false`)
- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`
- `SLACK_WEBHOOK_URL` (optional fallback dispatch)
- `SLACK_ALLOWED_TEAM_IDS` (comma-separated)
- `SLACK_ALLOWED_EMAILS` (comma-separated)
- `SLACK_REQUEST_MAX_AGE_SECONDS`

### Web account/team API surface (auth required)
- `GET /account/summary`
- `GET /account/billing/history`
- `GET /account/support/history`
- `POST /account/support/request`
- `POST /account/feedback`
- `POST /account/team/create`
- `GET /account/team/status`
- `POST /account/team/assign-seat`
- `POST /account/team/revoke-seat`
- `POST /account/team/provider-policy/set`
- `GET /account/governance/settings`
- `POST /account/governance/settings/update`
- `POST /account/governance/eod/report`
- `GET /account/governance/eod/list`
- `POST /account/governance/mastermind/thread/create`
- `GET /account/governance/mastermind/threads`
- `GET /account/governance/mastermind/thread/:thread_id`
- `POST /account/governance/mastermind/entry`
- `POST /account/governance/mastermind/vote`
- `POST /account/governance/mastermind/decide`
- `GET /account/governance/sync/pull`
- `POST /account/governance/sync/ack`
- `POST /account/policy/dependency/verify`
- `POST /account/policy/coding/verify`
- `POST /account/policy/api-contract/verify`
- `POST /account/policy/prompt/guard`
- `POST /account/governance/slack/test`
- `GET /integrations/slack/health`
- `POST /integrations/slack/commands`
- `POST /integrations/slack/actions`

### Super admin / admin board API surface (auth + DB RBAC)
- `GET /pg-global-admin/board/summary`
- `GET /pg-global-admin/board/users`
- `GET /pg-global-admin/board/subscriptions`
- `GET /pg-global-admin/board/payments`
- `GET /pg-global-admin/board/support`
- `GET /pg-global-admin/board/governance`
- `POST /pg-global-admin/board/support/status`
- `POST /pg-global-admin/board/subscription/revoke`
- `POST /pg-global-admin/board/sessions/revoke-user`
- `POST /pg-global-admin/governance/slack-addon/team`
- `POST /pg-global-admin/governance/slack-addon/user`
- `POST /pg-global-admin/affiliate/conversion/confirm`
- `POST /pg-global-admin/affiliate/payout/approve`

### Export/report settings
- `narrate.export.outputDir` (default `.narrate/exports`)
- `narrate.export.includeGlob`
- `narrate.export.excludeGlob`
- `narrate.export.maxFiles` (default `120`)
- `narrate.export.maxCharsPerFile` (default `40000`)
- `narrate.report.outputSubdir` (default `reports`)

### Enforcement settings (extension)
- `narrate.enforcement.projectFramework` (default `unknown`)
- `narrate.enforcement.postWrite.enabled` (default `true`)
- `narrate.enforcement.postWrite.warnOnly` (default `true`)
- `narrate.enforcement.postWrite.debounceMs` (default `1200`)
- `narrate.enforcement.postWrite.showNotifications` (default `false`)
- `narrate.enforcement.prePush.enabled` (default `true`)
- `narrate.enforcement.prePush.warnOnly` (default `false`)

## Tooling Inventory
| Capability | Tool | Enabled (Y/N) | Config Path |
|---|---|---|---|
| VS Code extension API | `vscode` | Y | `extension/src/extension.ts` |
| OpenAI-compatible HTTP client | native `fetch` | Y | `extension/src/llm/openAICompatibleProvider.ts` |
| Local line cache | JSON file | Y | `extension/src/cache/jsonCacheProvider.ts` |
| Licensing feature gate engine | extension service | Y | `extension/src/licensing/featureGates.ts` |
| Provider policy enforcement in extension | entitlement policy checks | Y | `extension/src/llm/openAICompatibleProvider.ts` |
| Local licensing backend API | Fastify | Y | `server/src/index.ts` |
| Prisma data model + client | Prisma | Y | `server/prisma/schema.prisma` |
| Checkout/webhook/offline/redeem/affiliate routes | Fastify routes | Y | `server/src/index.ts` |
| Team seat + provider policy admin routes | Fastify routes | Y | `server/src/index.ts` |
| Landing/terms/privacy pages | static assets via Fastify | Y | `server/public/*`, `server/src/index.ts` |
| SQLite cache | planned milestone | N | planned |
| Production Postgres backend | planned hardening | N | planned |

## Update Rules
- If command surfaces, scripts, runtime versions, or service endpoints change, update this file in the same session.
- Never store API keys/tokens in committed docs/config.
- Hook baseline:
  - `.githooks/pre-commit` runs `scripts/memory_bank_guard.py`
  - `.githooks/pre-push` runs `scripts/enforcement_trigger.ps1 -Phase pre-push`
  - emergency bypass only: `SKIP_PG_ENFORCEMENT=1`


