# Copilot Repository Instructions

Follow `AGENTS.md` and treat `Memory-bank/` as mandatory project context.

Before proposing or changing code:
0. Run `.\pg.ps1 start -Yes`.
1. Read `Memory-bank/daily/LATEST.md` and latest daily file.
2. Read `Memory-bank/project-spec.md`.
3. Read `Memory-bank/structure-and-db.md`.
4. Read latest entries in `Memory-bank/agentsGlobal-memory.md`.
5. Check `Memory-bank/mastermind.md` for open decisions.

If code changes:
1. Update relevant Memory-bank docs.
2. Append `Memory-bank/agentsGlobal-memory.md`.
3. Update `Memory-bank/daily/YYYY-MM-DD.md` and `Memory-bank/daily/LATEST.md`.
4. If SQL migrations changed, update `Memory-bank/db-schema/*.md`.

Quality constraints:
- No secrets in code or Memory-bank docs.
- Keep files modular and maintainable.
- Screen/page files should stay <= 500 lines where feasible.