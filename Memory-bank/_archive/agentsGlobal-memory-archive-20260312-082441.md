# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-12 08:24
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 36


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260312-065501.md` on 2026-03-12 06:55 UTC.

- Files touched: pgPush dead-code gate UX + help docs + memory docs

Summary:
- Added in-flow remediation to dead-code gate during PG Push:
  - strict/relaxed gate dialogs now include `Apply Safe Fixes + Recheck`.
  - gate reruns scan after safe fix command and reevaluates high-confidence count.
- Strict mode now allows remediation without exiting PG Push flow, but still blocks until high-confidence findings clear.
- Updated help troubleshooting to point users to `Apply Safe Fixes + Recheck` action.
- Verification:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/pgPush.ts`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 09:55 UTC] - codex
Scope:
- Components: codebase-tour-generator-baseline
- Files touched: new tour modules + extension/package/help wiring + memory docs

Summary:
- Added command `Narrate: Generate Codebase Tour`.
- Baseline output now includes:
  - likely entrypoints,
  - route/controller surface,
  - top directories/extensions,
  - external dependency hotspots,
  - internal coupling hotspots,
