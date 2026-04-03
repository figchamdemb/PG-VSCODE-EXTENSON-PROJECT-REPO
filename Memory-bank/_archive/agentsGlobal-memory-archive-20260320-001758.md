# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 00:17
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 23


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260319-213323.md` on 2026-03-19 21:33 UTC.

### [2026-03-19 22:20 UTC] - copilot
Scope:
- Components: shell-command-clarity, cmd-wrapper-guidance
- Files touched: pg help surface, memory docs

Summary:
- Clarified that the repo already supports both shells, but through different entrypoints.
- PowerShell and `pwsh` should use `.\pg.ps1 ...`.
- Plain CMD should use `pg.cmd ...`, including `pg.cmd stop-enforcement` and `pg.cmd resume-enforcement`.
- Updated the help output and command guide so users no longer need to guess which shell syntax to use.

Validation:
- `.\pg.ps1 stop-enforcement`: PASS
- `.\pg.ps1 resume-enforcement`: PASS

Anchors:
- `pg.cmd`
- `scripts/pg.ps1`
- `Memory-bank/tools-and-commands.md`
