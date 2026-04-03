# Coding & Security Standards

LAST_UPDATED_UTC: 2026-03-15 18:56
UPDATED_BY: codex

## Code Size Limits (Mandatory)
- Screen/Page files (mobile + web): max 500 lines.
- Preferred range for screen/page files: 100-450 lines.
- If a screen/page exceeds 500 lines:
  - split UI sections/components
  - move business logic to services/helpers/viewmodels
  - keep navigation shell thin

## Frontend Design Guardrails (Mandatory For UI Tasks)
- Read `docs/FRONTEND_DESIGN_GUARDRAILS.md` before changing app/web/dashboard/mobile UI.
- If the user supplies a design guide, screenshot, prompt, or visual reference, that user-provided source overrides the repo default guide.
- This policy also applies to Kotlin/Jetpack Compose and React-based mobile surfaces.
- Match similar patterns, not copied screens:
  - preserve hierarchy, edges/radii rhythm, button/dropdown treatment, section grouping, and dashboard flow
  - do not clone another product or reference one-to-one unless the user explicitly asks for that
- For React, React Native, and Kotlin/Compose work, translate the pattern grammar natively instead of copying HTML/Tailwind literally.
- Keep major UI surfaces in one product family:
  - shared tokens
  - shared button hierarchy
  - shared card/panel grammar
  - shared responsive shell behavior
- For secure mobile/authenticator work, follow the guide's mobile secure-app patterns and button grammar:
  - state-led hero/status card
  - dominant primary CTA
  - explicit secondary/destructive/fab/nav variants
  - choose the closest approved pattern family for the surface instead of forcing every screen to reuse every secure-mobile motif
- Reuse the approved button pattern grammar for primary, secondary, ghost, destructive, floating, and bottom-nav actions instead of inventing a new button family per screen.
- Prefer shared CSS variables/classes and semantic layout/control names over heavy inline styling.
- Major operational pages should use structured shells, cards/panels, and grouped actions rather than flat stacks of controls.

## Backend Engineering Baseline
- Prefer small services/controllers with clear single responsibility.
- Validate all external input.
- Use structured logging and predictable error mapping.
- Keep auth/authorization checks explicit and centralized.
- Do not hardcode credentials, secrets, keys, or private endpoints.
- For NestJS:
  - do not over-engineer modules; keep feature modules narrow and avoid piling unrelated imports/providers/controllers into one module
  - reuse existing service/helper/module logic before creating another same-purpose block unless a real separation boundary is needed
  - use meaningful module names; avoid placeholder/generic names for NestJS modules

## Security Baseline
- Use strong key algorithms for signing/encryption (RSA/ECDSA as applicable).
- Keep private keys in env/vault/KMS only.
- Use least-privilege DB and service credentials.
- Ensure TLS for service-to-service and client transport.
- Never commit secrets, credentials, tokens, private keys, or client secrets in source code.
- **100% enforcement secret-leak guard** (`scripts/secrets_guard.py`):
  - Runs on EVERY staged file at both pre-commit and pre-push.
  - ALWAYS blocks — ignores warn/strict mode, cannot be bypassed.
  - Detects: password/token assignments, PEM private keys, AWS keys, Stripe secret keys, GitHub/GitLab tokens, database URLs with passwords, bearer tokens, Slack/SendGrid/npm tokens, long hex secrets.
  - Fix: move secrets to `.env` (gitignored), vault, or KMS.
- Keep dependency versions patched and reviewed.
- Do not auto-upgrade dependency major versions from freshness warnings alone.
- If dependency verification reports freshness/maintenance warnings (for example `DEP-FRESHNESS-*`), review official vendor docs, release notes, changelog, and compatibility guidance before proposing or applying version changes.

## Maintainability Rules
- New code should be modular, testable, and easy to review.
- Prefer reuse over duplication.
- Reject giant files when refactoring is feasible.

## Team Decision Process (Mastermind)
- Record architectural debates in `mastermind.md`.
- Capture options, risks, and final ruling.
- If reviewers disagree, document votes and rationale; implement winning decision.
