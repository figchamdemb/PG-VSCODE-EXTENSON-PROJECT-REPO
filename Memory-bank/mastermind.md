# Mastermind - Decisions & Verification (Append-Only)

LAST_UPDATED_UTC: 2026-02-19 21:43
UPDATED_BY: mb-init

## Decision Log

### Topic: Memory-bank Enforcement Bootstrapped
Date_UTC: 2026-02-19
Owner: mb-init

Options:
1. Warn mode first, then strict.
2. Strict from day one.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 1 | Lower rollout friction |
| Reviewer B | Option 1 | Easier adoption |

Decision:
- Bootstrap with default mode `warn` (Option 1).

Rationale:
- Start with warnings until process is stable, then move to strict mode.

Risks:
- Warning mode can allow drift if ignored.

Mitigation:
- Flip mode to strict after team baseline is stable.

Final Ruling:
- Option 1 approved by majority vote.