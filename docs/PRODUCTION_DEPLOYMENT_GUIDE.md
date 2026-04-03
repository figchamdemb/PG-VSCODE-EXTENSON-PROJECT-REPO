# Narrate — Production Deployment Guide

> How to deploy the Narrate licensing server to production with Cloudflare domain, Hetzner PostgreSQL, and secure configuration.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Server Preparation](#server-preparation)
4. [Database Setup (Hetzner PostgreSQL)](#database-setup)
5. [Environment Configuration](#environment-configuration)
6. [Prisma Migrations](#prisma-migrations)
7. [Build and Start](#build-and-start)
8. [Cloudflare Domain + Tunnel](#cloudflare-domain-and-tunnel)
9. [OAuth Configuration](#oauth-configuration)
10. [Stripe Integration](#stripe-integration)
11. [Slack Integration](#slack-integration)
12. [Admin Bootstrap](#admin-bootstrap)
13. [Health Monitoring](#health-monitoring)
14. [Security Hardening Checklist](#security-hardening-checklist)
15. [Maintenance Operations](#maintenance-operations)
16. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                     ┌──────────────────┐
   Users/Extension   │   Cloudflare     │
   ────────────────► │   Tunnel/DNS     │
                     │  pg-ext.addresly │
                     │      .com        │
                     └────────┬─────────┘
                              │
                     ┌────────▼─────────┐
                     │  Narrate Server  │
                     │  (Fastify 5)     │
                     │  Port 8787       │
                     └────────┬─────────┘
                              │
                     ┌────────▼─────────┐
                     │  PostgreSQL      │
                     │  Hetzner DB      │
                     │  91.98.162.101   │
                     │  Port 5433       │
                     │  narate_enterprise│
                     └──────────────────┘
```

---

## Infrastructure Requirements

| Component | Specification | Provider |
|---|---|---|
| Server (VPS) | 2+ vCPU, 4 GB RAM, Ubuntu 22+ or Windows Server | Any (Hetzner/DigitalOcean/AWS) |
| PostgreSQL | v15+, `narate_enterprise` schema | Hetzner (91.98.162.101:5433) |
| Domain | `pg-ext.addresly.com` | Cloudflare DNS |
| Tunnel | `cloudflared` daemon | Cloudflare Zero Trust |
| Node.js | v20.x LTS | On server |
| npm | v10.x | On server |

---

## Server Preparation

### Install Node.js on Production Server

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version    # v20.x
npm --version     # 10.x
```

### Clone Repository

```bash
git clone https://github.com/figchamdemb/PG-VSCODE-EXTENSON-PROJECT-REPO.git
cd PG-VSCODE-EXTENSON-PROJECT-REPO/server
npm install --production
```

### Install Prisma CLI

```bash
npm install    # includes prisma as devDependency
npx prisma generate
```

---

## Database Setup

### Hetzner PostgreSQL Connection

Your database is already running at `91.98.162.101:5433`. Ensure:

1. **Schema exists**: `narate_enterprise`
2. **User has permissions**: CREATE, ALTER, INSERT, UPDATE, DELETE, SELECT on the schema
3. **Network access**: Server IP is allowed in Hetzner DB firewall

### Connection String Format

```
DATABASE_URL="postgresql://USER:PASSWORD@91.98.162.101:5433/DB_NAME?schema=narate_enterprise"
```

Replace `USER`, `PASSWORD`, and `DB_NAME` with your actual credentials.

### Verify Connectivity

```bash
# From server
npx prisma migrate status
# Should show migration status without connection errors
```

---

## Environment Configuration

Create `server/.env` from the example:

```bash
cp server/.env.example server/.env
```

### Required Variables

```dotenv
# ─── Core ───
DATABASE_URL="postgresql://USER:PASSWORD@91.98.162.101:5433/DB_NAME?schema=narate_enterprise"
STORE_BACKEND="prisma"
NODE_ENV="production"
HOST="0.0.0.0"
PORT="8787"
PUBLIC_BASE_URL="https://pg-ext.addresly.com"
OAUTH_CALLBACK_ORIGINS="https://pg-ext.addresly.com"
OAUTH_CALLBACK_SCHEMES="vscode,cursor,windsurf,vscodium"
OAUTH_EDITOR_CALLBACK_HOSTS="figchamdemb.narrate-vscode-extension,figchamdemb.narrate"

# ─── Admin ───
ADMIN_KEY="<generate-a-strong-random-key>"
ADMIN_ROUTE_PREFIX="/pg-global-admin"
ADMIN_AUTH_MODE="db"
ADMIN_RBAC_BOOTSTRAP="true"
ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS="your-real-admin@email.com"
SUPER_ADMIN_SOURCE="db"
SUPER_ADMIN_EMAILS="your-real-admin@email.com"

# ─── Sessions ───
SESSION_COOKIE_NAME="pg_session"
SESSION_COOKIE_SECURE="true"
SESSION_COOKIE_SAMESITE="strict"
```

### OAuth Variables (Required for Sign-In)

```dotenv
# ─── GitHub OAuth ───
GITHUB_CLIENT_ID="<your-github-oauth-app-client-id>"
GITHUB_CLIENT_SECRET="<your-github-oauth-app-client-secret>"
GITHUB_REDIRECT_URI="https://pg-ext.addresly.com/auth/github/callback"

# ─── Google OAuth ───
GOOGLE_CLIENT_ID="<your-google-oauth-client-id>"
GOOGLE_CLIENT_SECRET="<your-google-oauth-client-secret>"
GOOGLE_REDIRECT_URI="https://pg-ext.addresly.com/auth/google/callback"
```

`OAUTH_CALLBACK_SCHEMES` and `OAUTH_EDITOR_CALLBACK_HOSTS` control which editor deep-link targets are trusted for browser-to-editor sign-in return. Keep these allowlists narrow and limited to the editors and extension identifiers you actually ship.

### Payment Variables (Required for Checkout)

```dotenv
# ─── Stripe ───
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_MAP='{"pro_monthly":"price_xxx","pro_yearly":"price_yyy","team_monthly":"price_zzz"}'
CHECKOUT_SUCCESS_URL="https://pg-ext.addresly.com/checkout/success"
CHECKOUT_CANCEL_URL="https://pg-ext.addresly.com/checkout/cancel"
```

Checkout success and cancel URLs should remain hosted web pages. The extension now passes an encoded editor return target through those hosted pages so Stripe still redirects to normal HTTPS URLs while the customer can be sent back into VS Code or Cursor after completion.

### Slack Variables (Optional)

```dotenv
SLACK_COMMANDS_ENABLED="true"
SLACK_SIGNING_SECRET="<your-slack-signing-secret>"
SLACK_BOT_TOKEN="xoxb-..."
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
SLACK_ALLOWED_TEAM_IDS="T01234567"
SLACK_ALLOWED_EMAILS="admin@company.com"
```

### Security: Never Commit .env

The `.gitignore` already excludes `server/.env`. Verify:

```bash
git status    # .env should NOT appear as tracked
```

---

## Prisma Migrations

### Run Initial Migration

```bash
cd server
npx prisma migrate deploy
```

This applies the `0_init` migration that creates all tables in the `narate_enterprise` schema:
- `users`, `subscriptions`, `payments`, `devices`
- `admin_accounts`, `admin_roles`, `admin_permissions`, `admin_role_permissions`, `admin_account_role`
- `teams`, `team_memberships`
- And more...

### Check Migration Status

```bash
npx prisma migrate status
```

### Regenerate Client After Schema Changes

```bash
npx prisma generate
```

### Visual DB Browser (Local Only)

```bash
npx prisma studio    # opens http://localhost:5555
```

---

## Build and Start

### Build

```bash
cd server
npm run build    # tsc -p ./
```

Output goes to `server/dist/`.

### Start Production

```bash
cd server
npm run start    # node dist/index.js
```

### Process Manager (Recommended)

Use PM2 to keep the server running and auto-restart on crashes:

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
cd server
pm2 start dist/index.js --name "narrate-server" --env production

# Save PM2 config for auto-restart on reboot
pm2 save
pm2 startup    # follow the output command to enable on boot

# Useful PM2 commands
pm2 status              # check running processes
pm2 logs narrate-server # view logs
pm2 restart narrate-server
pm2 stop narrate-server
```

### Systemd Service (Alternative)

Create `/etc/systemd/system/narrate-server.service`:

```ini
[Unit]
Description=Narrate Licensing Server
After=network.target

[Service]
Type=simple
User=narrate
WorkingDirectory=/home/narrate/PG-VSCODE-EXTENSON-PROJECT-REPO/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable narrate-server
sudo systemctl start narrate-server
sudo systemctl status narrate-server
```

---

## Cloudflare Domain and Tunnel

### DNS Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → your zone (`addresly.com`).
2. DNS → Add record:
   - **Type**: CNAME
   - **Name**: `pg-ext`
   - **Target**: (tunnel UUID).cfargotunnel.com
   - **Proxy**: ON (orange cloud)

### Install cloudflared

```bash
# Linux
curl -L -o cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Windows (already installed via winget)
# winget install Cloudflare.cloudflared
```

### Create Tunnel

```bash
cloudflared tunnel login    # opens browser for auth
cloudflared tunnel create narrate-prod
# Note the tunnel UUID
```

### Configure Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: /home/narrate/.cloudflared/<TUNNEL-UUID>.json

ingress:
  - hostname: pg-ext.addresly.com
    service: http://127.0.0.1:8787
  - service: http_status:404
```

### Run Tunnel

```bash
# Manual
cloudflared tunnel run narrate-prod

# As a service (Linux)
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### Automated Setup Script (Local)

The project includes a Cloudflare tunnel setup script:

```powershell
# From project root (Windows/local)
powershell -ExecutionPolicy Bypass -File scripts/setup_cloudflare_tunnel.ps1
```

### Verify

```bash
curl https://pg-ext.addresly.com/health
# Expected: {"ok":true}
```

---

## OAuth Configuration

### GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → New OAuth App.
2. Settings:
   - **Application name**: Narrate
   - **Homepage URL**: `https://pg-ext.addresly.com`
   - **Authorization callback URL**: `https://pg-ext.addresly.com/auth/github/callback`
3. Copy Client ID and Client Secret to `.env`.

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an OAuth 2.0 Client ID:
   - **Application type**: Web application
   - **Authorized redirect URIs**: `https://pg-ext.addresly.com/auth/google/callback`
3. Copy Client ID and Client Secret to `.env`.

---

## Stripe Integration

### Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/) → Developers → API keys.
2. Copy the **Secret key** (`sk_live_...`) to `STRIPE_SECRET_KEY`.
3. Create products and prices for each plan tier.
4. Map price IDs in `STRIPE_PRICE_MAP`:
   ```json
   {"pro_monthly":"price_xxx","pro_yearly":"price_yyy","team_monthly":"price_zzz","team_yearly":"price_www","enterprise_monthly":"price_vvv"}
   ```

### Webhook

1. Stripe Dashboard → Webhooks → Add endpoint.
2. URL: `https://pg-ext.addresly.com/payments/stripe/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

---

## Slack Integration

### Create Slack App

1. Go to [Slack API](https://api.slack.com/apps) → Create New App.
2. From **Basic Information**, copy:
   - **Signing Secret** → `SLACK_SIGNING_SECRET`
3. Install app to workspace → copy **Bot User OAuth Token** → `SLACK_BOT_TOKEN`.

### Configure Slash Commands

Add slash commands pointing to your server:

| Command | Request URL |
|---|---|
| `/pg` | `https://pg-ext.addresly.com/integrations/slack/commands` |

### Configure Interactivity

- **Request URL**: `https://pg-ext.addresly.com/integrations/slack/actions`

---

## Admin Bootstrap

On first startup with `ADMIN_RBAC_BOOTSTRAP=true`, the server automatically:

1. Creates default admin roles (`super_admin`, `operator`, `viewer`)
2. Creates default permissions for each role
3. Seeds the email(s) in `ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS` as super admin

After bootstrap, set `ADMIN_RBAC_BOOTSTRAP=false` to prevent re-seeding on every restart.

### Verify Admin Access

```bash
# Get admin summary (requires auth)
curl -H "Authorization: Bearer <admin-token>" \
  https://pg-ext.addresly.com/pg-global-admin/board/summary
```

---

## Health Monitoring

### Endpoints

| Endpoint | Purpose | Expected Response |
|---|---|---|
| `GET /health` | Liveness probe | `{ "ok": true }` |
| `GET /health/ready` | Readiness probe (includes DB) | `{ "ok": true, "store": "ready" }` |

### Uptime Monitoring

Set up external monitoring (e.g., UptimeRobot, Cloudflare Health Checks):

- **URL**: `https://pg-ext.addresly.com/health`
- **Interval**: 60 seconds
- **Alert**: When status is not 200

### Startup Validation

The server runs 14 production-readiness checks on startup:
- Required env vars present
- DB connectivity
- OAuth credentials configured
- Stripe keys present
- CORS origins set
- Session security flags

If any critical check fails in `NODE_ENV=production`, the server **crashes immediately** with a descriptive error.

---

## Security Hardening Checklist

- [ ] `NODE_ENV=production` is set
- [ ] `SESSION_COOKIE_SECURE=true`
- [ ] `SESSION_COOKIE_SAMESITE=strict`
- [ ] `ADMIN_KEY` is a strong random value (32+ chars)
- [ ] `ADMIN_AUTH_MODE=db` (not `key`)
- [ ] `EXPOSE_DEV_OTP_CODE=false`
- [ ] `ENABLE_EMAIL_OTP=false` (unless needed)
- [ ] `.env` is NOT in git (verify with `git status`)
- [ ] CORS origins locked to production domain only
- [ ] Rate limiting active (100 req/min global, 20/hr auth start, 5/5hr auth verify)
- [ ] HSTS header enabled (automatic in production)
- [ ] Cloudflare proxy ON (hides origin IP)
- [ ] Database credentials rotated from development values
- [ ] OAuth client secrets are production values
- [ ] Stripe keys are **live mode** (not test mode)
- [ ] Slack signing secret is from production Slack app
- [ ] GitHub/Google OAuth callback URLs match production domain

---

## Maintenance Operations

### Database Index Maintenance

```powershell
# Check for unused/missing indexes
.\pg.ps1 db-index-check

# Generate fix plan
.\pg.ps1 db-index-fix-plan

# Apply fixes
.\pg.ps1 db-index-remediate
```

### Prisma Schema Updates

When schema changes are needed:

```bash
cd server
# Edit prisma/schema.prisma
npx prisma migrate dev --name "describe-change"    # local dev
npx prisma migrate deploy                           # production
```

### Log Inspection

```bash
# PM2 logs
pm2 logs narrate-server --lines 100

# Or if using systemd
journalctl -u narrate-server -f
```

### Server Update Deployment

```bash
cd /path/to/PG-VSCODE-EXTENSON-PROJECT-REPO
git pull origin main
cd server
npm install
npm run build
npx prisma migrate deploy    # apply any new migrations
pm2 restart narrate-server   # or: sudo systemctl restart narrate-server
```

---

## Troubleshooting

| Issue | Diagnosis | Fix |
|---|---|---|
| Server won't start | Check startup validation errors | Fix missing env vars in `.env` |
| DB connection refused | `npx prisma migrate status` | Verify `DATABASE_URL`, check firewall |
| OAuth callback fails | Check browser URL bar | Verify `*_REDIRECT_URI` matches domain |
| Stripe webhook 400 | Check Stripe dashboard webhook logs | Verify `STRIPE_WEBHOOK_SECRET` |
| Cloudflare 530 | Tunnel not running | Start `cloudflared tunnel run` |
| CORS errors in browser | Check browser console | Add domain to `OAUTH_CALLBACK_ORIGINS` |
| Admin routes 403 | RBAC not bootstrapped | Set `ADMIN_RBAC_BOOTSTRAP=true`, restart once |
| Health returns 503 | Store not ready | Check DB connectivity |
| Rate limit 429 | Too many auth attempts | Wait for window reset or adjust limits |

---

## Quick Reference

```bash
# Build
cd server && npm run build

# Start (production)
cd server && npm run start

# Start (development with hot reload)
cd server && npm run dev

# Check DB migration status
cd server && npx prisma migrate status

# Apply migrations
cd server && npx prisma migrate deploy

# Health check
curl https://pg-ext.addresly.com/health

# Readiness check
curl https://pg-ext.addresly.com/health/ready
```
