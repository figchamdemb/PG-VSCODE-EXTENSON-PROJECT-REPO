# Archive from mastermind.md

GENERATED_UTC: 2026-03-07 03:18
SOURCE_FILE: Memory-bank/mastermind.md
REMOVED_LINES: 554

1. Keep alignment high-level only and postpone concrete execution mapping.
2. Convert all six external docs into explicit runtime placement plus an execution order (local -> server-private -> MCP -> optional managed service).

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Removes ambiguity and prevents mixing private policy internals into client-facing surfaces. |
| Reviewer B | Option 2 | Gives clear implementation order for low-cost, no-vendor-lock observability rollout. |

Decision:
- Implement Option 2.

Rationale:
- User asked for a practical "what goes where" answer, not abstract architecture notes.
- Existing platform now has enough baseline endpoints/commands (`obs-check`, `cloud-score`) to anchor an execution sequence.

Risks:
- Teams may still interpret optional managed observability as mandatory core requirement.

Mitigation:
- Keep core acceptance tied to local + server-private + MCP evidence checks.
- Keep managed hosting explicitly optional and enterprise-only.

Final Ruling:
- Expanded `.verificaton-before-production-folder/FEATURE_ADDITIONS.md` with:
  - exact implementation mapping by layer,
  - build-vs-integrate table (SDK/protocol integration without vendor lock),
  - execution order and acceptance criteria.
- Synced milestone/planning docs to track observability rollout packs as in-progress.

### Topic: External architecture doc alignment (local tools vs private policy vs MCP cloud)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Treat all external docs as immediate implementation scope and expose full policy details in client-side workflows.
2. Use external docs as policy-source inputs, but enforce a boundary model:
   - local deterministic checks and UX guidance,
   - server-private policy logic/weights,
   - MCP metadata-only scoring bridge,
   - optional managed enterprise observability overlays.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Protects proprietary policy IP while keeping local-first value for free/pro users. |
| Reviewer B | Option 2 | Matches current architecture and avoids overpromising full managed platform parity in core extension milestones. |

Decision:
- Implement Option 2.

Rationale:
- User asked for explicit placement of cloud/security architecture content into the right layers.
- Current product already has local checks + server policy endpoints + MCP cloud scorer; this model formalizes boundaries and sequencing.

Risks:
- Teams may expect immediate full Datadog-equivalent managed stack in core milestones.

Mitigation:
- Document managed observability as optional enterprise service track and keep core milestones focused on policy/scoring enforcement.

Final Ruling:
- Added alignment matrix and boundary rules to `.verificaton-before-production-folder/FEATURE_ADDITIONS.md`.
- Updated milestone tracking to include cloud architecture boundary alignment checkpoint.

### Topic: Managed observability scope in near-term roadmap
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Make managed SigNoz/Sentry/Langfuse hosting a mandatory dependency for core extension value.
2. Keep managed observability optional enterprise scope; core extension remains local-first + metadata policy bridge.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Preserves adoption path for local-only users and avoids infrastructure lock-in for free/student tiers. |
| Reviewer B | Option 2 | Aligns with budget-first strategy while still enabling enterprise upsell via managed overlays. |

Decision:
- Implement Option 2.

Rationale:
- User explicitly requested both local-first and cloud options; mandatory managed hosting would conflict with local-first product promise.

Risks:
- Optional model increases documentation needs for mode selection and boundaries.

Mitigation:
- Keep placement matrix and milestone notes explicit; keep command/help UX deterministic and simple.

Final Ruling:
- Managed observability remains enterprise optional track; not a blocker for core MCP cloud scoring milestones.

### Topic: Milestone 13C delivery shape (minimal command aliases vs full lifecycle state sync)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Add lightweight aliases only (`pg login/update/doctor`) without persistent lifecycle state or profile sync.
2. Implement full lifecycle baseline with persisted CLI state, entitlement refresh, doctor diagnostics, and profile handoff into `pg prod`.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | User requested practical command UX and fewer repeated troubleshooting loops. |
| Reviewer B | Option 2 | Entitlement-aware profile sync makes `pg prod` behavior deterministic across sessions. |

Decision:
- Implement Option 2.

Rationale:
- New lifecycle script now supports:
  - `pg login` (auth bootstrap + summary sync),
  - `pg update` (refresh entitlement snapshot/profile),
  - `pg doctor` (PATH/auth/tooling/profile diagnostics).
- Lifecycle state persists in `Memory-bank/_generated/pg-cli-state.json` and syncs `pg_cli_*` keys into local dev profile.
- `pg prod` now auto-resolves recommended profile from lifecycle state when `-ProdProfile` is omitted.

Risks:
- Recommended profile auto-resolution may surprise users expecting hardcoded `standard`.

Mitigation:
- Explicit `-ProdProfile legacy|standard|strict` always overrides lifecycle recommendation.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Self-hosted observability implementation shape (baseline scaffold)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep observability as planning-only docs until a later enterprise phase.
2. Ship a baseline observability adapter bridge now with PG-hosted default and optional enterprise BYOC ownership profile.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | User requested immediate practical path with no vendor lock and default easy onboarding. |
| Reviewer B | Option 2 | Baseline route + command keeps architecture deterministic while deferring full managed stack hosting operations. |

Decision:
- Implement Option 2.

Rationale:
- User wants no vendor lock-in and clear distinction between default PG-hosted mode and enterprise BYOC/on-prem mode.
- Existing policy architecture already supports authenticated server-side deterministic checks and CLI bridge patterns.

Risks:
- Teams may interpret adapter baseline as full Datadog/Sentry feature parity.

Mitigation:
- Keep messaging explicit: baseline is readiness/evidence verification scaffold, not full vendor feature parity.
- Maintain managed observability operations as optional enterprise overlay.

Final Ruling:
- Added `/account/policy/observability/check` server route + evaluator for `otlp|sentry|signoz`.
- Added `pg observability-check` command bridge with profile/adapter flags (`pg-hosted|customer-hosted|hybrid`).
- Updated docs and command help to reflect default PG-hosted onboarding + optional enterprise BYOC.

### Topic: PG Prod rollout defaults (flag-heavy optional checks vs profile-driven defaults)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep optional checks off by default and require long explicit `-Enable*` command flags every run.
2. Add profile-driven defaults so `pg prod` can run with short commands and predictable strictness levels.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | User repeatedly asked for simpler command UX with strict/relaxed behavior control. |
| Reviewer B | Option 2 | Profile defaults reduce operator mistakes and complete the Milestone 13D rollout-defaults gap. |

Decision:
- Implement Option 2.

Rationale:
- `pg prod` now maps optional gates through `-ProdProfile`:
  - `legacy`: dependency + coding only
  - `standard` (default): adds API-contract + DB index maintenance
  - `strict`: adds Playwright smoke
- Explicit `-EnableApiContractCheck`, `-EnableDbIndexMaintenanceCheck`, and `-EnablePlaywrightSmokeCheck` remain available and force each check on.

Risks:
- Stronger defaults can surface new blockers on teams that previously relied on legacy optional checks being skipped.

Mitigation:
- `-ProdProfile legacy` provides controlled fallback for staged rollout windows.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Agent-first as-you-go verification (manual user-run checks vs proactive LLM self-check loop)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep verification mostly user-triggered after implementation finishes.
2. Add a dedicated as-you-go command so the agent runs enforcement/DB/playwright checks proactively during implementation.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces user burden and catches issues while context is fresh. |
| Reviewer B | Option 2 | Aligns with production intent: fix as you build, not after full task completion. |

Decision:
- Implement Option 2.

Rationale:
- User requested agent-run validation loops so students/operators do not have to manually discover and troubleshoot avoidable errors.

Risks:
- Frequent checks can increase runtime/noise.

Mitigation:
- Added `-WarnOnly` mode and changed-file targeting.
- Playwright remains opt-in for UI tasks.

Final Ruling:
- Added `pg self-check` (alias `pg as-you-go-check`) backed by `scripts/self_check.ps1`; updated AGENTS workflow and command docs to require proactive during-work verification.

### Topic: DB-index operator guidance format (minimal hints vs copy/paste remediation + troubleshooting)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep DB-index command output as minimal hints and rely on ad-hoc assistant support.
2. Print explicit copy/paste remediation flow in CLI/help output and mirror the same troubleshooting in Help Center docs.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Students/operators need deterministic self-serve commands without waiting for support chat. |
| Reviewer B | Option 2 | Repeated failures came from PATH/directory/SQL-context confusion; inline troubleshooting reduces loop time. |

Decision:
- Implement Option 2.

Rationale:
- This converts common DB-index recovery steps into first-party runbook output directly in `pg help`, `db-index-check`, and the Narrate Help panel.

Risks:
- Help output can become too long/noisy.

Mitigation:
- Keep guidance scoped to high-frequency DB-index failure signatures only.

Final Ruling:
- Added copy/paste DB-index flow + troubleshooting to `scripts/pg.ps1`, enriched remediation/tips in `scripts/db_index_maintenance_check.ps1`, updated generated plan guidance in `scripts/db_index_fix_plan.ps1`, and mirrored troubleshooting in `extension/src/help/commandHelpContent.ts`.

### Topic: DB maintenance remediation UX (manual guidance only vs generated SQL plan command)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep `db-index-check` findings as report-only and require manual SQL authoring.
2. Add one command that generates explicit SQL remediation plan for extension enablement and unused-index cleanup workflow.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | User requested one-click path from findings to concrete SQL remediation steps. |
| Reviewer B | Option 2 | Deterministic generated SQL reduces operator error and speeds strict-gate recovery. |

Decision:
- Implement Option 2.

Rationale:
- This closes the gap between detection (`db-index-check`) and safe operator action by producing ready-to-run SQL workflow output.

Risks:
- Generated candidate drop SQL could be misused without traffic-window validation.

Mitigation:
- Plan includes mandatory guard checks, explicit constraint checks, and rollback `CREATE INDEX CONCURRENTLY` statements.

Final Ruling:
- Added `pg db-index-fix-plan` and alias `pg db-index-remediate`, backed by `scripts/db_index_fix_plan.ps1`, and wired `db-index-check` to print the quick remediation command when findings exist.

### Topic: DB index maintenance enforcement channel (manual advisory vs production gate-ready)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep index maintenance checks as documentation/advisory only.
2. Add executable diagnostics command and optional strict production/trigger enforcement path.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | User requested full enforcement beyond query syntax checks, including indexing and maintenance hygiene. |
| Reviewer B | Option 2 | Operational DB issues should be surfaced before release; optional strict gate keeps rollout safe. |

Decision:
- Implement Option 2.

Rationale:
- Combines deterministic policy with real runtime DB telemetry checks while preserving opt-in strict rollout.

Risks:
- Databases without `pg_stat_statements` enabled will be blocked when strict gate is enabled.

Mitigation:
- Keep gate optional (`-EnableDbIndexMaintenanceCheck`) and provide direct command (`pg db-index-check`) for staged adoption.

Final Ruling:
- Added `db-index-check` command, `db_index_maintenance_check.ps1`, and optional `pg prod`/`enforce-trigger` strict integration flags.

### Topic: Query-optimization enforcement depth in coding policy gate
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep coding policy focused on structure/style only and treat DB query optimization as documentation-only guidance.
2. Add deterministic database optimization checks directly into coding policy enforcement (`coding-verify` / `pg prod` path).

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | User explicitly requested hard enforcement for N+1, indexing, and slow-query anti-patterns. |
| Reviewer B | Option 2 | Production gates should catch high-impact DB mistakes before deploy, not after runtime profiling. |

Decision:
- Implement Option 2.

Rationale:
- Query and index anti-patterns are high-cost defects that align with existing fail-closed enforcement design.

Risks:
- Heuristic checks can generate false positives in uncommon query-builder patterns.

Mitigation:
- Keep rules deterministic and explainable, with blocker/warning split and explicit rule IDs.

Final Ruling:
- Added query optimization checks and Prisma FK-index signals to server coding policy evaluator and included Prisma/SQL files in default coding scan roots.

### Topic: Playwright smoke integration rollout in `pg prod`
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Make Playwright smoke checks always-on in `pg prod`.
2. Add Playwright smoke as optional strict gate via explicit flag.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | UI smoke setup varies by repo; always-on would block repos without Playwright baseline. |
| Reviewer B | Option 2 | User requested flexibility (strict vs relaxed enforcement), matching API-contract rollout style. |

Decision:
- Implement Option 2.

Rationale:
- Keeps `pg prod` reliable for repos that have not wired Playwright yet, while enabling strict UI smoke enforcement where teams choose it.

Risks:
- Teams might delay smoke coverage by not enabling the flag.

Mitigation:
- Added direct command (`pg playwright-smoke-check` / `pg ui-smoke-check`) and explicit prod flag (`-EnablePlaywrightSmokeCheck`) for CI/prod pipelines.

Final Ruling:
- Added Playwright smoke command bridge and optional `pg prod` hard gate path.

### Topic: `pg prod` API contract gate rollout mode (always-on vs optional flag)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Make API contract gate always-on immediately in `pg prod`.
2. Ship API contract gate as opt-in (`-EnableApiContractCheck`) first, then move to default-on after field validation.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | New policy surface needs real-project calibration to avoid false-positive production blocks. |
| Reviewer B | Option 2 | User asked to continue milestones quickly while preserving team flexibility across enforcement strictness. |

Decision:
- Implement Option 2.

Rationale:
- Keeps production gate adoption safe while still making enforcement available immediately.

Risks:
- Teams may skip the optional gate and delay contract cleanup.

Mitigation:
- Added dedicated command (`pg api-contract-verify`) and explicit `pg prod` flag for CI/prod pipelines.

Final Ruling:
- Added server endpoint `/account/policy/api-contract/verify`, CLI bridge `pg api-contract-verify`, and optional `pg prod -EnableApiContractCheck` enforcement path.

### Topic: Milestone 15B next step sequencing (wrapper extraction depth vs pg prod blocking)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Add `pg prod` contract-blocking first and keep current frontend extraction depth unchanged.
2. Improve frontend extraction depth first (axios wrapper clients + request-config pattern), then add prod blocking.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Better extraction precision should land before hard production blocking to reduce false blockers. |
| Reviewer B | Option 2 | User asked for next milestone continuity and practical mismatch coverage; wrapper depth is the higher-value immediate gap. |

Decision:
- Implement Option 2.

Rationale:
- This improves contract detection accuracy in real projects that use axios wrappers before introducing stricter enforcement gates.

Risks:
- Heuristic extraction still cannot cover all custom wrapper styles.

Mitigation:
- Added support for common wrappers (`axios.create` + `.request({ method, url, data })`) and kept backend-inference fallback active.

Final Ruling:
- API Contract Validator frontend extraction now covers axios wrapper clients and request-config calls; `pg prod` contract gate remains the next optional hardening step.

### Topic: API validator parser depth (JSON-only baseline vs YAML + local schema refs)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep JSON-only OpenAPI parser and defer YAML/`$ref` support to later hardening.
2. Add YAML parsing now and resolve local schema refs (`#/components/schemas/*`) with recursion guard.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Many OpenAPI specs are YAML-first; baseline mismatch reports should not miss those projects. |
| Reviewer B | Option 2 | Local schema refs are common and required for accurate request/response field extraction. |

Decision:
- Implement Option 2.

Rationale:
- This closes the highest-value remaining gap in Milestone 15B without changing UX or command surface.

Risks:
- Recursive refs can create infinite loops if not guarded.

Mitigation:
- Added seen-ref loop protection and local-pointer-only resolution.

Final Ruling:
- API Contract Validator now parses OpenAPI JSON/YAML and resolves local `#/components/schemas/*` refs during schema extraction.

### Topic: API validator UX command naming and handoff workflow
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep only long command name (`Run API Contract Validator`) and manual copy of report for external fix agents.
2. Add short alias (`OpenAPI Check`) and one-click fix handoff prompt command.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Student/new-user command discoverability is better with shorter action name |
| Reviewer B | Option 2 | Direct clipboard handoff reduces friction from mismatch report to implementation fix loop |

Decision:
- Implement Option 2.

Rationale:
- User explicitly requested simple command wording and direct report-to-LLM handoff behavior.

Risks:
- Multiple command names can cause minor duplication confusion.

Mitigation:
- Keep one canonical validator command and expose alias as UX shortcut in Help Center.

Final Ruling:
- Added `Narrate: OpenAPI Check` alias and `Narrate: OpenAPI Fix Handoff Prompt`.

### Topic: Milestone 15B implementation order (API Contract Validator baseline now vs defer)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Defer API Contract Validator until full parser stack (OpenAPI YAML + wrapper inference + prod blocking) is complete.
2. Ship baseline now with OpenAPI-first JSON parsing, backend inference fallback, and explicit mismatch rule IDs.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | User requested direct milestone-by-milestone continuation; baseline gives immediate practical value |
| Reviewer B | Option 2 | OpenAPI-first + fallback aligns with roadmap while keeping deterministic, explainable findings |

Decision:
- Implement Option 2.

Rationale:
- The project already has Trust/Dead-Code/Doctor checks; API contract validation is the next high-impact blocker category.
- A baseline command unblocks usage today without waiting for full enterprise hardening steps.

Risks:
- JSON-only OpenAPI parsing misses YAML specs in some projects.
- Wrapper-based API clients may reduce frontend-call extraction coverage.

Mitigation:
- Keep backend-inference fallback active.
- Document remaining scope in milestone notes for next iteration.

Final Ruling:
- Added `Narrate: Run API Contract Validator` baseline with rule IDs (`API-REQ-001`, `API-REQ-002`, `API-TYPE-001`, `API-RES-001`).

### Topic: Milestone 15A delivery shape (Codebase Tour baseline now vs defer)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep Codebase Tour as planned-only and move to later milestone window.
2. Ship baseline command now with markdown architecture map + configurable scan scope.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | User requested next milestone progression immediately and needs discoverable onboarding output now |
| Reviewer B | Option 2 | Baseline command is low-risk, local-first, and aligns with trust/dead-code workflow already in extension |

Decision:
- Implement Option 2.

Rationale:
- Current roadmap had 15A planned; user asked to continue milestone-by-milestone without pause.
- Baseline command delivers immediate value (entrypoints/routes/dependencies/coupling map) without blocking later visualization upgrades.

Risks:
- Heuristic entrypoint scoring can be imperfect in unusual project layouts.

Mitigation:
- Keep include/exclude/max-file settings configurable and document report as guided map, not a strict authority.

Final Ruling:
- Added `Narrate: Generate Codebase Tour` baseline with settings + help integration.

### Topic: PG Push dead-code gate remediation UX (block only vs fix+recheck)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep PG Push dead-code gate as block/warn only with report links.
2. Add in-gate `Apply Safe Fixes + Recheck` action so users can remediate without leaving push flow.
