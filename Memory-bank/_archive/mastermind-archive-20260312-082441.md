# Archive from mastermind.md

GENERATED_UTC: 2026-03-12 08:24
SOURCE_FILE: Memory-bank/mastermind.md
REMOVED_LINES: 41


Options:
1. Keep frontend design guidance as informal prose only and rely on agents to remember it.
2. Add a repo-default design guardrails doc, expose it in agent policy metadata, and enforce baseline UI structure checks while still allowing user-provided guides to override defaults.

Voting:
> Older entries archived to `Memory-bank/_archive/mastermind-archive-20260312-065501.md` on 2026-03-12 06:55 UTC.

| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | UI quality needs machine-visible guardrails, not just a loose note, and user-specific design direction must stay higher priority. |
| Reviewer B | Option 2 | Similar-pattern guidance preserves consistency without forcing one-to-one copying of reference screens. |

Decision:
- Implement Option 2.

Rationale:
- The user asked for persistent enforcement so future AI agents stop generating weak dashboard/button/section patterns.
- A default repo guide plus policy/guard integration gives the agent a stable fallback, while still respecting direct user design input.

Risks:
- Static guard checks can enforce structural signals, but they cannot fully judge visual quality.

Mitigation:
- Keep automated checks focused on semantic layout/control structure and shared token usage.
- Put the qualitative rules in `docs/FRONTEND_DESIGN_GUARDRAILS.md` and surface that path through `/account/policy/agents/profile`.

Final Ruling:
- UI tasks now require the repo design guardrails doc by default, use similar-not-copy behavior, and allow user-provided design guides to override the repo baseline.

### Topic: Agent-specific startup amplification for Antigravity/Gemini
Date_UTC: 2026-03-12
Owner: codex

Options:
1. Leave `ANTIGRAVITY.md` and `GEMINI.md` as passive summaries and rely on `AGENTS.md` alone.
2. Mirror the startup contract into agent-specific files with stronger top-of-file override wording, plus add an honest explainer and optional workflow helper.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
