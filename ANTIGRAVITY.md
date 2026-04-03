# Antigravity Repo Instructions

## CRITICAL STARTUP OVERRIDE
Before you analyze the user's request, write code, or reply with an implementation plan, you must complete this startup sequence:
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
3. If any startup step fails, stop and report that failure before doing other work.

Do not treat startup as a suggestion or a later checklist item.

## Primary Policy
Follow repository policy from `AGENTS.md`.

## End Of Session
After coding:
- Update matching Memory-bank docs.
- Append `Memory-bank/agentsGlobal-memory.md`.
- Update today's `Memory-bank/daily/YYYY-MM-DD.md`.
- Update `Memory-bank/daily/LATEST.md`.
- If migration files changed, update `Memory-bank/db-schema/*.md`.

## Enforcement
- local: `.githooks/pre-commit` -> `scripts/memory_bank_guard.py`
- PR: `.github/workflows/memory-bank-guard.yml`
- explainer: `AI_ENFORCEMENT_GUIDE.md`
- optional workflow helper: `.agents/workflows/startup.md`
