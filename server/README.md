# Narrate Licensing Backend (Milestone 5 + 6 + 7 Core + Web Portal)

Local backend service for licensing, trial, entitlement token refresh, install/device binding, project quota, refund flow, payments, redeem codes, affiliate tracking, and team/provider-policy governance.

This server also hosts:
- Marketing site at `/`
- Secure portal app at `/app` (sidebar dashboard for customer/team/admin operations)

## Run

```powershell
cd server
npm install
npm run dev
# optional web route smoke test
npm run smoke:web
# prisma client + schema sync
npm run prisma:generate
npm run prisma:dbpush
# one-user governance bootstrap (team + entitlement + slack add-on)
npm run seed:governance-user -- --email extensionpgglobal@gmail.com --team-key TEAM-SOLO
```

## Cloudflare Tunnel (Domain: `pg-ext.addresly.com`)

Install cloudflared (once):

```powershell
winget install -e --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
```

Quick public demo URL (temporary `*.trycloudflare.com`):

```powershell
powershell -ExecutionPolicy Bypass -File ..\scripts\setup_cloudflare_tunnel.ps1 -Mode quick -OriginUrl http://127.0.0.1:8787
```

Named tunnel for your domain:

```powershell
powershell -ExecutionPolicy Bypass -File ..\scripts\setup_cloudflare_tunnel.ps1 -Mode named -TunnelName pg-ext-narrate -Hostname pg-ext.addresly.com -OriginUrl http://127.0.0.1:8787
```

The named mode handles:
- Cloudflare login (if needed)
- tunnel create/reuse
- DNS route for hostname to tunnel
- `~/.cloudflared/config.yml` generation

## Environment

Defaults:

- `HOST=127.0.0.1`
- `PORT=8787`
- `ADMIN_KEY=dev-admin-key`
- `ADMIN_ROUTE_PREFIX=/pg-global-admin`
- `ADMIN_AUTH_MODE=db`
- `ADMIN_RBAC_BOOTSTRAP=true`
- `ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS=owner@yourdomain.com`
- `STORE_PATH=./data/store.json`
- `STORE_BACKEND=json`
- `PUBLIC_BASE_URL=http://127.0.0.1:8787`
- `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=narate_enterprise` (Prisma)
- `SUPER_ADMIN_EMAILS=owner@yourdomain.com,ops@yourdomain.com`
- `SUPER_ADMIN_SOURCE=db`
- `CLOUDFLARE_ACCESS_ENABLED=false`
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN=your-team.cloudflareaccess.com`
- `CLOUDFLARE_ACCESS_AUD=<cloudflare-app-aud>`
- `CLOUDFLARE_ACCESS_JWKS_TTL_SECONDS=600`
- `ENABLE_EMAIL_OTP=false`
- `EXPOSE_DEV_OTP_CODE=false`
- `SESSION_COOKIE_NAME=pg_session`
- `SESSION_COOKIE_SECURE=false`
- `SESSION_COOKIE_SAMESITE=lax`
- `AUTH_START_RATE_LIMIT_MAX=20`
- `AUTH_START_RATE_LIMIT_WINDOW=1 hour`
- `AUTH_VERIFY_RATE_LIMIT_MAX=5`
- `AUTH_VERIFY_RATE_LIMIT_WINDOW=5 hours`
- `GOVERNANCE_ALLOW_PRO=false`
- `GOVERNANCE_DEFAULT_RETENTION_DAYS=7`
- `GOVERNANCE_DEFAULT_MAX_DEBATE_CHARS=4000`
- `GOVERNANCE_SLACK_ADDON_SEAT_PRICE_CENTS=2500`
- `SLACK_COMMANDS_ENABLED=false`
- `SLACK_SIGNING_SECRET=...`
- `SLACK_BOT_TOKEN=xoxb-...` (required for Slack slash command user-email mapping and channel post)
- `SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...` (optional fallback dispatch)
- `SLACK_ALLOWED_TEAM_IDS=T12345,T67890`
- `SLACK_ALLOWED_EMAILS=reviewer@company.com,lead@company.com`
- `SLACK_REQUEST_MAX_AGE_SECONDS=300`

Environment loading:
- `server/src/index.ts` loads `.env` automatically via `dotenv/config`, so OAuth and Stripe keys in `server/.env` are applied on server startup.

Stripe (required for real checkout/webhook):

- `STRIPE_SECRET_KEY=sk_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `STRIPE_PRICE_MAP={"pro:narrate":"price_xxx","pro:bundle":"price_yyy","team:bundle":"price_zzz"}`
- `CHECKOUT_SUCCESS_URL=https://your-site/success`
- `CHECKOUT_CANCEL_URL=https://your-site/cancel`

GitHub OAuth (required for GitHub sign-in):

- `GITHUB_CLIENT_ID=...`
- `GITHUB_CLIENT_SECRET=...`
- `GITHUB_REDIRECT_URI=http://127.0.0.1:8787/auth/github/callback`

Google OAuth (optional for web sign-in):

- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `GOOGLE_REDIRECT_URI=http://127.0.0.1:8787/auth/google/callback`

OAuth callback trust:

- `OAUTH_CALLBACK_ORIGINS=https://your-site.com,http://127.0.0.1:8787`
  - `callback_url` passed to `/auth/github/start` or `/auth/google/start` must be loopback or match one of these origins.

## Slack setup (step-by-step)

1. Create one Slack app (platform-level, done once by PG Global):
   - Open `https://api.slack.com/apps` -> `Create New App`.
   - App type: `From scratch`.

2. Configure slash command:
   - `Slash Commands` -> `Create New Command`.
   - Command: `/pg` (or your preferred command).
   - Request URL: `https://pg-ext.addresly.com/integrations/slack/commands`.

3. Configure interactive actions:
   - `Interactivity & Shortcuts` -> enable interactivity.
   - Request URL: `https://pg-ext.addresly.com/integrations/slack/actions`.

4. Add bot token scopes:
   - `commands`
   - `chat:write`
   - `users:read`
   - `users:read.email`

5. Install app to workspace and copy credentials:
   - `OAuth & Permissions` -> `Install to Workspace`.
   - Copy `Bot User OAuth Token` (`xoxb-...`) -> `SLACK_BOT_TOKEN`.
   - `Basic Information` -> copy `Signing Secret` -> `SLACK_SIGNING_SECRET`.

6. Enable on server `.env`:
   - `SLACK_COMMANDS_ENABLED=true`
   - `SLACK_SIGNING_SECRET=...`
   - `SLACK_BOT_TOKEN=...`
   - Optional: `SLACK_ALLOWED_TEAM_IDS=...`, `SLACK_ALLOWED_EMAILS=...`.

7. Restart server and verify:
   - `GET /integrations/slack/health` should show `commands_enabled: true` and secrets present.

Ownership model:
- Global Slack app credentials are server-level (you manage once).
- Enterprise customers do not need to provide bot secrets for your hosted app.
- Per-enterprise behavior is controlled by governance settings (`slack_enabled`, `slack_channel`, add-on active).

## Web pages

- `GET /` landing page (marketing)
- `GET /app` secure portal dashboard
- `GET /terms`
- `GET /privacy`
- `GET /checkout/success`
- `GET /checkout/cancel`
- `GET /oauth/github/complete` (web OAuth callback bridge page)
- `GET /oauth/google/complete` (web OAuth callback bridge page)

## Core endpoints

- Catalog:
  - `GET /catalog/plans`
  - `GET /catalog/modules`
- Auth:
  - `POST /auth/email/start`
  - `POST /auth/email/verify`
  - `POST /auth/session/signout`
  - `GET /auth/github/start`
  - `GET /auth/github/callback`
  - `GET /auth/google/start`
  - `GET /auth/google/callback`
- Trial + entitlement:
  - `POST /trial/start`
  - `POST /entitlement/activate`
  - `POST /entitlement/refresh`
  - `GET /entitlement/status`
  - `GET /entitlement/public-key`
- Device + quota:
  - `POST /devices/list`
  - `POST /devices/revoke`
  - `POST /projects/activate`
  - `GET /projects/quota`
- Refund:
  - `POST /refund/request`
  - `POST /pg-global-admin/refund/approve`
- Payments + redeem:
  - `POST /payments/stripe/create-checkout-session`
  - `POST /payments/stripe/webhook`
  - `POST /payments/offline/create-ref`
  - `POST /payments/offline/submit-proof`
  - `POST /redeem/apply`
  - `POST /pg-global-admin/offline/approve`
  - `POST /pg-global-admin/offline/reject`
- Affiliate:
  - `POST /affiliate/code/create`
  - `POST /affiliate/track-click`
  - `POST /pg-global-admin/affiliate/conversion/confirm` (admin)
  - `GET /affiliate/dashboard`
  - `POST /pg-global-admin/affiliate/payout/approve`
- Team + provider policy:
  - `POST /pg-global-admin/team/create`
  - `POST /pg-global-admin/team/assign-seat`
  - `POST /pg-global-admin/team/revoke-seat`
  - `GET /pg-global-admin/team/status`
  - `POST /pg-global-admin/team/provider-policy/set`
  - `POST /pg-global-admin/provider-policy/set-user`
- Account portal APIs (auth required):
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
- Slack integration:
  - `GET /integrations/slack/health`
  - `POST /integrations/slack/commands`
  - `POST /integrations/slack/actions`
- Super admin/admin board APIs (auth + DB RBAC):
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

## Prisma

- Prisma schema file: `server/prisma/schema.prisma`
- Target DB schema for licensing tables: `narate_enterprise` (non-`public`)
- Commands:
  - `npm run prisma:generate`
  - `npm run prisma:dbpush`

Current status:
- PostgreSQL schema and Prisma models are provisioned.
- Runtime state now supports two modes:
  - `STORE_BACKEND=json` -> file store at `server/data/store.json`
  - `STORE_BACKEND=prisma` -> table-by-table persistence in Postgres (`narate_enterprise.*` tables)
- Admin/operator data model is isolated with dedicated tables (`admin_accounts`, `admin_roles`, `admin_permissions`, `admin_role_permissions`, `admin_scopes`, `admin_account_roles`, `admin_audit_logs`) so customer `users` is not mixed with admin identities.

## Admin auth

Admin endpoints support DB-backed RBAC permissions:

- Default mode: `ADMIN_AUTH_MODE=db`
  - requires signed-in user session (bearer token or `HttpOnly` cookie)
  - checks `admin_accounts` + `admin_account_roles` + `admin_role_permissions` + `admin_permissions`
- Optional fallback: `ADMIN_AUTH_MODE=hybrid`
  - allows legacy `x-admin-key: <ADMIN_KEY>` only when needed
- Legacy-only mode: `ADMIN_AUTH_MODE=key`
  - key-only admin auth (not recommended)

Cloudflare admin lock (optional but recommended in production):
- Set `CLOUDFLARE_ACCESS_ENABLED=true`
- Set `CLOUDFLARE_ACCESS_TEAM_DOMAIN` and `CLOUDFLARE_ACCESS_AUD`
- Server verifies `cf-access-jwt-assertion` on admin routes before RBAC checks.

Super-admin identity source is controlled by `SUPER_ADMIN_SOURCE`:

- `env`: only `SUPER_ADMIN_EMAILS`
- `db`: only `admin_accounts.is_super_admin=true AND status='active'`
- `hybrid`: union of env and DB

## Dev helper

- `POST /pg-global-admin/subscription/grant`

Example:

```json
{
  "email": "dev@example.com",
  "plan_id": "pro",
  "module_scope": "bundle",
  "years": 1
}
```
