# Archive from mastermind.md

GENERATED_UTC: 2026-03-12 06:52
SOURCE_FILE: Memory-bank/mastermind.md
REMOVED_LINES: 34

1. Keep frontend design guidance as informal prose only and rely on agents to remember it.
2. Add a repo-default design guardrails doc, expose it in agent policy metadata, and enforce baseline UI structure checks while still allowing user-provided guides to override defaults.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | UI quality needs machine-visible guardrails, not just a loose note, and user-specific design direction must stay higher priority. |
| Reviewer B | Option 2 | Similar-pattern guidance is the right constraint: it preserves consistency without forcing one-to-one copying of reference screens. |

Decision:
- Implement Option 2.

Rationale:
- The user asked for persistent enforcement so future AI agents stop generating weak dashboard/button/section patterns.
- A default repo guide plus policy/guard integration gives the agent a stable fallback, while still respecting direct user design input.

Risks:
- Static guard checks can only enforce structural signals, not full design quality.

Mitigation:
- Keep the guard focused on semantic layout/control structure and shared token usage.
- Put the full qualitative rules in `docs/FRONTEND_DESIGN_GUARDRAILS.md` and expose that path through agent policy metadata.

Final Ruling:
- UI tasks now require the repo design guardrails doc by default, use similar-not-copy behavior, and allow user-provided design guides to override the repo baseline.

### Topic: External architecture docs - final placement and execution sequence
Date_UTC: 2026-02-27
Owner: codex

Options:

> Older entries archived to `Memory-bank/_archive/mastermind-archive-20260307-032136.md` on 2026-03-07 03:21 UTC.
