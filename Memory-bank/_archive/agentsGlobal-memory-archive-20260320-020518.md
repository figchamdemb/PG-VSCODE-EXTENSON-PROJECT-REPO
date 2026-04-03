# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 02:05
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 22


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-012839.md` on 2026-03-20 01:28 UTC.


Validation:
- `npm run compile` (extension): PASS
- `cmd /c "echo y|npx @vscode/vsce package --allow-missing-repository"`: PASS
- `code.cmd --install-extension .\extension\narrate-vscode-extension-0.1.1.vsix --force`: PASS

Anchors:
- `extension/package.json`
- `docs/LOCAL_VSIX_INSTALL_AND_UI_TEST.md`
- `Memory-bank/code-tree/narrate-extension-tree.md`

### [2026-03-20 01:59 UTC] - copilot
Scope:
- Components: review-workflow-proposal, builder-reviewer-heartbeat-planning
- Files touched: proposal doc + planning memory docs

Summary:
- Added a tracked proposal for a PG-native local review workflow modeled after the existing frontend/backend integration heartbeat system.
- New scope `[REQ-2026-03-20-01]` defines a local-first `builder` and `reviewer` role pair that communicate only through PG review ledger/state files.
