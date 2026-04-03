# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-16 00:50
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 38


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260315-235903.md` on 2026-03-15 23:59 UTC.

- Validation:
  - `./pg.ps1 help` PASS
  - `./pg.ps1 login -AccessToken ...` PASS
  - `./pg.ps1 update` PASS
  - `./pg.ps1 doctor` PASS (`blockers: 0`, expected local warnings only)
  - `npm run compile` (extension) PASS
  - `./pg.ps1 narrate-check -SkipCompile` PASS

Anchors:
- `scripts/pg_lifecycle.ps1`
- `scripts/pg.ps1`
- `.gitignore`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`
- `Memory-bank/code-tree/memory-bank-tooling-tree.md`

### [2026-02-27 18:20 UTC] - codex
Scope:
- Components: milestone-13e-mcp-cloud-scoring-bridge-baseline
- Files touched: server cloud scorer + CLI bridge + help/docs/memory sync

Summary:
- Continued Milestone 13E and integrated secure cloud architecture rulepack into MCP scoring path.
- Server-side scorer updates:
  - expanded cloud control rule coverage (network, secrets, IAM, monitoring, DR, WAF/rate-limit, IMDSv2, exposure controls, CI secret scanning, alerting, multi-AZ signal).
  - added sensitivity-aware control behavior:
    - `regulated` applies strict blocker behavior for critical failed controls.
    - `standard` applies recommended warning-only checks for baseline controls.
  - added provider-context missing warning and regulated low-budget blocker guard (`<250 USD`).
- CLI bridge updates:
  - added new `mcp-cloud-score` control flags for expanded cloud evidence submission:
