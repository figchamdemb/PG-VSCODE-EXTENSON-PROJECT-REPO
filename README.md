# PG Extension Project

Local workspace for building the Narrate VS Code extension and licensing integration backend.

## Current implementation status

- `extension/` now contains Milestone 1-7 core:
  - reading mode virtual document (`narrate://`)
  - dev/edu mode commands
  - OpenAI-compatible narration provider (with local fallback)
  - JSON local cache
  - request-change prompt handoff
  - export commands (file + workspace)
  - git diff change report command
  - licensing backend mode:
    - email sign-in
    - GitHub sign-in (loopback OAuth callback)
    - redeem code apply
    - 48h trial start + auto trial on first Edu access
    - checkout command (`Upgrade Plan`) that opens browser Stripe checkout URL
    - license refresh/status
    - device management
    - project quota activate/status
  - provider-policy enforcement for configured LLM endpoint
- `server/` contains Milestone 5 + 6 + 7 core:
  - email auth + GitHub OAuth callbacks
  - entitlement activate/refresh/status token flow
  - install/device binding + plan device limits
  - project quota + idempotent project activation
  - refund request + admin refund approve
  - Stripe checkout session creation + signed webhook processing
  - offline payment refs + proof submit + admin approve/reject
  - redeem code issuance/apply
  - affiliate tracking + conversion + payout approval
  - team seat create/assign/revoke/status
  - team/user provider policy management
  - web marketing site (`/`) + secure portal app (`/app`) with:
    - email/GitHub/Google web sign-in
    - customer sidebar dashboard (overview, billing, support)
    - team owner/manager sidebar workspace (seat + policy controls)
    - super admin board (users, subscriptions, payments, support queue)
    - terms/privacy + checkout result pages

## Quick commands

```powershell
# start mandatory Memory-bank session
.\pg.ps1 start -Yes

# extension build
cd extension
npm install
npm run compile

# licensing backend
cd ..\server
npm install
npm run build
npm run dev
npm run smoke:web
npm run prisma:generate
npm run prisma:dbpush

# open marketing + secure portal
# http://127.0.0.1:8787/
# http://127.0.0.1:8787/app
```

CMD equivalents:

```bat
pg.cmd start -Yes
pg.cmd map-structure
pg.cmd status
```

Shell rule:
- PowerShell or `pwsh`: use `.\pg.ps1 ...`
- CMD: use `pg.cmd ...`

## First-Run Guides

- Root/shell-safe onboarding for new projects:
  - `docs/PG_FIRST_RUN_GUIDE.md`
- Local VSIX install + normal VS Code UI verification:
  - `docs/LOCAL_VSIX_INSTALL_AND_UI_TEST.md`

In extension host settings:

- `narrate.licensing.mode = backend`
- `narrate.licensing.apiBaseUrl = http://127.0.0.1:8787`

## Next target

Production hardening phase:

1. Service-layer migration from JSON store to Prisma client
2. Stripe production checkout/webhook rollout (price mapping + secret management)
3. GitHub OAuth app rollout (client credentials + redirect domains)
4. Security hardening (rate limits, audits, least-privilege credentials)
