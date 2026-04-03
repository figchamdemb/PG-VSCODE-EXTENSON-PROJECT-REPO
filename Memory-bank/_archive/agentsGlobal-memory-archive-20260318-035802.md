# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-18 03:58
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 23


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260318-030212.md` on 2026-03-18 03:02 UTC.

Scope:
- Components: trust-score-auth-ux, server-backed-trust-clarity
- Files touched: extension trust rendering modules + daily/project memory docs

Summary:
- Preserved server-backed Trust Score evaluation and changed only the unauthenticated UX path in the extension.
- Missing session token/server-auth cases now render as authentication-required guidance instead of looking like a real red `0/100` code-quality failure.
- Status-bar and tree-view trust summaries now explicitly direct the operator to sign in before server trust evaluation can run.

Validation:
- `npm run compile` (extension): PASS
- `get_errors` on modified trust files: PASS

Anchors:
- `extension/src/trust/serverPolicyBridge.ts`
- `extension/src/trust/trustScoreHelpers.ts`
- `extension/src/trust/trustScoreService.ts`
- `extension/src/trust/trustScoreViewProvider.ts`
- `Memory-bank/project-details.md`
- `Memory-bank/daily/2026-03-18.md`
