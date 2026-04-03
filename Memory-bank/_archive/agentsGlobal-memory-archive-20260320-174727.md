# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 17:47
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 23


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-172904.md` on 2026-03-20 17:29 UTC.

- `/payments/offline/submit-proof` now accepts `ref_code` alone and marks the record for manual review, while keeping `proof_url` nullable in storage for backward compatibility.

Validation:
- changed file diagnostics: PASS

Anchors:
- `server/public/app.html`
- `server/public/assets/site.js`
- `server/src/paymentsRoutes.ts`
- `server/tests/smoke.auth.spec.ts`

### [2026-03-20 20:10 UTC] - copilot
Scope:
- Components: memory-bank-enforcement-hardening, working-tree-guard, self-check-guard-bridge
- Files touched: guard/defaults/CI/self-check + smoke test stabilization

Summary:
- Confirmed the local Memory-bank enforcement gap: the guard defaulted to `warn`, inspected only staged files, and therefore did not reliably block agent tool edits before commit time.
- Switched the guard path to strict-by-default, added a `working-tree` scope to `memory_bank_guard.py`, changed hook installers and CI defaults to `strict`, and wired `pg self-check` to run the Memory-bank guard against working-tree changes after summary generation.
- Stabilized the auth smoke test by replacing the flaky focus assertion with a keyboard-type assertion that still proves the auth card click routes typing into `#emailInput`.
