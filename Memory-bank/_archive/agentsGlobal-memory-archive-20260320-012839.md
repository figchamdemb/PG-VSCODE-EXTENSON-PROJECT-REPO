# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 01:28
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 25


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-001758.md` on 2026-03-20 00:17 UTC.

### [2026-03-20 01:24 UTC] - copilot
Scope:
- Components: cmd-shell-doc-consistency, wrapper-guidance
- Files touched: README, first-run guide, root wrapper message, memory docs

Summary:
- Finished the remaining user-facing shell guidance pass.
- Updated README and `docs/PG_FIRST_RUN_GUIDE.md` so CMD examples now use `pg.cmd ...` instead of asking users to manually wrap `.ps1` commands with PowerShell.
- Updated the root `pg.ps1` wrong-folder message so the CMD remediation path points to `pg.cmd help`.
- Left the agent-policy/startup files PowerShell-first because those are workflow-enforcement instructions rather than end-user shell quickstarts.

Validation:
- `.\pg.ps1 stop-enforcement`: PASS
- `.\pg.ps1 resume-enforcement`: PASS
- `python scripts/build_frontend_summary.py`: PASS
- `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`: PASS

Anchors:
- `README.md`
- `docs/PG_FIRST_RUN_GUIDE.md`
- `pg.ps1`
