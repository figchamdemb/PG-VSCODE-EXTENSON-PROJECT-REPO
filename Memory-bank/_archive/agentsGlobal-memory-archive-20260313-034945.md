# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-13 03:49
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 41


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260313-032759.md` on 2026-03-13 03:27 UTC.

- `server/package-lock.json`

### [2026-02-27 12:18 UTC] - codex
Scope:
- Components: playwright-smoke-gate-cli-integration
- Files touched: pg command router + prod gate runner + new Playwright script + memory docs

Summary:
- Added local Playwright smoke command bridge:
  - `pg playwright-smoke-check`
  - `pg ui-smoke-check`
- Added new script `scripts/playwright_smoke_check.ps1` with fail-closed behavior:
  - blocks when Playwright config/dependency/tests are missing,
  - runs `@smoke` tagged tests when available, otherwise runs full Playwright suite.
- Added optional production gate wiring:
  - `pg prod -EnablePlaywrightSmokeCheck`
  - supports optional `-PlaywrightWorkingDirectory` and `-PlaywrightConfigPath`.
- Verification:
  - `./pg.ps1 help` PASS (new commands/flags listed)
  - `./pg.ps1 narrate-check -SkipCompile` PASS
  - `./pg.ps1 playwright-smoke-check` returns blocker when Playwright is not configured (expected fail-closed behavior).

Anchors:
- `scripts/playwright_smoke_check.ps1`
- `scripts/pg.ps1`
- `scripts/pg_prod.ps1`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 00:44 UTC] - codex
Scope:
- Components: db-index-remediation-plan-command
- Files touched: DB maintenance scripts + pg router + memory docs

Summary:
