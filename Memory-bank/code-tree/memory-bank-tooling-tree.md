# Memory-bank Tooling Tree

LAST_UPDATED_UTC: 2026-02-20 22:53
UPDATED_BY: codex

## Session Commands
- `pg.ps1`, `pg.cmd`: local command wrappers for start/status/end.
- `scripts/pg.ps1`: command router and session helper logic.

## Session Lifecycle
- `scripts/start_memory_bank_session.ps1`
- `scripts/start_memory_bank_session.py`
- `scripts/session_status.py`
- `scripts/end_memory_bank_session.py`
- `scripts/end_memory_bank_session.ps1`

## Summary/Generation
- `scripts/build_frontend_summary.py`
- `scripts/generate_memory_bank.py`

## Guard/Enforcement
- `scripts/memory_bank_guard.py`
- `scripts/install_memory_bank_hooks.ps1`
- `scripts/install_memory_bank_hooks.sh`
- `.githooks/pre-commit`
- `.github/workflows/memory-bank-guard.yml`

## DevOps Utilities
- `scripts/setup_cloudflare_tunnel.ps1`: cloudflared helper for quick temporary tunnels, named-domain tunnel provisioning, and service-token install mode.
