# ENTERPRISE EXPANSION DRAFT (LOCAL-FIRST)

Status: draft (discussion-only, not committed to milestone yet)
Owner: product + engineering
Date: 2026-02-23

## Core Positioning
Local-first AI governance platform:
- Keep operational context local.
- Enforce must-do / must-not-do policies.
- Require human approvals for high-risk decisions.
- Keep execution and audit acknowledgments traceable.

## Primary Market (unchanged)
1. School/education and coding teams remain core.
2. Enterprise software teams remain core for paid growth.

## Adjacent Enterprise Verticals (low-cost entry)
1. Government service operations:
   - Permit/certificate processing checklists.
   - Supervisor approval gates before final issuance.
2. Legal operations:
   - Contract review checklists and escalation flow.
   - Mandatory clause compliance steps.
3. Healthcare administration:
   - Referral/triage SOP enforcement.
   - Team lead approval for exceptions.
4. Procurement/compliance:
   - Bid-comparison and policy checklist enforcement.
   - Manager sign-off before submission.

## Why It Fits African Market Constraints
1. Local-first mode supports unstable connectivity environments.
2. Governance + audit trail supports public-sector accountability.
3. Works on top of existing chat tools to avoid extra API costs.
4. Can run with strict data locality requirements.

## Cheap Product Gaps Worth Adding
1. Approval-to-action worker (auto execute after approved decision).
2. Decision acknowledgment visibility in Slack (`pending` -> `applied/conflict/skipped`).
3. Audit export package (decision, approver, executor, ack time, notes).
4. Industry policy packs with simple versioning (`v1`, `v1.1`).

## Live Service Monitor Agent (Draft)
Goal: same memory-governance model, but for runtime incidents.

1. Monitor inputs:
   - URL health checks and uptime.
   - Container/service health (`docker ps`, restart count, failing probes).
   - Log error spikes (application + reverse proxy).
2. Incident workflow:
   - Agent detects failure and creates incident report with evidence.
   - Report is posted to Slack department channel for approval.
   - Manager approves fix action via governance decision.
   - Local worker executes repair playbook, then reports result.
3. Safe execution policy:
   - No production push without approval.
   - Must run local smoke tests (and optional Playwright) before proposing push.
   - Every action must produce audit note + ack status.
4. Tiering suggestion:
   - Team: manual trigger + basic health checks + Slack alert.
   - Enterprise: continuous monitors + auto playbooks + richer audit exports.

## Live Monitor Implementation Blueprint (Discussion Draft)
1. Trigger sources:
   - `health_url` checks (HTTP status + latency threshold).
   - Docker status checks (`docker ps`, restart loops, unhealthy probes).
   - Log-trigger rules (error count spike in rolling window).
2. Incident packet (what the agent sends):
   - Incident ID, service name, environment, started_at.
   - Proof bundle: failing URLs, last N log lines, container health snapshot.
   - Proposed fix plan with risk score and rollback step.
3. Governance handshake:
   - Agent opens PG thread in Slack: options (`approve fix`, `needs change`, `reject/escalate`).
   - Team votes (optional) and manager finalizes.
   - Final decision is emitted as sync event for local worker.
4. Local execution model:
   - Worker receives decision via `sync/pull`.
   - Worker runs mapped repair command locally (safe allowlist only).
   - Worker runs smoke checks and optional Playwright check.
   - Worker acks result (`applied|conflict|skipped`) with logs/screenshots link.
5. Push policy:
   - Team tier: no auto-push; worker prepares patch + evidence only.
   - Enterprise Plus: optional guarded auto-push after successful checks + manager approval.

## Go-To-Market Cost Strategy
1. Default no-key mode: governance + memory + approval without forcing user API keys.
2. Reuse existing user chat subscriptions (Copilot/ChatGPT/Claude/Gemini/Cursor).
3. Optional PG managed AI pool with hard monthly caps.
4. BYOK as optional advanced mode only.

## Open Decisions (for debate)
1. First non-coding pilot vertical:
   - Option A: government service desk
   - Option B: legal aid / contract ops
   - Option C: healthcare administration
2. First pilot country/region target and compliance profile.
3. Minimum audit export format for procurement/government use.
