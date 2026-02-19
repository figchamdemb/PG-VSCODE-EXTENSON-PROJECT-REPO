# Gemini Repo Instructions

Use `AGENTS.md` as the primary policy contract for this repository.

Mandatory start-of-session:
0. Run `.\pg.ps1 start -Yes`.
1. Read `Memory-bank/daily/LATEST.md` and the latest daily report.
2. Read `Memory-bank/project-spec.md`.
3. Read `Memory-bank/structure-and-db.md`.
4. Read latest entries in `Memory-bank/agentsGlobal-memory.md`.
5. Check `Memory-bank/mastermind.md` for open decisions.

Mandatory end-of-session when code changed:
1. Update relevant Memory-bank docs (`structure-and-db`, `db-schema`, `code-tree`).
2. Append `Memory-bank/agentsGlobal-memory.md`.
3. Update `Memory-bank/daily/YYYY-MM-DD.md`.
4. Update `Memory-bank/daily/LATEST.md`.

Rules:
- Never add secrets to Memory-bank or code.
- If SQL migrations change, update `Memory-bank/db-schema/*.md` in the same session.
- Respect local hook and CI Memory-bank guards.