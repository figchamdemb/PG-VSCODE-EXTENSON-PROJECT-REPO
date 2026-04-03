# Archive from mastermind.md

GENERATED_UTC: 2026-03-13 00:27
SOURCE_FILE: Memory-bank/mastermind.md
REMOVED_LINES: 35


> Older entries archived to `Memory-bank/_archive/mastermind-archive-20260312-082441.md` on 2026-03-12 08:24 UTC.

| Reviewer A | Option 2 | Extension-based agents often need instruction amplification when repo docs are treated as softer context than editor-native rules. |
| Reviewer B | Option 2 | The repo should document the limitation honestly instead of pretending markdown alone gives Cursor-level system enforcement. |

Decision:
- Implement Option 2.

Rationale:
- The user is seeing Antigravity skip startup/Memory-bank bootstrapping even though Codex and Cursor-style tools are already compliant.
- Stronger agent-specific startup wording can improve compliance, but the repo also needs a clear explanation of the extension boundary.

Risks:
- Some extensions may still ignore repo docs before first response.

Mitigation:
- Keep the real enforcement path in hooks, self-checks, and guard scripts.
- Document `.agents/workflows/startup.md` as optional rather than guaranteed.

Final Ruling:
- Add the agent-specific startup amplification layer, but describe it as compliance improvement rather than a guaranteed extension-level override.

### Topic: Dead-code autofix scope (safe imports-only vs broad deletion)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Attempt broad automatic deletion of all high-confidence dead-code findings.
2. Restrict auto-fix to organize-imports on high-confidence files and keep other cleanup manual.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Import cleanup is deterministic and low-risk; variable/function deletion can still break behavior in edge cases |
