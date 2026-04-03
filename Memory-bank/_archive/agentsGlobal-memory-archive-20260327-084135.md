# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-27 08:41
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 44


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-235259.md` on 2026-03-20 23:52 UTC.

- `server/src/prismaStore.ts`
- `server/src/codingStandardsVerification.ts`
- `server/src/codingStandardsQueryOptimization.ts`

### [2026-02-28 05:24 UTC] - codex
Scope:
- Components: security-log-injection-hardening
- Files touched: server/extension logging modules + runtime server logger call sites

Summary:
- Added centralized log sanitization to reduce log-injection/log-forgery risk from untrusted input.
- Server changes:
  - added `server/src/logSanitization.ts` (control-character/newline neutralization, truncation, recursive metadata sanitization).
  - replaced direct `app.log.info/warn/error` usage in `server/src/index.ts` with safe wrappers that sanitize message + context.
  - bootstrap fallback `console.error` now outputs sanitized payload.
- Extension changes:
  - added `extension/src/utils/logSanitization.ts`.
  - updated `extension/src/utils/logger.ts` to sanitize all OutputChannel lines.

Validation:
- `npm run build` (server): PASS
- `npm run compile` (extension): PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: FAIL (runtime dependency verify could not connect to local policy API `127.0.0.1:8787` in this environment)

Anchors:
- `server/src/logSanitization.ts`
- `server/src/index.ts`
- `extension/src/utils/logSanitization.ts`
- `extension/src/utils/logger.ts`

### [2026-02-28 05:46 UTC] - codex
Scope:
- Components: coding-policy-log-safety-enforcement
- Files touched: server coding standards policy modules + memory docs

Summary:
- Added coding-policy-level log safety checks so production gates catch unsafe logging usage.
- New module `server/src/codingStandardsLogSafety.ts` blocks:
  - direct `console.*` logging,
  - direct runtime `app/request/reply.log.*` calls,
  when sanitization wrappers/signals are not used.
