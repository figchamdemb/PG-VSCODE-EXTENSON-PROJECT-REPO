# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-15 23:57
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 38


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260315-232338.md` on 2026-03-15 23:23 UTC.

- Updated command routing/help:
  - `scripts/pg.ps1` now accepts and forwards `-ProdProfile`.
  - `pg help` now prints profile defaults with short command examples.
  - Help Center quickstart now includes `pg prod` standard/strict usage rows.
- Updated milestone/docs to mark Milestone 13D rollout defaults as completed.
- Validation:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 help` PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `scripts/pg_prod.ps1`
- `scripts/pg.ps1`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/mastermind.md`
- `Memory-bank/daily/2026-02-27.md`

### [2026-02-27 17:10 UTC] - codex
Scope:
- Components: milestone-13c-pg-cli-lifecycle
- Files touched: pg router/help, new lifecycle script, help/docs/memory sync

Summary:
- Added PG CLI lifecycle baseline commands:
  - `pg login` (auth bootstrap + entitlement summary sync)
  - `pg update` (refresh token-backed entitlement/profile snapshot)
  - `pg doctor` (PATH/auth/toolchain/dev-profile diagnostics with blocker/warning IDs)
- Added lifecycle state file `Memory-bank/_generated/pg-cli-state.json` (gitignored) and synced `pg_cli_*` keys into local dev profile.
- Added entitlement-aware prod-profile handoff:
  - router now auto-resolves `pg prod` profile from lifecycle `recommended_prod_profile` when `-ProdProfile` is omitted.
  - explicit `-ProdProfile` still overrides.
