# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-13 02:01
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 51


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260313-002755.md` on 2026-03-13 00:27 UTC.

  - `narrate.apiContract.maxFiles`
  - `narrate.apiContract.includeGlob`
  - `narrate.apiContract.excludeGlob`
- Kept implementation split into small modules to satisfy file-size standards.
- Verification:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/runApiContractValidator.ts`
- `extension/src/commands/apiContractAnalyzer.ts`
- `extension/src/commands/apiContractCodeScan.ts`
- `extension/src/commands/apiContractOpenApi.ts`
- `extension/src/commands/apiContractCompare.ts`
- `extension/src/commands/apiContractReport.ts`
- `extension/src/commands/apiContractPath.ts`
- `extension/src/commands/apiContractTypes.ts`
- `extension/src/extension.ts`
- `extension/package.json`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 10:34 UTC] - codex
Scope:
- Components: api-validator-ux-alias-and-handoff
- Files touched: validator command wiring + package/help + memory docs

Summary:
- Added simplified command alias `Narrate: OpenAPI Check` (`narrate.openApiCheck`) that runs the full API contract validator.
- Added handoff command `Narrate: OpenAPI Fix Handoff Prompt` (`narrate.openApiFixHandoff`).
- Handoff flow now:
  1. runs API validator,
  2. builds structured mismatch brief,
  3. copies prompt to clipboard,
  4. opens prompt doc for immediate Codex/LLM use.
- Keeps existing detailed command (`Narrate: Run API Contract Validator`) as canonical path.
- Verification:
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `extension/src/commands/runApiContractValidator.ts`
- `extension/src/commands/apiContractHandoffPrompt.ts`
- `extension/package.json`
