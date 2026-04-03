# PG Review Workflow

LAST_UPDATED_UTC: 2026-03-20T04:11:31Z
UPDATED_BY: copilot

## Orchestration Mode
- mode: server-backed
- local_detail_mode: redacted
- worker_lease_expires_at: 20/03/2026 04:13:26

## Workflow
- Status: active
- Current page: 04-direct-live-server-review-20260320-032420
- Next actor: none
- Open findings: 1

## Roles
- builder: status=active heartbeat=20/03/2026 03:25:00 agent=builder-copilot-gpt-5-4
- reviewer: status=active heartbeat=20/03/2026 03:25:07 agent=reviewer-copilot-gpt-5-4

## Review Pages
- 01-review-workflow-baseline | status=changes_requested | next=builder | file=Memory-bank/review-workflow/pages/01-review-workflow-baseline.md
- 02-live-auth-review-smoke-20260320-032031 | status=approved | next=none | file=Memory-bank/review-workflow/pages/02-live-auth-review-smoke-20260320-032031.md
- 03-direct-live-review-json-check | status=builder_in_progress | next=builder | file=Memory-bank/review-workflow/pages/03-direct-live-review-json-check.md
- 04-direct-live-server-review-20260320-032420 | status=approved | next=none | file=Memory-bank/review-workflow/pages/04-direct-live-server-review-20260320-032420.md

## Commands
- .\pg.ps1 review-builder-start -Persistent
- .\pg.ps1 review-reviewer-start -Persistent
- .\pg.ps1 review-report -PageId PAGE_ID -Title finding -Kind medium -Details evidence
- .\pg.ps1 review-respond -PageId PAGE_ID -Resolution fixed -Details patch-and-validation
- .\pg.ps1 review-approve -PageId PAGE_ID -Details verified
