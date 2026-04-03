# Login

LAST_UPDATED_UTC: 2026-03-19T16:15:45Z
UPDATED_BY: frontend-integration-script

## Page ID
- 01-auth-login

## Feature / Page Name
- Login

## Owner
- role: backend
- agent_id: backend-copilot-gpt-5-4-main

## Status
- ready_for_frontend

## Backend Summary
Backend auth path documented

## Frontend Summary
- pending frontend summary

## Endpoints
- POST /auth/email/start issues a login code for the submitted email address.
- POST /auth/email/verify exchanges email, code, and install_id for a session token.
- POST /auth/session/signout expires the current session token and clears the local sign-in state.

## Auth Requirements
- Enable ENABLE_EMAIL_OTP=true for local email-login verification.
- Enable EXPOSE_DEV_OTP_CODE=true only when you need the local dev_code shortcut for smoke or manual testing.
- GitHub and Google sign-in still require provider credentials and callback configuration.

## Headers
- Content-Type: application/json for email start and verify requests.

## Query Params
- none

## Request Payload Examples
- POST /auth/email/start -> { "email": "smoke-auth@example.com" }
- POST /auth/email/verify -> { "email": "smoke-auth@example.com", "code": "123456", "install_id": "web-smoke-auth" }

## Response Payload Examples
- /auth/email/start returns { "status": "code_sent", "email": "...", "expires_at": "..." } and optional dev_code in local smoke mode.
- /auth/email/verify returns { "access_token": "...", "expires_in_sec": ..., "user_id": "..." }.

## Error Payload Examples
- /auth/email/start returns 400 when email is missing.
- /auth/email/verify returns 400 for missing or expired codes and 401 for invalid codes.

## DB Verification Proof
Auth challenges are stored in auth_challenges; successful verification creates a sessions record and updates users.last_login_at.

## Backend Smoke Proof
- status: pass
- note: Mandatory Playwright smoke now covers the local portal email-auth flow on the dedicated smoke server.

## Frontend Integration Instructions
Use the shared login flow and the published test account before frontend smoke.

## UI/UX Notes From Backend
Keep distinct send-code, verify-code, signed-in, invalid-code, and expired-code states visible to the developer and user.

## Frontend Smoke Proof
- playwright: pending
- route_mapping_confirmed: False

## Screenshot Paths
- none

## Known Blockers
- Validation example for structured frontend-to-backend correction routing.

## Timestamps
- created_at_utc: 2026-03-17T18:54:05Z
- updated_at_utc: 2026-03-19T16:15:45Z
- ready_at_utc: 2026-03-17T18:55:18Z
- completed_at_utc: pending

## Credentials / Test Accounts
- auth_mode: email-otp|oauth
- required_secrets_present: False
- tested_successfully: False
- none
- Use any local test email for the baseline auth smoke flow.
- Use an email listed in SUPER_ADMIN_EMAILS or ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS when admin access also needs validation.
- notes: Local smoke does not require external mail delivery when dev_code exposure is enabled.

## Developer Actions Required
- Set ENABLE_EMAIL_OTP=true in server/.env before local auth verification.
- Enable EXPOSE_DEV_OTP_CODE=true only for local-only shortcut testing when needed.

## Frontend Findings For Backend
- Sample finding (kind=backend-missing, status=open, time=2026-03-17T18:55:21Z)
  details: Validation example for structured frontend-to-backend correction routing.

## Backend Response To Frontend Findings
- Sample response (status=closed, resolution=fixed, time=2026-03-17T18:55:24Z)
  details: Backend reviewed the finding and returned the step to ready_for_frontend.

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
