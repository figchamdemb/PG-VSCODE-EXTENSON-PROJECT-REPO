# Narrate Command Diagnostics

UTC: 2026-03-03T20:29:46.244Z

## Context

- resolved_repo_root: c:\Users\ebrim\Desktop\PG VSCODE-EXTENSION
- resolved_pg_script: c:\Users\ebrim\Desktop\PG VSCODE-EXTENSION\pg.ps1
- resolution_start_path: c:\Users\ebrim\Desktop\PG VSCODE-EXTENSION\extension\src\help

## Infrastructure

### PASS - Backend /health

Output:
```text
ok=true
```

### PASS - Slack integration health

Output:
```text
ok=true commands_enabled=True
```

### FAIL - Local dev profile check

Output:
```text
[33;1mWARNING: Dev profile check: missing required fields.[0m
- path: C:\Users\ebrim\Desktop\PG VSCODE-EXTENSION\.narrate\dev-profile.local.json
- gitignored: true
  - values.db_host
  - values.db_name
  - values.db_user
  - secret_values.db_password | Command failed: pwsh -NoProfile -ExecutionPolicy Bypass -File c:\Users\ebrim\Desktop\PG VSCODE-EXTENSION\pg.ps1 dev-profile -DevProfileAction check
```

Fix: Run: .\pg.ps1 dev-profile -DevProfileAction init, then set required fields.

### PASS - Governance worker one-shot

Output:
```text
Governance worker started.
- api_base: http://127.0.0.1:8787
- state_file: C:\Users\ebrim\Desktop\PG VSCODE-EXTENSION\Memory-bank\_generated\governance-agent-state.json
- cursor: 29
- playbook: C:\Users\ebrim\Desktop\PG VSCODE-EXTENSION\scripts\governance_action_playbook.json
No new governance events.
Governance worker completed.
```

## Extension

### PASS - Narrate flow baseline check

Output:
```text
Narrate flow check:
- pass: 5
- fail: 0
[PASS] Package command wiring
[PASS] Extension runtime registration
[PASS] Core flow source files
[PASS] Extension compile
[PASS] Runtime interaction surface
Report: C:\Users\ebrim\Desktop\PG VSCODE-EXTENSION\Memory-bank\_generated\narrate-flow-check-latest.md
```

### PASS - Extension TypeScript compile

Output:
```text
> narrate-vscode-extension@0.1.0 compile
> npm run clean && tsc -p ./


> narrate-vscode-extension@0.1.0 clean
> rimraf dist
```

## Data

### PASS - DB index maintenance check

Output:
```text
DB index maintenance verification status: pass
Checks: 5 | blockers: 0 | warnings: 0
```
