# Dashboard

LAST_UPDATED_UTC: 2026-03-19T16:15:45Z
UPDATED_BY: frontend-integration-script

## Page ID
- 02-dashboard

## Feature / Page Name
- Dashboard

## Owner
- role: unassigned
- agent_id: unassigned

## Status
- planned

## Backend Summary
Dashboard seed is based on the signed-in portal overview and account-summary routes. No OpenAPI or Postman refs were detected yet; start from the live backend route surface and captured responses.

## Frontend Summary
- pending frontend summary

## Endpoints
- GET /account/summary returns account, plan, quota, governance, team, and admin-access data for the signed-in user.
- GET /entitlement/status returns the signed entitlement claims for the active install.
- POST /devices/list returns the device records associated with the signed-in account.

## Auth Requirements
- Requires an active session cookie or bearer token from the login flow.
- Admin and team controls appear conditionally based on account summary permissions.

## Headers
- Authorization: Bearer <access_token> for direct API verification when not using the portal session cookie.

## Query Params
- none

## Request Payload Examples
- GET /account/summary with the session created by /auth/email/verify.
- GET /entitlement/status after sign-in to confirm plan and feature claims.

## Response Payload Examples
- /account/summary returns { "ok": true, "account": { "email": "..." }, "plan": "..." } plus quota, governance, team, and admin flags.
- /entitlement/status returns { "entitlement_token": "...", "claims": { ... } }.

## Error Payload Examples
- /account/summary returns 401 when the session or bearer token is missing.
- Protected dashboard actions should surface permission-based 401 or 403 responses when the signed-in account lacks access.

## DB Verification Proof
Account summary reads from users, subscriptions, trials, project_quotas, devices, team_memberships, and related admin-access records.

## Backend Smoke Proof
- status: pending
- note: Use the authenticated session created during smoke to validate the portal overview and summary payloads.

## Frontend Integration Instructions
After sign-in, verify the overview panel, profile header, and conditional nav state against /account/summary before marking the page ready.

## UI/UX Notes From Backend
Capture signed-out, loading, signed-in, team-enabled, and admin-enabled states for the overview shell.

## Frontend Smoke Proof
- playwright: pending
- route_mapping_confirmed: False

## Screenshot Paths
- none

## Known Blockers
- none

## Timestamps
- created_at_utc: 2026-03-17T18:54:05Z
- updated_at_utc: 2026-03-19T16:15:45Z
- ready_at_utc: pending
- completed_at_utc: pending

## Credentials / Test Accounts
- auth_mode: session-or-bearer
- required_secrets_present: False
- tested_successfully: False
- Authorization: Bearer <access_token> for direct API checks when bypassing the browser session.
- Use the same local email auth account created during the login smoke flow.
- For admin-nav coverage, sign in with a local email that is listed in SUPER_ADMIN_EMAILS or ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS.
- notes: Dashboard smoke depends on a successful login flow first.

## Developer Actions Required
- Complete the local login flow before validating dashboard and account-summary behavior.

## Frontend Findings For Backend
- none

## Backend Response To Frontend Findings
- none

## Return To Summary Instruction
After updating this page, return to Memory-bank/frontend-integration.md and refresh the summary status.

## Frontend Page Line-Count Check
- frontend_page_line_count: 0
- frontend_page_line_limit: 500

## Trust / Self-Check Validation Status
- trust_status: pending
- self_check_status: pending

## Source Refs
- none
