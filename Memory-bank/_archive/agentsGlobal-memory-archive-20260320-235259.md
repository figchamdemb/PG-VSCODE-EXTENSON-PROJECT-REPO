# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 23:52
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 24


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-225647.md` on 2026-03-20 22:56 UTC.

- `Memory-bank/daily/2026-03-17.md`
- `Memory-bank/daily/LATEST.md`
- Files touched: extension git/llm parsers, server prisma/coding-policy modules, memory docs

Summary:
- Reduced hard coding blockers with no-behavior-change helper refactors in extension and server runtime paths.
- Split oversized hard-blocker functions in:
  - `extension/src/git/diffParser.ts` (`parseUnifiedDiff`),
  - `extension/src/llm/openAICompatibleProvider.ts` (`narrateLines`),
  - `server/src/prismaStore.ts` (`ensureTables`).
- Removed server coding-policy file-size blocker by extracting query/index checks from `server/src/codingStandardsVerification.ts` into new module `server/src/codingStandardsQueryOptimization.ts`.
- Validation status after batch: coding hard blockers reduced `12 -> 10` on warn-mode self-check.

Validation:
- `npm run compile` (extension): PASS
- `npm run build` (server): PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS in warn mode (blocked findings reported)

Anchors:
- `extension/src/git/diffParser.ts`
- `extension/src/llm/openAICompatibleProvider.ts`
