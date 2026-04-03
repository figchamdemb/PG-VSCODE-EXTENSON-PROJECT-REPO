# Startup Workflow

Use this workflow in tools that support repo-local workflows or slash-style startup commands.

## Required Steps
1. Run `.\pg.ps1 start -Yes`
2. Read:
   - `Memory-bank/daily/LATEST.md`
   - the latest daily report referenced there
   - `Memory-bank/project-spec.md`
   - `Memory-bank/project-details.md`
   - `Memory-bank/structure-and-db.md`
   - recent `Memory-bank/agentsGlobal-memory.md` entries
   - `Memory-bank/tools-and-commands.md`
   - `Memory-bank/coding-security-standards.md`
   - open decisions in `Memory-bank/mastermind.md`
3. If startup fails, stop and report the failure before doing any other work.

## Notes
- This file is a workflow helper, not a replacement for repo hooks or self-check enforcement.
- If the tool does not support `.agents/workflows`, use `AGENTS.md`, `ANTIGRAVITY.md`, or `GEMINI.md` as the startup contract instead.
