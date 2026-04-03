# Narrate — Testing Guide

> Comprehensive guide for testing the extension, server, and compliance pipeline.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Extension Testing](#extension-testing)
3. [Server Testing](#server-testing)
4. [Playwright Smoke Tests](#playwright-smoke-tests)
5. [PG Self-Check (Compliance)](#pg-self-check)
6. [Narrate Flow Validation](#narrate-flow-validation)
7. [Individual Policy Checks](#individual-policy-checks)
8. [Manual Functional Testing](#manual-functional-testing)
9. [CI/CD Testing](#cicd-testing)
10. [Final Pass/Fail One-Page Template](#final-passfail-one-page-template)

---

## Quick Start

```powershell
# From project root — runs the compliance path with Playwright evidence output
.\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck -PlaywrightBrowserMatrix desktop
```

---

## Extension Testing

### Compile Check

```powershell
cd extension
npm install          # first time only
npm run compile      # rimraf dist && tsc -p ./
```

A clean compile (zero errors) confirms all TypeScript types, imports, and VS Code API usage are correct.

### Launch Extension in VS Code (F5 Debug)

1. Open the project root in VS Code.
2. Press **F5** (or Run → Start Debugging).
3. Select **"Extension Development Host"** if prompted.
4. A new VS Code window opens with the extension loaded.
5. Open any source file → run `Narrate: Toggle Reading Mode (Dev)`.
6. Verify narration appears in the editor or side pane.

### Key Commands to Test

| Command | What to Verify |
|---|---|
| `Narrate: Toggle Reading Mode (Dev)` | Narration renders for active file |
| `Narrate: Toggle Reading Mode (Edu)` | Edu-level narration with term explanations |
| `Narrate: Switch Reading View Mode` | Toggles exact ↔ section view |
| `Narrate: PG Push` | Runs trust + enforcement gates → git push |
| `Narrate: Run Environment Doctor` | Scans workspace for missing env vars |
| `Narrate: Run Dead Code Scan` | Reports unused exports/files |
| `Narrate: Run API Contract Validator` | Compares OpenAPI spec vs code |
| `Narrate: Run Trust Score` | Shows quality grade + rule findings |
| `Narrate: Run Command Diagnostics` | 7 checks across 3 categories |
| `Narrate: Open Command Help` | Opens help sidebar |

### Extension Unit Test Setup (Future)

The extension currently relies on compile-time type checking + runtime F5 testing. To add unit tests:

```powershell
cd extension
npm install --save-dev @vscode/test-electron mocha @types/mocha
```

Create `extension/src/test/suite/index.ts` and `extension/src/test/runTest.ts` following the [VS Code Testing Extension docs](https://code.visualstudio.com/api/working-with-extensions/testing-extension).

---

## Server Testing

### Build Check

```powershell
cd server
npm install          # first time only
npm run build        # tsc -p ./
```

### Start Server Locally

```powershell
cd server
npm run dev          # tsx watch src/index.ts (hot reload)
```

Server starts on `http://127.0.0.1:8787`. Verify:

```powershell
# Health check
Invoke-RestMethod http://127.0.0.1:8787/health
# Expected: { "ok": true }

# Readiness check (includes store connectivity)
Invoke-RestMethod http://127.0.0.1:8787/health/ready
# Expected: { "ok": true, "store": "ready" }
```

### Environment Variables

Copy `.env.example` to `.env` and fill in values:

```powershell
cd server
Copy-Item .env.example .env
# Edit .env with your local/dev values
```

Required for basic local testing:
- `DATABASE_URL` — PostgreSQL connection string (or omit and use `STORE_BACKEND=json`)
- `STORE_BACKEND` — `json` (file-based, no DB needed) or `prisma` (requires PostgreSQL)
- `HOST` / `PORT` — defaults to `127.0.0.1:8787`

---

## Playwright Smoke Tests

The server includes Playwright-based smoke tests for HTTP endpoints.

### Run Smoke Tests

```powershell
cd server
npm run playwright:install            # first time or when browsers are missing
npm run smoke:playwright
npm run smoke:playwright:report       # opens the latest server-local HTML report

# Or from project root with PG artifact output and browser matrix control
.\pg.ps1 playwright-author
.\pg.ps1 playwright-smoke-check -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers
.\pg.ps1 playwright-full-check -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers
```

These shipped smoke tests are local-server-first and now include a real local email-auth portal flow in addition to the health and landing checks.

They now also include a backend-level Stripe checkout regression smoke that authenticates locally and verifies all 9 paid yearly SKU keys can create Stripe Checkout sessions.

### What the Smoke Tests Cover

| Test | Endpoint | Assertion |
|---|---|---|
| Health endpoint | `GET /health` | Returns `{ ok: true }` |
| Landing page | `GET /` | Returns HTML containing "narrate" |
| Portal email auth | `GET /app`, `POST /auth/email/start`, `POST /auth/email/verify`, `GET /account/summary` | Signs in through the portal UI and confirms the loaded account email |
| Stripe checkout yearly SKU smoke | `POST /payments/stripe/create-checkout-session` | Authenticates locally and verifies all 9 paid SKU keys return Stripe Checkout session IDs |

### Artifacts And Browser Coverage

- `pg playwright-smoke-check` and `pg self-check` now write HTML/JSON evidence under `Memory-bank/_generated/playwright-smoke/`.
- The latest machine-readable pointer is `Memory-bank/_generated/playwright-smoke/playwright-smoke-latest.json`.
- Use `-PlaywrightBrowserMatrix minimal|desktop|full` to choose between one-browser smoke, desktop matrix, or the broader course-style desktop+mobile matrix.
- Failure artifacts come from Playwright itself: HTML report, trace, screenshot, and retained video on failure.

### Authored PG Workflow

- `pg playwright-author` scans the local project and generates a managed authored suite under `server/tests/pg-generated/`.
- `pg playwright-full-check` runs authoring first, then executes the authored suite across the requested browser matrix, and finally writes a single latest summary at `Memory-bank/_generated/playwright-full-check/playwright-full-check-latest.json`.
- Each authored run also writes `failures.json` and `failures.md` next to the normal Playwright HTML/JSON outputs so an agent can open the exact failing scenario before attempting a fix.
- The current authored suite pattern groups tests into smoke, route coverage, forms, suspicious-input hardening, accessibility, and commerce-like flows.

### Course-Aligned Test Authoring Policy

- Start with happy-path smoke flows for the real user journey that matters most.
- Add edge/error/accessibility/API tests after the smoke path is stable, not before.
- Prefer stable selectors: IDs, roles, labels, and meaningful text over brittle CSS chains.
- AI-generated tests are acceptable as a draft, but the agent must inspect the frontend and tailor the assertions to the actual product flow before relying on them.

### Local Auth Flow Testing

The smoke suite already enables local email auth in its dedicated smoke-server process. If you want to test the same local email-auth path outside the smoke suite, enable `ENABLE_EMAIL_OTP=true` in `server/.env` and restart the backend. That turns on the normal local code-entry flow in `/app` and in the extension email sign-in prompt.

For local-only operator testing, keep the verify rate limit loose enough that repeated OTP retries do not lock the portal for hours. A practical local profile is:

```dotenv
AUTH_VERIFY_RATE_LIMIT_MAX="50"
AUTH_VERIFY_RATE_LIMIT_WINDOW="15 minutes"
```

That is a local testing convenience only. Tight production values should stay stricter.

For the fastest local-only path, also enable:

```dotenv
ENABLE_EMAIL_OTP="true"
EXPOSE_DEV_OTP_CODE="true"
```

Use the two modes like this:

1. Manual entry path: keep `ENABLE_EMAIL_OTP=true` and enter the OTP into `/app` or the extension prompt once you have it from your configured delivery or debug source.
2. Local shortcut path: add `EXPOSE_DEV_OTP_CODE=true` so `/auth/email/start` returns `dev_code`, and the extension prompt shows that code inline for immediate local verification.

If GitHub or Google sign-in opens but never completes on local `127.0.0.1`, the usual cause is not the email address on your provider account. The usual cause is that `server/.env` is still pointing OAuth and checkout URLs at the hosted domain instead of the local backend. For local provider testing, keep these values aligned with the local server:

```dotenv
PUBLIC_BASE_URL="http://127.0.0.1:8787"
GITHUB_REDIRECT_URI="http://127.0.0.1:8787/auth/github/callback"
GOOGLE_REDIRECT_URI="http://127.0.0.1:8787/auth/google/callback"
CHECKOUT_SUCCESS_URL="http://127.0.0.1:8787/checkout/success"
CHECKOUT_CANCEL_URL="http://127.0.0.1:8787/checkout/cancel"
OAUTH_CALLBACK_ORIGINS="https://pg-ext.addresly.com,http://127.0.0.1:8787,http://localhost:8787"
OAUTH_CALLBACK_SCHEMES="vscode,cursor,windsurf,vscodium"
OAUTH_EDITOR_CALLBACK_HOSTS="figchamdemb.narrate-vscode-extension,figchamdemb.narrate"
```

Use Cloudflare only when you intentionally want to test the public hostname flow. For ordinary local OAuth testing, `127.0.0.1:8787` is the simpler and safer path.

For the extension customer flow, the expected path is now:

1. Install or update the extension.
2. Set `narrate.licensing.mode=backend` and point `narrate.licensing.apiBaseUrl` at the active backend.
3. Run `Narrate: Sign In (GitHub)`.
4. Complete browser sign-in and confirm the editor reopens with a refreshed license.
5. Run `Narrate: Upgrade Plan (Checkout)` and confirm the hosted success page returns to the editor and refreshes the entitlement automatically.

Keep `.env.example` production-safe with both flags set to `false`.

### Local Stripe Checkout Manual Test

Use this when you want to manually confirm the browser-side Stripe flow after the backend smoke passes.

1. Start the backend on `127.0.0.1:8787` with the current local `server/.env`.
2. Open `http://127.0.0.1:8787/app`.
3. In the Email Login card, enter any unique local test email such as `manual-checkout-<timestamp>@example.com`.
4. Click `Send Email Code`.
5. Because local testing uses `EXPOSE_DEV_OTP_CODE=true`, copy the `dev_code` shown in the on-page console output.
6. Enter that code and click `Verify Email Login`.
7. Open the `Billing` tab.
8. Select the plan and module you want to test.
9. Click `Open Stripe Checkout`.

For Stripe sandbox payment details, use the standard test card:

- Card number: `4242 4242 4242 4242`
- Expiry: any future date, for example `12/34`
- CVC: any 3 digits, for example `123`
- ZIP or postal code: any valid-looking value, for example `12345`

Optional extra card for authentication-style testing:

- 3DS challenge card: `4000 0025 0000 3155`

Expected flow:

1. Stripe Checkout opens on `checkout.stripe.com`.
2. The sandbox card submission succeeds.
3. Stripe returns to `/checkout/success`.
4. If you are testing from the extension checkout flow instead of the web page, the hosted success page should attempt the editor return handoff automatically.

### Adding More Smoke Tests

Create new files in `server/tests/` with the `.spec.ts` suffix:

```typescript
// server/tests/smoke.auth.spec.ts
import { expect, test } from "@playwright/test";

test("@smoke email sign-in returns 400 without body", async ({ request }) => {
  const res = await request.post("/auth/email/start", { data: {} });
  expect(res.status()).toBe(400);
});
```

### Web Smoke (Lightweight)

```powershell
cd server
npm run smoke:web    # node scripts/smoke-web.mjs
```

---

## PG Self-Check

The self-check orchestrator runs all compliance checks in sequence.

### Warn Mode (During Development)

```powershell
.\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck -PlaywrightBrowserMatrix desktop
```

This runs:
1. **Dependency verification** — npm audit + deny-list + compatibility checks
2. **Coding standards** — function size, file size, log safety, DB query patterns
3. **DB index maintenance** — unused index detection (requires DB connectivity)
4. **Playwright smoke** — mandatory local smoke verification against the server runtime

### Strict Mode (Before Release / PR)

```powershell
.\pg.ps1 self-check -EnableDbIndexMaintenanceCheck -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers
```

Same checks but **fails on any blocker** instead of warning.

For local/offline frontend validation only, you can append `-SkipRegistryFetch -AllowDbIndexConnectionWarning` when npm registry metadata is temporarily unreachable or the configured remote `DATABASE_URL` host is not accessible from the current machine. That override is for evidence-first local validation, not production signoff.

Playwright smoke now runs automatically in both warn and strict self-check flows. If the latest strict self-check summary does not include the Playwright stage, the Memory-bank guard rejects the finalize path.

---

## Narrate Flow Validation

Validates that the extension's narration pipeline commands are properly wired.

### Static Check (No Extension Host Needed)

```powershell
.\pg.ps1 narrate-check
```

Runs 5 steps:
1. Package command wiring (13 command IDs)
2. Extension runtime registration (12 markers)
3. Core flow source files (15 files exist)
4. Extension compile
5. Runtime interaction surface validation

### Runtime Check (Requires Extension Host)

In the Extension Development Host (F5), run:

```
Narrate: Run Flow Interaction Check
```

Performs 9 runtime checks: mode state round-trips, render pipeline, scheme provider, export utility, toggle command registration.

---

## Individual Policy Checks

Each policy domain can be tested independently:

```powershell
# Dependency policy
.\pg.ps1 dependency-verify

# Coding standards
.\pg.ps1 coding-verify

# DB index maintenance
.\pg.ps1 db-index-check

# DB index fix plan generation
.\pg.ps1 db-index-fix-plan

# Scalability discovery check
.\pg.ps1 scalability-check

# Observability adapter check
.\pg.ps1 observability-check

# MCP cloud score
.\pg.ps1 mcp-cloud-score

# Production checklist (all 7 domains)
.\pg.ps1 prod-checklist

# Full PG Prod pre-push gate
.\pg.ps1 prod
```

---

## Final Pass/Fail One-Page Template

Use the printable sign-off template:

- `docs/FINAL_PASS_FAIL_TEMPLATE.md`

It covers:
- local/public health checks
- OAuth/account testing (with OTP optional/disabled)
- team/governance/admin verification
- Slack end-to-end closure
- VS Code status-bar toggle UX checks

---

## Manual Functional Testing

### Licensing Flow

1. Start server: `cd server && npm run dev`
2. Open browser: `http://127.0.0.1:8787`
3. Test email sign-in flow:
  - enable `ENABLE_EMAIL_OTP=true` for the normal code-entry path
  - optionally enable `EXPOSE_DEV_OTP_CODE=true` for the faster local `dev_code` shortcut
  - for GitHub/Google local sign-in, keep `PUBLIC_BASE_URL`, `GITHUB_REDIRECT_URI`, `GOOGLE_REDIRECT_URI`, `CHECKOUT_SUCCESS_URL`, and `CHECKOUT_CANCEL_URL` on `http://127.0.0.1:8787` in `server/.env`
4. Check account summary loads after sign-in
5. Test trial activation from extension: `Narrate: Start Free Trial`

### Governance Flow

1. With server running, test EOD report submit:
   ```powershell
   .\pg.ps1 governance-login -ApiBase http://127.0.0.1:8787 -Email "test@example.com"
   ```
2. Submit an EOD report from the web portal (`/app`)
3. Create a mastermind thread, vote, and finalize

### Admin Board

1. Set your email in `ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS` in `.env`
2. Navigate to `http://127.0.0.1:8787/pg-global-admin/board/summary`
3. Verify admin routes require authentication

---

## CI/CD Testing

### GitHub Actions Workflows

Two workflows are prepared (push when your token has `workflow` scope):

| Workflow | File | Trigger | What It Does |
|---|---|---|---|
| Dependency Drift | `dependency-drift-weekly.yml` | Weekly schedule | `npm audit` + `npm outdated` for extension & server |
| Memory Bank Guard | `memory-bank-guard.yml` | Pull request | Validates Memory-bank docs are updated with code changes |

### Local CI Simulation

```powershell
# Simulate what CI would run:
cd extension && npm run compile && cd ..
cd server && npm run build && cd ..
.\pg.ps1 self-check -EnableDbIndexMaintenanceCheck -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `npm run compile` fails | Run `cd extension && npm install` first |
| `npm run build` fails | Run `cd server && npm install` first |
| DB connection refused | Check `DATABASE_URL` in `server/.env` or use `STORE_BACKEND=json` |
| Self-check DEP-REGISTRY-001 | Transient npm registry timeout — retry or rerun local/offline with `-SkipRegistryFetch` |
| Playwright tests timeout | Ensure server starts on port 8787 or set `PG_SMOKE_BASE_URL` |
| DB host unreachable during local strict check | Use `-AllowDbIndexConnectionWarning` only for local frontend evidence runs |
| Extension F5 won't launch | Ensure `npm run compile` succeeds first |
