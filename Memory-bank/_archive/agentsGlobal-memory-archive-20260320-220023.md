# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 22:00
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 23


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-212738.md` on 2026-03-20 21:27 UTC.

- `scripts/pg.ps1`
- `server/src/integrationOrchestrationRoutes.ts`
- `server/src/integrationOrchestrationSupport.ts`
- `server/src/types.ts`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`

### [2026-03-19 17:05 UTC] - copilot
Scope:
- Components: mandatory-workspace-enforcement, fail-closed-startup-state, local-stop-resume-controls
- Files touched: extension startup/governance/workflow commands, manifest, memory docs

Summary:
- Changed Narrate startup enforcement from context-best-effort to persistent local mandatory state per workspace.
- A workspace now stays in enforced mode across restart until the user explicitly stops it.
- Root `AGENTS.md` or `Memory-bank/` evidence now keeps the workspace fail-closed locally even when `pg.ps1` or the normal startup context has gone missing.
- Added explicit local commands to stop or resume workspace enforcement and wired guarded save/workflow commands through the same readiness check.
