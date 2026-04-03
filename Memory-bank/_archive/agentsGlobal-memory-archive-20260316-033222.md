# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-16 03:32
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 28


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260316-022241.md` on 2026-03-16 02:22 UTC.

- Components: architecture-doc-alignment-boundary-model
- Files touched: feature planning doc + memory-bank strategy/decision docs

Summary:
- Reviewed external architecture/security docs (`extension_architecture_complete`, `local_first_agent_architecture`, `our_stack_vs_datadog_guide`, `defence_in_depth_toolchain`, `wallet_system_data_placement_guide`, `secure_cloud_architecture_spec`) and aligned them into a formal placement model.
- Added boundary matrix and enforcement rules to `.verificaton-before-production-folder/FEATURE_ADDITIONS.md`:
  - local extension/agent deterministic checks,
  - server-private policy internals,
  - MCP metadata-only cloud scoring,
  - optional enterprise managed observability overlays.
- Updated milestone tracking to include cloud architecture boundary alignment checkpoint.
- Recorded mastermind decisions to keep managed observability optional (enterprise scope) and avoid exposing private policy internals client-side.

Anchors:
- `.verificaton-before-production-folder/FEATURE_ADDITIONS.md`
- `Memory-bank/project-details.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/mastermind.md`

### [2026-02-27 21:30 UTC] - codex
Scope:
- Components: self-hosted-observability-adapter-bridge-baseline
- Files touched: server policy route/evaluator + pg command bridge + command/help/docs sync
