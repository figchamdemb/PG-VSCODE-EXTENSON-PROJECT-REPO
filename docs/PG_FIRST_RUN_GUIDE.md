# PG First-Run Guide (Root + Shell)

Use this guide when setting up a project so users do not guess commands.

## Rule 1: Run PG Commands In Project Root

Project root means the folder that contains `pg.ps1` and `pg.cmd`.

- PowerShell:
  - `Set-Location "C:\real\project\root"`
- CMD:
  - `cd /d "C:\real\project\root"`

## One-Time Setup Per Project

### PowerShell

```powershell
Set-Location "C:\real\project\root"
pg install backend --target "."
# frontend-only project: pg install frontend --target "."
.\pg.ps1 start -Yes
.\pg.ps1 map-structure
.\pg.ps1 status
```

Start gate note:
- On legacy/half-built repos, `start` now blocks by default if map docs are missing/stale.
- Warning-only mode (optional): `.\pg.ps1 start -Yes -EnforcementMode warn`
- Fix command: `.\pg.ps1 map-structure`
- Emergency bypass: `.\pg.ps1 start -Yes -SkipMapStructureGate`

### CMD

```bat
cd /d "C:\real\project\root"
pg install backend --target "."
REM frontend-only project: pg install frontend --target "."
pg.cmd start -Yes
pg.cmd map-structure
pg.cmd status
```

Shell rule:
- PowerShell / `pwsh`: `.\pg.ps1 ...`
- CMD: `pg.cmd ...`

## Two Independent Projects (Backend + Frontend)

Run setup in each root separately.

```powershell
# backend root
Set-Location "C:\work\backend-project"
pg install backend --target "."
.\pg.ps1 start -Yes
.\pg.ps1 map-structure

# frontend root
Set-Location "C:\work\frontend-project"
pg install frontend --target "."
.\pg.ps1 start -Yes
.\pg.ps1 map-structure
```

Each project gets its own:
- `pg.ps1`
- `Memory-bank/`
- session state/history

## Frontend/Backend Integration Workflow Bootstrap

The staged integration workflow is real runtime behavior, not just documentation.

- Shared files:
  - `Memory-bank/frontend-integration.md`
  - `Memory-bank/frontend-integration/state.json`
  - `Memory-bank/frontend-integration/pages/*.md`
- New installs/bootstrap now scaffold these automatically.
- Existing or older repos may need one one-time command if the shared ledger is missing:

```powershell
.\pg.ps1 integration-init
```

Then claim roles in the already-bootstrapped project root:

```powershell
.\pg.ps1 backend-start
.\pg.ps1 frontend-start
.\pg.ps1 integration-summary
```

If you are logged in with a PG bearer token, the same commands also sync the workflow through the local server and keep a protected audit trail:

```powershell
.\pg.ps1 integration-summary -ApiBase http://127.0.0.1:8787
```

Important:
- `backend-start` and `frontend-start` do not replace `pg install ...`.
- They do not replace `.\pg.ps1 start -Yes`.
- They only mark backend/frontend ownership and heartbeat inside the shared integration ledger.
- When `PG_ACCESS_TOKEN` or lifecycle login state is available, they also update the authenticated server orchestration mirror.
- Add `-Persistent` when you want that role claim to stay alive in the existing 30-second local watch loop without running a second `integration-watch` command.
- Use `backend-stop`, `frontend-stop`, `integration-stop`, or `integration-end` from another terminal when a persistent worker should exit cleanly instead of being killed abruptly.
- The persistent-worker control signal is intentionally kept minimal in `Memory-bank/_generated/frontend-integration-runtime.json`; the protected orchestration mirror and audit still stay on the server side whenever authenticated sync is active.

Examples:
- `./pg.ps1 backend-start -Persistent -PollSeconds 30`
- `./pg.ps1 frontend-start -Persistent -PollSeconds 30`
- `./pg.ps1 backend-stop`
- `./pg.ps1 integration-end -Role frontend`

Legacy-project rule:
- If the repo predates the integration workflow and `Memory-bank/frontend-integration.md` does not exist yet, run `.\pg.ps1 integration-init` once after `start` and `map-structure`.

CMD equivalent:
- `pg.cmd integration-init`

## Verify It Worked

From project root:

```powershell
.\pg.ps1 help
.\pg.ps1 map-structure
.\pg.ps1 status
```

Expected:
- `Session status: ACTIVE` after start
- `Memory-bank/_generated/session-state.json` exists

## What `pg install` Actually Does

`pg install backend --target "."` (or `frontend`) is a scaffold/bootstrap command.

- It creates PG workflow files (`pg.ps1`, scripts, hooks, Memory-bank docs/templates) in that project root.
- It now also scaffolds the shared frontend/backend integration ledger for new installs.
- It does **not** generate your full application architecture/business code from plain specs.
- It is script-driven (PowerShell/Python templates), not an AI-generation call.
- For existing/legacy codebases, run `.\pg.ps1 map-structure` to generate first-pass `Memory-bank/code-tree/auto-*.md` and `Memory-bank/db-schema/auto-discovered-schema.md` from current source + migration/schema files.

## Mandatory Self-Check Before Memory-Bank Finalize

Before final Memory-bank updates/commit, run strict self-check:

```powershell
.\pg.ps1 self-check -EnableDbIndexMaintenanceCheck
```

Playwright smoke is now mandatory in self-check:

```powershell
.\pg.ps1 self-check -EnableDbIndexMaintenanceCheck
```

Guard behavior:
- latest self-check must be strict (not `-WarnOnly`) and `PASS`,
- DB maintenance check must be enabled,
- Playwright smoke is always enabled in the latest self-check summary.
- this is hard-enforced by pre-commit guard using `Memory-bank/_generated/self-check-latest.json`.

## Frontend Design Rule (UI Tasks)

When the work affects app/web/dashboard UI:

- Read `docs/FRONTEND_DESIGN_GUARDRAILS.md` before editing.
- If the user gives a design guide, screenshot, or prompt, that user source overrides the repo default guide.
- Build similar patterns, not copied screens:
  - keep shell/card/button/dropdown/section hierarchy aligned with the active reference
  - do not clone another product one-to-one unless the user explicitly asks for that
- For React, React Native, and Kotlin/Compose work, translate the pattern grammar natively instead of recreating HTML/Tailwind literally.
- The default guide now includes secure mobile auth/approvals/vault examples and button grammar, so agents should preserve those state/action patterns even when the target stack is different.

## Custom Provider Proof Test (OpenAI/Ollama/OpenRouter)

1. Run `Narrate: Open Model Settings`.
2. Set:
   - `narrate.model.baseUrl`
   - `narrate.model.modelId`
   - `narrate.model.apiKey` (if required)
3. Open any code file and run `Narrate: Toggle Reading Mode (Dev)`.
4. Confirm narration renders with configured provider.

Ollama example:
- `narrate.model.baseUrl = http://127.0.0.1:11434/v1`
- `narrate.model.modelId = llama3.1`
- local API running (`ollama serve`)

## Enterprise Offline Package (On-Prem / High-Control)

Available API surface:
- `POST /account/enterprise/offline-pack/activate`
- `GET /account/enterprise/offline-pack/info`
- `POST /pg-global-admin/board/enterprise/offline-pack/issue`
- `POST /pg-global-admin/board/enterprise/offline-pack/rotate`
- `POST /pg-global-admin/board/enterprise/offline-pack/revoke`

New project vs existing project:
- New/empty project:
  - creates base Memory-bank + workflow structure so you can start immediately.
- Existing project:
  - adds missing PG/Memory-bank scaffold files while keeping your current source tree.

Core scaffold files (high value):
- `pg.ps1`, `scripts/pg.ps1`, `pg.cmd`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/coding-security-standards.md` (applies to frontend + backend)
- `Memory-bank/agentsGlobal-memory.md`
- `Memory-bank/mastermind.md`
- `.githooks/pre-commit`

## About `pg update`

`pg update` is not available in every installed profile.

- Always check available commands in your current project root:
  - `.\pg.ps1 help`
  - `pg.cmd help` (CMD)
- If `update` is listed there, you can run:
  - `.\pg.ps1 update`
- If `update` is not listed, use:
  - `pg install backend --target "."` (or `pg install frontend --target "."`) to add missing scaffold files.

Note: re-running install is additive by default (adds missing files, skips existing files).

## Upgrade Existing PG Scaffold Safely

Use scaffold upgrade when the repo already has PG files, but the command surface is stale and you need newer tooling without deleting `Memory-bank/` history.

Modern repo-local path:

```powershell
.\pg.ps1 upgrade-scaffold -DryRun
.\pg.ps1 upgrade-scaffold -Yes
```

Compatibility path when you want to target another repo from an updated PG root:

```powershell
.\pg.ps1 install backend --target "C:\real\other-repo" -UpgradeScaffold -DryRun
.\pg.ps1 install backend --target "C:\real\other-repo" -UpgradeScaffold -Yes
```

Behavior:

- default mode is preview-only unless `-Yes` is supplied
- writes report artifacts under `Memory-bank/_generated/scaffold-upgrades/`
- preserves `Memory-bank/daily/*`, `agentsGlobal-memory.md`, project planning docs, and app source by default
- may flag instruction files like `AGENTS.md` for manual review instead of overwriting them blindly

## Same-Machine Rollout For Multiple Existing Repos

When the same computer has multiple PG/Memory-bank repos already open in VS Code, rollout happens at two different levels:

- machine level:
  - the installed Narrate VSIX/extension code is shared by all VS Code windows on that machine
- repo level:
  - each repo still keeps its own `pg.ps1`, `Memory-bank/`, hooks, generated state, and git config

That means one extension update can affect every repo on the machine, but each repo still needs its own repo-local refresh steps.

### If The Extension/VSIX Changed

Install the updated VSIX once on the machine, then reload every VS Code window that should use the new extension behavior.

Normal VS Code window steps:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\local_extension_install.ps1
```

Then in each already-open VS Code window:

- run `Developer: Reload Window`

Use this when the change is in extension runtime behavior, for example:

- startup enforcement logic
- stop/resume enforcement bridge
- sidebar/status-bar behavior
- extension-triggered startup or post-write enforcement

### If Repo Scripts/Memory-Bank Enforcement Changed

Each repo must receive the updated repo files from source control. After the repo has the new files, run this inside that repo root:

```powershell
.\pg.ps1 start -Yes
powershell -ExecutionPolicy Bypass -File scripts\install_memory_bank_hooks.ps1 -Mode strict
.\pg.ps1 self-check -EnableDbIndexMaintenanceCheck
```

Why each step exists:

- `start -Yes`
  - refreshes session state, generated docs, and startup gates for that repo
- hook install in `strict`
  - updates the repo-local git hook path/config for that repo
- strict `self-check`
  - proves the repo is now using the enforced path and not a stale warn-only path

### Do You Need To Start The Server?

Not for rollout by itself.

Only start a local backend/server when that repo’s validation path needs runtime endpoints, for example:

- Playwright smoke tests hit a local site
- the portal/app is being tested manually
- self-check includes server-backed routes that must be reachable

If the repo change is only extension/runtime/hook/docs enforcement, server startup is usually not required just to apply the update.

### What To Do In An Already-Open Repo Window

If the repo was already open before the update landed:

1. pull latest repo changes
2. reload the VS Code window if the extension changed
3. run `.\pg.ps1 start -Yes`
4. reinstall hooks if hook/enforcement scripts changed
5. run `.\pg.ps1 self-check -EnableDbIndexMaintenanceCheck`

### Fast Rule Of Thumb

- extension changed:
  - reinstall VSIX once, reload all affected windows
- repo scripts changed:
  - update that repo, run `start`, reinstall hooks if needed, run strict `self-check`
- local app/server changed:
  - only start the server if tests or manual validation need it

### If You Want The Latest Startup Logic Immediately

If a repo has already been started earlier and you want the newest startup behavior right away, do one of these inside that repo:

- run `.\pg.ps1 start -Yes`
- or run `Narrate: Run Startup For Current Context`

This forces the current repo context to pick up the newest startup/session rules instead of waiting for the next ordinary startup cycle.

## Daily Retention Policy

Memory-bank daily reports are capped by `--keep-days` (default `7`).

- The cap counts date files like `YYYY-MM-DD.md`.
- `LATEST.md` is a pointer file and is not counted as a daily report.
- Enforced by generator: `scripts/generate_memory_bank.py`.

Manual normalize command (if needed):

```powershell
python scripts/generate_memory_bank.py --profile frontend --keep-days 7
```

Quick check:

```powershell
.\pg.ps1 status
```

`status` now prints:
- `daily_reports_count`
- `daily_keep_days`
- `daily_retention: OK` or `OVER_LIMIT`

## Long Log Retention (agentsGlobal + mastermind)

To prevent long-running projects from bloating context:
- `scripts/generate_memory_bank.py` now rotates oversized append-only logs.
- Rotated content is archived to `Memory-bank/_archive/`.
- Targets:
  - `Memory-bank/agentsGlobal-memory.md` (default limit via `MEMORY_BANK_AGENTS_GLOBAL_MAX_LINES`, default `2500`)
  - `Memory-bank/mastermind.md` (default limit via `MEMORY_BANK_MASTERMIND_MAX_LINES`, default `1800`)

Use the same normalize command:

```powershell
python scripts/generate_memory_bank.py --profile frontend --keep-days 7
```

Then check:

```powershell
.\pg.ps1 status
```

It will now include:
- `agents_global_lines`
- `mastermind_lines`
- `memory_log_retention: OK|OVER_LIMIT`

## Spec To Milestone Rule (Agent Enforcement)

When requirements change mid-project, do not skip planning updates.

- Add a request tag in `Memory-bank/project-spec.md`:
  - example: `[REQ-2026-03-05-01] Add enterprise audit export page`
- Map that same REQ tag in `Memory-bank/project-details.md`:
  - in `Current Plan (Rolling)` milestone rows and/or
  - in today’s `### Session Update - YYYY-MM-DD ...` section.

This is checked by `scripts/memory_bank_guard.py` during commit flow.

## Common Mistakes

- `Target path not found: C:\path\to\your\project`
  - You pasted a placeholder. Replace with a real path.
- `cd /d ...` fails in PowerShell
  - `cd /d` is CMD syntax. Use `Set-Location` in PowerShell.
- `.\\pg.ps1` not recognized
  - You are not in project root.
- Extension popup: `needs a PG project root`
  - Click `Open Fix Guide` in the popup, then run from a folder containing both `pg.ps1` and `scripts/pg.ps1`.

## Where Users Can Find This

- This file: `docs/PG_FIRST_RUN_GUIDE.md`
- Extension sidebar: `Narrate: Open Command Help`
- Web help page: `/help`
