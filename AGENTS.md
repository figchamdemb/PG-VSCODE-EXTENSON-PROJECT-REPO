# AGENTS.md - Memory-bank Enforced Workflow

This repository requires `Memory-bank/` updates for every coding session.

## Mandatory Start Protocol
0. Run `.\pg.ps1 start -Yes` (or `powershell -ExecutionPolicy Bypass -File scripts/start_memory_bank_session.ps1`).
1. Read `Memory-bank/daily/LATEST.md`.
2. Read the latest daily report referenced there.
3. Read `Memory-bank/project-spec.md`.
4. Read `Memory-bank/project-details.md`.
5. Read `Memory-bank/structure-and-db.md`.
6. Read recent entries in `Memory-bank/agentsGlobal-memory.md`.
7. Read `Memory-bank/tools-and-commands.md` (runtime/tool/start commands).
8. Read `Memory-bank/coding-security-standards.md`.
9. Check `Memory-bank/mastermind.md` for open decisions.

## Mandatory End Protocol (before final summary to user)
If code changed:
1. Update relevant Memory-bank docs:
   - `Memory-bank/structure-and-db.md`
   - `Memory-bank/db-schema/*.md` when schema/migration changed
   - `Memory-bank/code-tree/*-tree.md` when structure changed
   - `Memory-bank/project-details.md` when scope/plan/features changed
   - `Memory-bank/tools-and-commands.md` when runtime/tool/start commands changed
2. Append one entry to `Memory-bank/agentsGlobal-memory.md`.
3. Update `Memory-bank/daily/2026-02-19.md`.
4. Update `Memory-bank/daily/LATEST.md`.
5. Run:
   - `python scripts/build_frontend_summary.py`
   - `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`

If these steps are not complete, the task is incomplete.

## Mandatory During Protocol (as-you-go, do not defer all checks to the user)
- After each substantial change batch, run:
  - `.\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`
- For web/UI-impacting tasks, also run:
  - `.\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck -EnablePlaywrightSmokeCheck`
- Before declaring a task complete, run strict final self-check (no warn mode):
  - `.\pg.ps1 self-check -EnableDbIndexMaintenanceCheck`
- Agent behavior requirement:
  - run these checks proactively from terminal and resolve issues directly when possible.
  - only ask user for manual input when credentials/platform restarts are truly required.

## Enforcement
- Local hook: `.githooks/pre-commit` runs `scripts/memory_bank_guard.py`.
- Mode is `warn` or `strict` (current default: `warn`).
- CI guard: `.github/workflows/memory-bank-guard.yml`.
- Screen/Page file size guard:
  - max 500 lines for `screen/page` files (warn in warn mode, fail in strict mode).

## Commands
- Start session (required before coding):
  - `.\pg.ps1 start -Yes`
  - `powershell -ExecutionPolicy Bypass -File scripts/start_memory_bank_session.ps1`
- End session:
  - `.\pg.ps1 end -Note "finished for today"`
- Session status:
  - `.\pg.ps1 status`
- Install hooks:
  - `powershell -ExecutionPolicy Bypass -File scripts/install_memory_bank_hooks.ps1 -Mode warn`
- Optional bypass (emergency only):
  - `SKIP_MEMORY_BANK_GUARD=1`
