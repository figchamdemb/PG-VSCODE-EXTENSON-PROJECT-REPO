# Coding & Security Standards

LAST_UPDATED_UTC: 2026-02-19 21:43
UPDATED_BY: mb-init

## Code Size Limits (Mandatory)
- Screen/Page files (mobile + web): max 500 lines.
- Preferred range for screen/page files: 100-450 lines.
- If a screen/page exceeds 500 lines:
  - split UI sections/components
  - move business logic to services/helpers/viewmodels
  - keep navigation shell thin

## Backend Engineering Baseline
- Prefer small services/controllers with clear single responsibility.
- Validate all external input.
- Use structured logging and predictable error mapping.
- Keep auth/authorization checks explicit and centralized.
- Do not hardcode credentials, secrets, keys, or private endpoints.

## Security Baseline
- Use strong key algorithms for signing/encryption (RSA/ECDSA as applicable).
- Keep private keys in env/vault/KMS only.
- Use least-privilege DB and service credentials.
- Ensure TLS for service-to-service and client transport.
- Keep dependency versions patched and reviewed.

## Maintainability Rules
- New code should be modular, testable, and easy to review.
- Prefer reuse over duplication.
- Reject giant files when refactoring is feasible.

## Team Decision Process (Mastermind)
- Record architectural debates in `mastermind.md`.
- Capture options, risks, and final ruling.
- If reviewers disagree, document votes and rationale; implement winning decision.