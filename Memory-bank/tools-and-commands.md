# Tools & Commands

LAST_UPDATED_UTC: 2026-02-23 00:34
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

### Key extension commands (Command Palette)
- `Narrate: Toggle Reading Mode (Dev)`
- `Narrate: Toggle Reading Mode (Edu)`
- `Narrate: Switch Narration Mode`
- `Narrate: Request Change Prompt`
- `Narrate: Export Narration (Current File)` (Pro+ gate)
- `Narrate: Export Narration (Workspace)` (Pro+ gate)
- `Narrate: Generate Change Report (Git Diff...)` (Pro+ gate)
- `Narrate: PG Push (Git Add/Commit/Push)`
- `Narrate: PG Git Push` (alias for PG Push)
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

### Planned governance command aliases (Milestone 9+)
- `PG EOD` / `PG EndOfDay`
- `PG Mastermind` / `PG MM`
- `PG Decision`
- `PG Plan` (opens mastermind/planning thread context for multi-agent debate)
- Slack slash command grammar:
  - `summary`
  - `eod <title> :: <summary>`
  - `thread <title> :: <question> :: <option1|option2|...>`
  - `vote <thread_id> <option_key> [rationale]` (team vote step)
  - `decide <thread_id> <approve|reject|needs_change> [option_key] [note]` (owner/manager final step)
- Slack role visibility checks:
  - `summary` now returns team memberships as `TEAM_KEY (role)`.
  - `Refresh Thread` card context now prints scope and your effective access label (e.g., `manager (can vote + finalize)`).

### Backend mode settings
- `narrate.licensing.mode = backend`
- `narrate.licensing.apiBaseUrl = http://127.0.0.1:8787`
- `narrate.licensing.publicKeyPem = <optional pinned key>`
- `narrate.licensing.autoRefreshOnStartup = true|false`

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
