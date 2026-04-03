# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-28 06:35
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 44


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260328-041034.md` on 2026-03-28 04:10 UTC.

- Components: milestone-next-blocker-burndown, licensing-module-split, cloud-score-followup
- Files touched: extension licensing modules + memory docs

Summary:
- Removed the extension hard file-size blocker by splitting licensing interactive flows into a helper module.
- Refactor details:
  - added `extension/src/licensing/featureGateActions.ts` for email/GitHub sign-in loopback, trial/redeem, checkout, project quota actions, and device revoke workflows.
  - kept `extension/src/licensing/featureGates.ts` as orchestration/entitlement/provider-gate layer with thin delegating wrappers.
  - reduced `featureGates.ts` from `876` to `471` lines (behavior preserved).
- Milestone validation:
  - warn-mode self-check coding hard blockers improved `10 -> 9`.
  - regulated cloud-score scanner blockers currently `11` with architecture warnings pending explicit control evidence.

Validation:
- `npm run compile` (extension): PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS in warn mode; remaining hard blockers are server-side (`server/src/index.ts`)
- `./pg.ps1 cloud-score -WorkloadSensitivity regulated`: blocked (`scanner blockers: 11`, `warnings: 105`)
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: FAIL in strict mode (existing blockers + intermittent `DEP-REGISTRY-001` + DB host `91.98.162.101:5433` unreachable)
- `./scripts/enforcement_trigger.ps1 -Phase start-session -WarnOnly`: PASS in warn mode (`dependency blockers: 0`, `coding blockers: 9`)

Anchors:
- `extension/src/licensing/featureGates.ts`
- `extension/src/licensing/featureGateActions.ts`
- `Memory-bank/code-tree/narrate-extension-tree.md`
- `Memory-bank/project-details.md`
- `Memory-bank/daily/2026-02-28.md`
- `server/src/index.ts`

### [2026-02-28 05:54 UTC] - codex
Scope:
- Components: coding-policy-log-safety-tuning
- Files touched: server log-safety policy module + memory updates

Summary:
- Tuned log-safety scanner to avoid false positives inside trusted logger-wrapper internals.
- `server/src/codingStandardsLogSafety.ts` now exempts sanitized wrapper emit lines (`app.log.*(sanitizedMessage)`).
- Result: `COD-LOG-002` false-positive on `server/src/index.ts` cleared while unsafe direct-log detection remains active for non-sanitized calls.

Validation:
- `npm run build` (server): PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS in warn mode (blockers reported, no `COD-LOG-002` false-positive)
