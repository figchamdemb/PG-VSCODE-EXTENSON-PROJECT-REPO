# Memory-bank Enforcement

LAST_UPDATED_UTC: 2026-02-19 21:43
DEFAULT_MODE: warn
PROJECT_TYPE: frontend

## Modes
- `warn`: show policy violations but do not block commits/CI.
- `strict`: fail guard checks and block until Memory-bank is updated.

## Current Local Setup
- Hook path: `.githooks`
- Guard script: `scripts/memory_bank_guard.py`
- Installer: `scripts/install_memory_bank_hooks.ps1`
- Session script: `scripts/start_memory_bank_session.ps1`
- Simple CLI wrapper: `pg.ps1` / `pg.cmd`
- Session limits: max `5` commits, max `12` hours per session

## Switch Mode
- Local repo:
  - `git config memorybank.mode strict`
  - `git config memorybank.mode warn`
- CI:
  - Set repo variable `MB_ENFORCEMENT_MODE` to `warn` or `strict`.