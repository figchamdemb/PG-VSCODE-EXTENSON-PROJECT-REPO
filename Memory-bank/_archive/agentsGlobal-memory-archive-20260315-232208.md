# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-15 23:22
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 34


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260315-185744.md` on 2026-03-15 18:57 UTC.

    - latest: `command-diagnostics-latest.md` + `command-diagnostics-latest.json`
    - timestamped snapshots: `command-diagnostics-<UTC>.md/.json`
- Added completion quick actions in diagnostics toast:
  - open latest report
  - reveal diagnostics folder
  - copy latest report path to clipboard
- Refactored diagnostics command orchestration into smaller helpers to keep handler flow maintainable.
- Updated help/documentation so users can self-serve diagnostics handoff without chat support.
- Validation:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/runCommandDiagnostics.ts`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/daily/2026-02-27.md`

### [2026-02-27 16:40 UTC] - codex
Scope:
- Components: pg-prod-rollout-defaults-profile-mode
- Files touched: prod scripts + help surface + memory docs

Summary:
- Completed Milestone 13D remaining rollout-defaults gap for `pg prod`.
- Added profile-driven defaults in `scripts/pg_prod.ps1`:
  - `-ProdProfile legacy` => dependency + coding only
  - `-ProdProfile standard` (default) => dependency + coding + API contract + DB index maintenance
