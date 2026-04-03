# PG Review Workflow Proposal

LAST_UPDATED_UTC: 2026-03-20 04:07
UPDATED_BY: copilot
STATUS: phase-2-secure-server-backed-implemented
REQ: REQ-2026-03-20-01, REQ-2026-03-20-02

## Current Status

Phase 1 local baseline and the secure server-backed phase are now implemented.

Post-implementation validation/fix follow-up is also now complete:

1. live authenticated review flow has been exercised successfully in `mode=server`
2. saved CLI state now auto-engages server mode on the normal `./pg.ps1 review-*` path
3. a regression check now guards the state-file helper-order bug and the null-path markdown rendering case

Shipped command surface:

1. `./pg.ps1 review-init`
2. `./pg.ps1 review-builder-start`
3. `./pg.ps1 review-reviewer-start`
4. `./pg.ps1 review-status`
5. `./pg.ps1 review-summary`
6. `./pg.ps1 review-report`
7. `./pg.ps1 review-respond`
8. `./pg.ps1 review-approve`
9. `./pg.ps1 review-stop`
10. `./pg.ps1 review-end`
11. `./pg.ps1 review-open-page`

Shipped local artifacts:

1. `Memory-bank/review-workflow.md`
2. `Memory-bank/review-workflow/state.json`
3. `Memory-bank/review-workflow/pages/*.md`
4. `Memory-bank/_generated/review-workflow-runtime.json`
5. `scripts/review_workflow_regression_check.ps1`

Shipped secure/server-backed expansion:

1. `/account/review/orchestration/state`
2. `/account/review/orchestration/init`
3. `/account/review/orchestration/sync`
4. `/account/review/orchestration/audit`
5. entitlement gate for secure review workflow access
6. rotating worker lease on authenticated review sync
7. redacted local review projection in authenticated mode
8. DPAPI-protected local runtime control envelope
9. paid customer-visible pricing/help copy for secure review workflow

Still deferred:

1. final-review role
2. automatic reviewer assignment policy

## Purpose

Define a PG-native review workflow where a `builder` worker and a `reviewer` worker coordinate through the same heartbeat-driven worker model already used by the frontend/backend integration system, with local-first fallback and secure server-backed orchestration when authenticated.

The design goal is simple:

1. the developer starts the work once
2. the builder writes and validates
3. the reviewer checks and reports findings
4. the builder patches and replies
5. both sides communicate only through PG review files and runtime state

This avoids mixing implementation and review in one chat loop and keeps the review trail structured, repeatable, and automatable.

## Recommendation

Implement this in two phases.

### Phase 1

Local-only baseline.

Use the same proven shape as frontend/backend integration:

1. summary dashboard markdown
2. per-task review page markdown
3. machine-readable runtime state file
4. persistent worker heartbeat with stop/end control

### Phase 2

Secure hardened expansion.

This phase is now implemented for the server-backed mirror, entitlement gate, rotating worker lease, and redacted local projection.

Remaining later items:

1. reviewer assignment policy
2. optional `final-review` role

## Core Model

### Roles

1. `builder`
   - writes code
   - runs compile/test/self-check
   - posts review-ready state
   - answers findings and patches issues

2. `reviewer`
   - reads the latest builder output
   - writes structured findings, references, and verdicts
   - does not directly edit the builder's implementation code

Optional later:

3. `final-review`
   - checks closure quality only
   - verifies no unresolved findings remain before approval

## Workflow

Round-based loop:

1. builder claims the review task
2. builder implements a batch
3. builder runs validation
4. builder publishes review-ready evidence
5. reviewer heartbeat wakes up
6. reviewer reads the updated review state/page
7. reviewer writes findings or approval
8. builder heartbeat wakes up
9. builder patches and re-tests
10. builder replies per finding
11. reviewer re-verifies
12. workflow ends when reviewer marks the task approved or blocked on human action

## Shared Surfaces

### 1. Summary dashboard

Recommended path:

`Memory-bank/review-workflow.md`

Purpose:

1. show current task
2. show active builder/reviewer identities
3. show current round
4. show open findings count
5. show latest verdict and activity timestamps
6. link to task pages

### 2. Review pages

Recommended folder:

`Memory-bank/review-workflow/pages/`

Examples:

1. `01-task-routing-fix.md`
2. `02-auth-audit-cleanup.md`
3. `03-extension-startup-guard.md`

Each page holds the actual discussion, but in structured PG form:

1. task scope
2. files changed
3. validation evidence
4. reviewer findings
5. builder replies
6. reviewer verdict updates

### 3. Runtime state

Recommended file:

`Memory-bank/review-workflow/state.json`

Purpose:

1. active roles
2. heartbeats
3. current round
4. page/task status
5. next actor to act
6. stale-worker detection

### 4. Runtime control file

Recommended generated file:

`Memory-bank/_generated/review-workflow-runtime.json`

Purpose:

1. stop/end control only
2. persistent worker lifecycle signals
3. same minimal control pattern as frontend integration runtime

## Structured Finding Model

Each finding should be structured, not free-form only.

Recommended fields:

1. `finding_id`
2. `status`
3. `severity`
4. `title`
5. `file`
6. `line`
7. `evidence`
8. `expected_fix`
9. `builder_reply`
10. `reviewer_verdict`
11. `round`

Recommended statuses:

1. `open`
2. `needs_fix`
3. `builder_replied`
4. `verified`
5. `blocked`
6. `requires_human`

## Heartbeat Logic

Use the same local-first heartbeat logic already proven by frontend/backend integration.

Suggested defaults:

1. builder heartbeat: 30 to 60 seconds
2. reviewer heartbeat: 30 to 60 seconds
3. reviewer may use a slight initial delay so builder can post the first evidence batch

Worker rules:

1. builder acts when the task is `ready_for_review` or when reviewer status becomes `needs_fix`
2. reviewer acts when builder status becomes `ready_for_review` or `builder_replied`
3. stale heartbeat marks a role inactive instead of silently assuming it is still working
4. stop/end control uses the same next-heartbeat exit pattern as integration workers

## Role Boundary Rules

1. reviewer must not patch builder-owned implementation code directly
2. builder must not self-approve
3. all findings must carry file references and evidence
4. all builder replies must include validation evidence when a fix claim is made
5. approval requires a clean current validation snapshot for the task batch
6. both roles may update the review ledger and runtime state, but only through their own role actions

## Recommended Commands

Friendly role-specific commands:

1. `pg review-init`
2. `pg review-builder-start`
3. `pg review-reviewer-start`
4. `pg review-status`
5. `pg review-report`
6. `pg review-respond`
7. `pg review-approve`
8. `pg review-stop`
9. `pg review-end`

Internal engine recommendation:

Use the same generic worker infrastructure shape as integration, even if the public commands stay role-friendly.

Possible internal routing model:

1. `pg worker-start -Workflow review -Role builder`
2. `pg worker-start -Workflow review -Role reviewer`

## Minimal First Implementation

Start small.

Recommended baseline scope:

1. local-only workflow
2. two roles: builder + reviewer
3. summary markdown
4. per-task review pages
5. runtime state JSON
6. stop/end runtime control file
7. commands for init, start, status, report, respond, approve, stop, end

Do not include yet:

1. server-backed orchestration mirror
2. entitlement gates
3. final-review role
4. automatic reviewer assignment policy

## Reuse Strategy

Do not build a separate worker system from scratch.

Reuse from the frontend/backend integration workflow:

1. heartbeat loop shape
2. runtime control file pattern
3. summary/page/state split
4. stop/end semantics
5. role heartbeat freshness policy

This reduces risk and keeps PG workflow behavior consistent across domains.

## Why This Is Worth Building

This solves the exact operating model the user described:

1. the developer starts the role once
2. local heartbeats keep the work moving
3. builder and reviewer communicate only through PG workflow state
4. findings and replies are structured and reviewable later
5. the review cycle becomes reproducible instead of conversationally fragile

## Recommended Next Step

After approving this proposal, implement the local-only baseline first:

1. scaffold `Memory-bank/review-workflow*`
2. add `review-init`
3. add `review-builder-start`
4. add `review-reviewer-start`
5. add `review-status`
6. add `review-report`
7. add `review-respond`
8. add `review-approve`
9. add `review-stop`
10. add `review-end`