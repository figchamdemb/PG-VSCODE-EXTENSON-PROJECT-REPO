# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-11 08:33
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 42


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260308-025238.md` on 2026-03-08 02:52 UTC.

  - gate blocks only on high-confidence findings (TypeScript unused diagnostics).
  - medium/low orphan heuristics remain report-only and non-blocking.
  - relaxed mode allows `Continue Push` with optional `Open Dead Code Report` action.
  - strict mode blocks push and offers report-open action.
- Updated help guidance and troubleshooting for dead-code gate behavior.
- Verification:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/runDeadCodeScan.ts`
- `extension/src/commands/pgPush.ts`
- `extension/package.json`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 07:52 UTC] - codex
Scope:
- Components: repo-profile-dead-code-gate-default
- Files touched: workspace settings + memory docs

Summary:
- Set repository workspace default `narrate.deadCodeScan.pgPushGateMode` to `strict` in `.vscode/settings.json`.
- This keeps global extension defaults unchanged while enforcing strict dead-code push policy for this repo.
- Relaxed fallback remains available via workspace setting override.
- Verified after change:
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `.vscode/settings.json`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/mastermind.md`
