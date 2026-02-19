# Antigravity Repo Instructions

Follow repository policy from `AGENTS.md`.

Before coding:
- Run `.\pg.ps1 start -Yes`.
- Read Memory-bank context:
  - `Memory-bank/daily/LATEST.md` and latest daily report
  - `Memory-bank/project-spec.md`
  - `Memory-bank/structure-and-db.md`
  - latest `Memory-bank/agentsGlobal-memory.md` entries
  - relevant `Memory-bank/mastermind.md` decisions

After coding:
- Update matching Memory-bank docs.
- Append `Memory-bank/agentsGlobal-memory.md`.
- Update today's `Memory-bank/daily/YYYY-MM-DD.md`.
- Update `Memory-bank/daily/LATEST.md`.
- If migration files changed, update `Memory-bank/db-schema/*.md`.

Enforcement:
- local: `.githooks/pre-commit` -> `scripts/memory_bank_guard.py`
- PR: `.github/workflows/memory-bank-guard.yml`