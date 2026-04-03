# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-07 22:14
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 31


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260307-205117.md` on 2026-03-07 20:51 UTC.

  - `narrate.trustScore.workspaceScanIncludeGlob`
  - `narrate.trustScore.workspaceScanExcludeGlob`
- Added Trust panel title action and command-help references for workspace scan.
- Verification:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/runTrustWorkspaceScan.ts`
- `extension/src/trust/trustScoreService.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 10:52 UTC] - codex
Scope:
- Components: api-validator-openapi-parser-upgrade
- Files touched: OpenAPI parser + extension dependencies + memory docs

Summary:
- Upgraded API contract OpenAPI extraction to support both JSON and YAML specs.
- Added local schema ref resolution for `#/components/schemas/*` with loop protection to avoid recursive ref hangs.
- Kept current command surface and mismatch rule IDs unchanged.
