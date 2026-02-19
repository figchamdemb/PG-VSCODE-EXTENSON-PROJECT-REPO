# Claude Repo Instructions

Primary policy file: `AGENTS.md`.

Mandatory start protocol:
0. `.\pg.ps1 start -Yes`
1. `Memory-bank/daily/LATEST.md`
2. latest daily report
3. `Memory-bank/project-spec.md`
4. `Memory-bank/structure-and-db.md`
5. latest `Memory-bank/agentsGlobal-memory.md` entries
6. relevant decisions in `Memory-bank/mastermind.md`

Mandatory end protocol for code changes:
1. Update matching Memory-bank docs (`structure-and-db`, `db-schema`, `code-tree` as needed).
2. Append `Memory-bank/agentsGlobal-memory.md`.
3. Update `Memory-bank/daily/YYYY-MM-DD.md` and `Memory-bank/daily/LATEST.md`.
4. If migration changed, update `Memory-bank/db-schema/*.md`.

Enforcement:
- Local pre-commit hook runs `scripts/memory_bank_guard.py`.
- CI guard workflow validates Memory-bank updates on pull requests.