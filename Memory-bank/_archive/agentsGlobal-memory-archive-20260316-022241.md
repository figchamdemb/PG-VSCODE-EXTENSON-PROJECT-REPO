# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-16 02:22
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 36


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260316-005006.md` on 2026-03-16 00:50 UTC.

    - `ControlImdsV2Enforced`
    - `ControlSshPortClosedPublic`
    - `ControlDbPortNotPublic`
    - `ControlWafManagedRulesEnabled`
    - `ControlAuthRateLimitsEnabled`
    - `ControlCiSecretScanningEnabled`
    - `ControlWireguardAlertEnabled`
    - `ControlCloudTrailRootLoginAlert`
    - `ControlEc2MultiAz`
  - routed new flags through `scripts/pg.ps1` into `scripts/mcp_cloud_score_verify.ps1`.
- UX/docs updates:
  - added regulated cloud-control command example to extension Help Center quickstart.
  - updated Memory-bank command, structure, spec, and code-tree docs for 13E baseline bridge.
- Validation:
  - `npm run build` (server) PASS
  - `npm run compile` (extension) PASS
  - `.\pg.ps1 help` PASS (shows `mcp-cloud-score` command + examples)

Anchors:
- `server/src/mcpCloudScoring.ts`
- `server/src/index.ts`
- `scripts/mcp_cloud_score_verify.ps1`
- `scripts/pg.ps1`
- `extension/src/help/commandHelpContent.ts`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/code-tree/memory-bank-tooling-tree.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`

### [2026-02-27 19:25 UTC] - codex
Scope:
