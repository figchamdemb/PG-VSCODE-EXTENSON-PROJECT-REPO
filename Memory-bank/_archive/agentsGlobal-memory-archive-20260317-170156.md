# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-17 17:01
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 28


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260317-164020.md` on 2026-03-17 16:40 UTC.

- Components: architecture-docs-placement-v2 + observability-rollout-alignment
- Files touched: external-doc alignment plan + memory/planning sync

Summary:
- Re-read and aligned all six external architecture docs into explicit runtime placement rules:
  - `extension_architecture_complete.md`
  - `local_first_agent_architecture.md`
  - `our_stack_vs_datadog_guide.md`
  - `defence_in_depth_toolchain.md`
  - `wallet_system_data_placement_guide.md`
  - `secure_cloud_architecture_spec.md`
- Expanded `.verificaton-before-production-folder/FEATURE_ADDITIONS.md` with:
  - exact layer mapping (`local`, `server-private`, `MCP metadata`, `optional managed`)
  - build-vs-integrate matrix (SDK/protocol integrations without vendor lock)
  - execution order and acceptance criteria for rollout.
- Synced planning/memory docs so this alignment is tracked as active execution work:
  - added observability rollout pack line-item in project details,
  - added protocol/SDK integration clarification in project spec,
  - added observability strategy note in structure snapshot,
  - added new mastermind decision for final placement/execution sequence.
- Validation:
  - session start protocol run (`.\pg.ps1 start -Yes`) and required Memory-bank reads completed.

Anchors:
- `.verificaton-before-production-folder/FEATURE_ADDITIONS.md`
