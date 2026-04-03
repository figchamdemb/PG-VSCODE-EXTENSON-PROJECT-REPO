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
- For frontend/UI tasks, read `docs/FRONTEND_DESIGN_GUARDRAILS.md` before editing.
  - if the user provides a design guide, screenshot, prompt, or component reference, treat that user-supplied input as the primary design source.
  - otherwise follow the repo guide and keep new work in the same product family as the existing portal/help/pricing/dashboard surfaces.
  - copy the pattern language, not the exact design: preserve shell/card/button/dropdown/section hierarchy and control flow without cloning external references one-to-one.
  - for secure mobile/authenticator work, preserve the guide's state-led card shell and explicit button grammar (`primary`, `secondary`, `destructive`, `fab`, `nav`) across Kotlin/Compose and React-based surfaces.
  - treat the approved references as selectable pattern families; pick the closest fit for the current surface instead of forcing every screen to reuse every motif.
- Before declaring a task complete, run strict final self-check (no warn mode):
  - `.\pg.ps1 self-check -EnableDbIndexMaintenanceCheck`
- Agent behavior requirement:
  - run these checks proactively from terminal and resolve issues directly when possible.
  - only ask user for manual input when credentials/platform restarts are truly required.
- Spec-to-milestone requirement (mandatory when scope changes):
  - if user adds or changes scope, add/update `Memory-bank/project-spec.md` with a request tag like `[REQ-YYYY-MM-DD-01]`.
  - map each REQ tag into `Memory-bank/project-details.md` (Current Plan milestone row and/or today's Session Update).
  - do not implement scope changes without milestone tracking updates.

## Enforcement
- Local hook: `.githooks/pre-commit` runs `scripts/memory_bank_guard.py`.
- Mode is `warn` or `strict` (current default: `warn`).
- Session-start enforcement defaults to `strict` for map-structure gate checks (legacy repos must run `.\pg.ps1 map-structure` when stale/missing).
- CI guard: `.github/workflows/memory-bank-guard.yml`.
- Screen/Page file size guard:
  - max 500 lines for `screen/page` files (warn in warn mode, fail in strict mode).
- UI design guard:
  - UI-impacting changes require `docs/FRONTEND_DESIGN_GUARDRAILS.md` to stay present and referenced from policy docs.
  - changed UI files should use semantic layout/control patterns and shared design tokens rather than ad-hoc inline styling.
- Planning guardrails enforced by `memory_bank_guard.py` on code changes:
  - `project-details.md` must include today's `Session Update` section,
  - `Current Plan (Rolling)` must have valid plan rows,
  - REQ IDs from `project-spec.md` must be mapped in `project-details.md`.

## Server Policy Profile
Plan-aware agent directives are resolved server-side via
`GET /account/policy/agents/profile`. The profile controls:
- Per-domain enforcement level (`warn` | `block` | `off`)
- Auto-fix capability per domain
- Production checklist gate requirements
- Offline pack support flag
- Frontend design guardrail requirements, default reference docs, and user-guide precedence for UI work
Local directives in this file define **workflow** (memory-bank, checks);
server profile defines **policy strictness** per plan tier.

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
