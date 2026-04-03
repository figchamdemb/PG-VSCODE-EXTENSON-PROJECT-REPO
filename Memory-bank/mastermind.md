# Mastermind - Decisions & Verification (Append-Only)

LAST_UPDATED_UTC: 2026-03-12 08:22
UPDATED_BY: codex

## Decision Log

> Older entries archived to `Memory-bank/_archive/mastermind-archive-20260312-065258.md` on 2026-03-12 06:52 UTC.

### Topic: Frontend design enforcement source of truth for UI tasks
Date_UTC: 2026-03-12
Owner: codex

> Older entries archived to `Memory-bank/_archive/mastermind-archive-20260313-002755.md` on 2026-03-13 00:27 UTC.

| Reviewer B | Option 2 | User safety requirement favors non-destructive automation with measurable before/after report |

Decision:
- Implement Option 2.

Rationale:
- Next-step implementation should speed cleanup without introducing brittle destructive edits.

Risks:
- Organize-imports does not resolve all dead-code findings (for example, unused locals/functions).

Mitigation:
- Re-run scan and show before/after delta; keep remaining findings explicit for manual review.

Final Ruling:
- Added `Narrate: Apply Safe Dead Code Fixes` for imports-only safe autofix path with post-fix rescan report.

### Topic: Dead-code cleanup execution workflow (branch-first safety)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep cleanup as manual scan + manual git steps only.
2. Add one command to create/switch cleanup branch and open dead-code report in that branch.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces cleanup friction and avoids accidental direct changes on feature/release branches |
| Reviewer B | Option 2 | Matches safety requirement: detect first, branch isolate, then clean incrementally |

Decision:
- Implement Option 2.

Rationale:
- User asked to continue to next step after strict gate rollout and wanted safe cleanup flow before push.

Risks:
- Branch command can still carry current uncommitted changes.

Mitigation:
- Added explicit warning/confirmation when workspace is dirty before branch switch/create.

Final Ruling:
- Added `Narrate: Create Dead Code Cleanup Branch` command (create/switch branch + run scan + open report).

### Topic: Dead-code gate default mode for this repository profile
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep repo profile on non-blocking dead-code mode (`off` or `relaxed`).
2. Set repo profile default to strict dead-code gate while allowing manual fallback to relaxed.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Team asked for clean-before-push behavior and explicit enforcement of high-confidence unused code findings |
| Reviewer B | Option 2 | Workspace-level setting gives strict behavior for this repo without forcing global extension defaults |

Decision:
- Implement Option 2.

Rationale:
- User confirmed strict repo profile is desired after gate rollout.

Risks:
- Strict mode may block pushes during legacy cleanup periods.

Mitigation:
- Relaxed mode remains one setting change away for temporary migration windows.

Final Ruling:
- Set `.vscode/settings.json` to `narrate.deadCodeScan.pgPushGateMode = strict` for this repository profile.

### Topic: Dead-code enforcement behavior during PG Push
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep dead-code scan as manual report only and do not enforce during push.
2. Add configurable PG Push dead-code gate (`off|relaxed|strict`) that blocks only on high-confidence findings.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Users asked for pre-push cleanliness enforcement without risking auto-delete of runtime-critical code |
| Reviewer B | Option 2 | High-confidence diagnostics are safe to gate; medium/low heuristics should remain advisory |

Decision:
- Implement Option 2.

Rationale:
- User explicitly approved adding dead-code gate after baseline scan delivery.
- Confidence split allows strict enforcement on deterministic findings while preserving safe manual review for heuristics.

Risks:
- TypeScript diagnostics can occasionally be stale in editor state.

Mitigation:
- Keep relaxed mode and existing TS restart/refresh command path for stale diagnostics.
- Gate only on high-confidence findings, not medium/low orphan heuristics.

Final Ruling:
- PG Push now supports `narrate.deadCodeScan.pgPushGateMode` (`off`, `relaxed`, `strict`) and blocks in strict mode when high-confidence dead-code findings are present.

### Topic: Dead-code cleanup safety model (candidate report vs auto-delete)
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Auto-delete all detected unused code before PG push.
2. Ship confidence-tiered dead-code candidate scan (report-only), keep deletion manual with compile/test verification.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Static analysis cannot guarantee 100% unused certainty in dynamic runtime patterns; auto-delete risks regressions |
| Reviewer B | Option 2 | Teams still need immediate visibility; report-first gives cleanup signal without destructive behavior |

Decision:
- Implement Option 2.

Rationale:
- User asked how the system can know if code is truly unused and requested safe cleanup flow before push.
- High-confidence signals should come from compiler diagnostics; import-graph orphaning should remain heuristic.

Risks:
- Medium/low-confidence orphan detection can produce false positives for dynamic loaders/framework discovery.

Mitigation:
- Label findings by confidence (`high`, `medium`, `low`) and never auto-delete.
- Require rerun of compile/tests after manual cleanup batches.

Final Ruling:
- Added `Narrate: Run Dead Code Scan` with confidence-tiered report-only output and no destructive code actions.

### Topic: Trust Score rollout next step after single-file scoring
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep Trust Score limited to active-file only and defer workspace view.
2. Add workspace aggregate scan command with actionable summary report now.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Teams need project-level signal before push/release; single-file view hides cross-file blocker concentration |
| Reviewer B | Option 2 | Aligns with planned milestone remainder and gives immediate product value with low implementation risk |

Decision:
- Implement Option 2.

Rationale:
- User asked to continue immediately and this was the next pending Trust milestone item.
- Aggregate report enables faster triage and more visible red/yellow/green project health.

Risks:
- Large workspaces can make scan slower.

Mitigation:
- Added scan max-file and include/exclude glob settings to control runtime cost.

Final Ruling:
- Added `Narrate: Run Trust Score Workspace Scan` with configurable scope and markdown summary output.

### Topic: Trust recovery popup flow + validation install auto-path
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep Trust guidance as report-only text and manual command discovery.
2. Add one-click recovery/install UX in-product (TS restart+refresh command, diagnostics popup action, validation install action with Zod fast path).

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Users need visible recovery actions when Problems tab is stale; report-only guidance is too easy to miss |
| Reviewer B | Option 2 | Validation policy is useful only if setup path is immediate and discoverable for new projects |

Decision:
- Implement Option 2.

Rationale:
- User requested explicit popup/policy guidance for stale TypeScript diagnostics and enforceable validation setup.
- One-click commands reduce friction and avoid repeated manual debugging loops.

Risks:
- Frequent popups can feel noisy.

Mitigation:
- Keep existing debounce/setting guards (`showDiagnosticsRecoveryHint`, `autoSuggestValidationInstall`) and surface explicit commands in Trust panel/help.

Final Ruling:
- Added `Narrate: Restart TypeScript + Refresh Trust Score`.
- Wired diagnostics/trust/push flows to offer one-click recovery.
- Extended validation setup flow with direct `Install Zod Now` path plus library picker.

### Topic: Zod/input-validation enforcement baseline in local trust + server coding policy
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep validation checks as planned-only and defer enforcement to later milestone.
2. Add immediate missing-input-validation blocker detection now (Zod or equivalent signal) in both Trust Score and coding standards verifier.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | TypeScript pass alone cannot guarantee runtime input safety; immediate blocker gives practical production protection |
| Reviewer B | Option 2 | User explicitly requested Zod policy clarity before moving on |

Decision:
- Implement Option 2.

Rationale:
- Runtime payload safety requires schema validation checks independent of static TS compile success.
- Minimal deterministic pattern-based baseline is low-risk and useful immediately.

Risks:
- Heuristic detection can false-positive on projects using external/global validation patterns not visible in the file.

Mitigation:
- Treat as baseline with Zod-or-equivalent signals (not Zod-only), and refine with profile-aware/server-policy integration in next iteration.

Final Ruling:
- Added missing-input-validation blocker rules to extension Trust Score and server coding standards verification.

### Topic: Trust Score enforcement mode for PG Push
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Always hard-block PG Push when Trust Score has blockers/red status.
2. Add configurable gate mode with `off`, `relaxed`, and `strict`.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Teams need staged rollout; strict-only can disrupt adoption on legacy codebases |
| Reviewer B | Option 2 | Matches user request for toggleable enforcement and explicit relax mode |

Decision:
- Implement Option 2.

Rationale:
- User requested strict enforcement availability without forcing all users into blocking mode.
- This preserves enforcement power while supporting practical team migration.

Risks:
- Relaxed mode can allow risky pushes if teams ignore warnings.

Mitigation:
- Keep strict mode available and document clear behavior in settings/help.
- Keep status bar/panel visibility high to reduce accidental ignores.

Final Ruling:
- PG Push now supports `narrate.trustScore.pgPushGateMode = off | relaxed | strict`.

### Topic: Trust Score policy enforcement + panel UX rollout
Date_UTC: 2026-02-27
Owner: codex

Options:
1. Keep Trust Score as lightweight status-bar heuristic only (report command required).
2. Expand Trust Score into coding-standard enforcement with explicit UI panel + toggle/refresh actions.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | User flow requires visible pass/fail path without command-palette dependence and must enforce architecture standards beyond TS diagnostics |
| Reviewer B | Option 2 | Policy-driven local checks (`500`/`150`/controller constraints) are aligned with existing standards docs and improve explainability |

Decision:
- Implement Option 2.

Rationale:
- User explicitly requested standard enforcement (controller boundaries, line limits, anti-pattern guards) and stronger visual UX.
- Sidebar panel + title-bar actions provide discoverable controls for students.

Risks:
- Local heuristic implementation can still differ from full server policy profile.
- Additional checks can increase warning volume on legacy files.

Mitigation:
- Keep rule-ID output deterministic and visible in panel/report.
- Support manual mode via `narrate.trustScore.autoRefreshOnSave=false` plus explicit refresh command.

Final Ruling:
- Trust Score now includes local coding-standard enforcement and dedicated panel UX (toggle/refresh/report/findings navigation).

### Topic: Environment Doctor quick-fix and Trust Score baseline rollout
Date_UTC: 2026-02-26
Owner: codex

Options:
1. Keep Environment Doctor report-only and defer all remediation/trust scoring to later milestones.
2. Add immediate quick-fix for `.env.example` plus start deterministic Trust Score baseline now.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Converts report output into action and gives visible quality signal in daily coding loop |
| Reviewer B | Option 2 | Low implementation risk with strong user value and clean path to server-policy integration later |

Decision:
- Implement Option 2.

Rationale:
- User requested immediate continuation and milestone progression, including practical quick-fix behavior.
- Deterministic local scoring and `.env.example` autofill are safe to run locally without external API dependency.

Risks:
- Local-only trust heuristics can differ from full server policy evaluations.
- Auto-appended `.env.example` placeholders may require manual cleanup for edge cases.

Mitigation:
- Keep trust findings rule-ID based and clearly labeled as baseline.
- Use explicit placeholder value `__REQUIRED__` and keep quick-fix opt-in by user action.

Final Ruling:
- Added commands `Narrate: Environment Doctor Quick Fix (.env.example)` and `Narrate: Show Trust Score Report`, plus on-save trust status-bar baseline.

### Topic: Scalability architecture ask-before-build enforcement placement
Date_UTC: 2026-02-26
Owner: codex

Options:
1. Keep scalability architecture guide as optional reference only.
2. Promote guide into enforced planning policy for real-time/async/comms features and add milestone-backed rollout.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Prevents AI from defaulting to easy but non-scalable patterns and forces explicit architecture intent |
| Reviewer B | Option 2 | Fits enterprise quality model and reduces expensive rework from premature stack choices |

Decision:
- Implement Option 2.

Rationale:
- User requirement is explicit: AI should ask discovery questions and co-decide scalable architecture before building.
- This aligns with existing dependency/coding enforcement model and can be layered as server-private policy profile.

Risks:
- Overly strict gating can slow small prototype workflows.
- Questionnaire fatigue if applied to every trivial task.

Mitigation:
- Scope gate to architecture-affecting tasks (real-time, async jobs, inter-service communication, state distribution).
- Keep lightweight bypass for clearly non-scalable toy/prototype tasks with explicit user acknowledgement.

Final Ruling:
- Added guide into verification folder and added Milestone 10N for policy-vault/server-enforced rollout.

### Topic: Slack command grammar hardening in Help Center
Date_UTC: 2026-02-25
Owner: codex

Options:
1. Keep label-based examples (`approve`, `needs-change`) in vote commands.
2. Use key-based examples (`opt1`, `opt2`) and explicitly require slash command as first token.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Prevents invalid option-key errors and lowers operator confusion |
| Reviewer B | Option 2 | Matches backend parser behavior and observed Slack usage failures |

Decision:
- Implement Option 2.

Rationale:
- Backend thread creation returns option keys (`opt1/opt2/...`) and vote/decide reference those keys.
- Slack composer can fail to trigger slash parsing when text precedes `/pg`.

Risks:
- Existing screenshots/docs may still show old examples.

Mitigation:
- Update extension Help Center commands + troubleshooting and sync Memory-bank command docs in same session.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Extension-native startup enforcement for nested repo contexts
Date_UTC: 2026-03-13
Owner: codex

Options:
1. Keep startup enforcement as docs-only plus later hooks/checks.
2. Add a Narrate extension-native startup guard that detects the nearest `AGENTS.md` / `pg.ps1` context, auto-runs `.\pg.ps1 start -Yes`, and reruns on context change.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | The user explicitly wants missed nested-repo startup to become a runtime-enforced path instead of a soft checklist. |
| Reviewer B | Option 2 | Auto-running startup per context/day inside Narrate closes the real failure mode while keeping hooks/scripts as a backstop. |

Decision:
- Implement Option 2.

Rationale:
- The current docs/hook model catches mistakes too late for extension-based agent workflows.
- The main requested fix is to rerun startup automatically when moving into a new nested repo/subproject context.

Risks:
- Startup can fail noisily when the local API/server is down.
- Narrate cannot automatically control unrelated third-party chat extensions that do not integrate with it.

Mitigation:
- Keep visible pass/fail state and a manual retry command inside Narrate.
- Keep the repo docs honest that third-party agent enforcement still depends on integration support.

Final Ruling:
- Option 2 approved and implemented in Narrate runtime, with documentation updated to describe the remaining third-party boundary accurately.

### Topic: Help Center diagnostics execution model
Date_UTC: 2026-02-25
Owner: codex

Options:
1. Keep diagnostics as manual command list only inside help text.
2. Add one-click command that executes key checks and produces a structured report.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces operator mistakes and speeds incident triage |
| Reviewer B | Option 2 | Improves student/team onboarding by validating setup in one action |

Decision:
- Implement Option 2.

Rationale:
- Users repeatedly hit the same setup/runtime errors.
- Automated diagnostics gives deterministic pass/fail output and immediate fix guidance.

Risks:
- Diagnostics can fail noisily if backend is intentionally offline.

Mitigation:
- Report includes clear fix hints and distinguishes health/token/worker failures.

Final Ruling:
- Add `Narrate: Run Command Diagnostics` and surface it from the Help Center.

### Topic: Command Help Center delivery shape (sidebar now vs docs-only defer)
Date_UTC: 2026-02-24
Owner: codex

Options:
1. Keep help only in Memory-bank/docs and defer extension UI help until final hardening.
2. Ship extension sidebar Help Center now with real commands + troubleshooting mapped to observed failures.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Users are blocked by command syntax and state issues, not missing backend capability |
| Reviewer B | Option 2 | Low implementation risk and immediate UX gain for student/team onboarding |

Decision:
- Implement Option 2.

Rationale:
- Current failures are operational (`<THREAD_ID>` parsing, token state, backend down, Slack dispatch) and need in-product guidance.
- Sidebar help keeps local-first model and reduces repeated support loops.

Risks:
- Help content can drift from command behavior.

Mitigation:
- Treat help page as versioned product surface and update it with command-surface changes in the same milestone.

Final Ruling:
- Sidebar command help baseline is implemented now; optional web-hosted mirror remains a follow-up.

### Topic: Local dev credential profile boundary (developer speed vs secret safety)
Date_UTC: 2026-02-24
Owner: codex

Options:
1. Keep credentials only in `.env` and docs; no local dev profile support.
2. Allow a dedicated local dev profile file for test/runtime hints, but enforce local-only storage and no-secrets-in-docs guardrails.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Prevents agent/test loops from missing tool/DB context while keeping production secret model unchanged |
| Reviewer B | Option 2 | Matches local-first workflow and reduces setup friction for students/dev teams |

Decision:
- Implement Option 2.

Rationale:
- Development agents need stable local tool/runtime metadata and test credentials to validate flows.
- Production credentials must still be controlled by `.env`/vault + production gates.

Risks:
- Users could accidentally paste live credentials into Memory-bank/docs.

Mitigation:
- Keep profile file in gitignored `.narrate/dev-profile.local.json`.
- Add gitignore-policy check in `pg dev-profile check`.
- Add pre-commit guard scan for likely real secrets/private keys in staged Memory-bank/verification docs.

Final Ruling:
- Local dev profile is approved for development-only use; no production secret storage outside `.env`/vault.

### Topic: Dedicated command help page timing and scope
Date_UTC: 2026-02-24
Owner: codex

Options:
1. Defer user-facing help page until after final product hardening.
2. Add a dedicated command-help milestone now and implement immediately after current Slack/Narrate closure items.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Current user errors are mostly operational (`<THREAD_ID>` placeholders, token state, server-not-running) and are blocking adoption more than missing backend capability |
| Reviewer B | Option 2 | Low-cost, high-impact UX layer for students and new teams; reduces support load and failed setup loops |

Decision:
- Implement Option 2.

Rationale:
- The platform already has working command surfaces, but discoverability and correct usage are weak.
- A clear in-product Help Center keeps local-first architecture intact while making governance workflows usable without trial-and-error.

Risks:
- Help docs can drift from runtime behavior as commands evolve.

Mitigation:
- Treat Help Center content as versioned product surface linked to `tools-and-commands.md` and updated in the same release as command changes.

Final Ruling:
- Add Milestone 10L for Command Help Center (quickstart, decision workflow, expected outputs, troubleshooting matrix).

### Topic: Governance approval execution mapping model (manual commands vs playbook allowlist bindings)
Date_UTC: 2026-02-24
Owner: codex

Options:
1. Keep global decision command overrides only (`approve_command` / `needs_change_command` / `reject_command`).
2. Add thread-scoped bindings (`thread_id -> action_key`) that resolve commands from an allowlisted local playbook, with global overrides kept as fallback.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Gives real approval-to-action automation while avoiding arbitrary command injection through ad-hoc strings |
| Reviewer B | Option 2 | Cleaner enterprise model: predictable action catalog + auditable binding per decision thread |

Decision:
- Implement Option 2.

Rationale:
- User requested that approve decisions should be able to continue work automatically.
- Playbook + binding keeps local-first execution and improves security/operability.

Risks:
- Misbound thread/action pairs can run wrong workflow.
- Stale playbook path could break local execution.

Mitigation:
- Added `pg governance-bind -List/-Remove` for visibility/control.
- Worker falls back to default handler when playbook loading fails.
- Ack note records command source and action key for audit.

Final Ruling:
- Option 2 approved and implemented as 10K baseline extension.

### Topic: Extension-native governance auto-consumer rollout mode (10K baseline)
Date_UTC: 2026-02-24
Owner: codex

Options:
1. Keep local governance consumption manual-only (`pg governance-worker -Once` by hand).
2. Add extension-native auto-sync loop with configurable interval plus manual sync command for deterministic one-shot pull/apply/ack.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Converts Slack/server approval into near-real-time local execution without introducing cloud-side code execution risk |
| Reviewer B | Option 2 | Keeps local-first security model while giving teams an operationally usable flow |

Decision:
- Implement Option 2.

Rationale:
- User requested end-to-end behavior where approval in Slack/server can be picked up by local agent runtime without manual polling every time.
- Local execution remains in trusted workstation context and ack is still recorded server-side for audit.

Risks:
- Poll loop can produce noise if backend mode/token is missing.
- Misconfigured intervals can be too aggressive on weak devices.

Mitigation:
- Added config controls: enable/disable, interval seconds, backend-mode requirement, dry-run, and notification behavior.
- Kept explicit manual command (`Narrate: Governance Sync Now`) for deterministic operator-triggered runs.

Final Ruling:
- Option 2 approved and implemented as 10K baseline.

### Topic: Extension enforcement wiring mode (save hook + PG push preflight)
Date_UTC: 2026-02-24
Owner: codex

Options:
1. Keep enforcement checks CLI-only and rely on manual runs (`pg prod`, `enforce-trigger`).
2. Wire extension runtime hooks: post-write trigger on save and pre-push preflight in `Narrate: PG Push`, with warn-first defaults.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces missed checks and keeps quality feedback close to developer flow |
| Reviewer B | Option 2 | Warn-first mode preserves usability while enforcement rules mature on legacy files |

Decision:
- Implement Option 2.

Rationale:
- User asked to continue directly on the next important item and prioritize real enforcement usage.
- Existing trigger engine already existed; extension wiring was the missing practical adoption step.

Risks:
- Legacy large files can raise many blockers/noise during early rollout.
- Missing local token/server can cause enforcement runtime errors in dev loop.

Mitigation:
- Keep post-write default in warn mode and configurable debounce.
- Keep pre-push enforcement configurable, and retain hard gate in dedicated `pg prod` command.

Final Ruling:
- Option 2 approved and implemented for baseline.

### Topic: Trust score and API validator implementation strategy
Date_UTC: 2026-02-24
Owner: codex

Options:
1. Build trust score as heuristic-only UI and API validator as backend-parser-only.
2. Build trust score from deterministic policy findings (rule-ID based) and API validator as OpenAPI-first with backend-parser fallback.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Keeps scoring explainable/auditable and aligns with enforcement model already chosen |
| Reviewer B | Option 2 | OpenAPI-first reduces false positives and directly solves frontend/backend mismatch pain in real projects |

Decision:
- Implement Option 2.

Rationale:
- User needs trust score to explain exactly why code fails standards (e.g., controller/service limits, validation gaps).
- User explicitly highlighted API contract mismatch pain and requested Swagger/OpenAPI mapping support.

Risks:
- Some projects lack OpenAPI specs.
- Overly strict scoring can produce noisy red status on legacy repos.

Mitigation:
- Use backend-inference fallback when OpenAPI is unavailable.
- Keep score weighted and surface top actionable blockers first.

Final Ruling:
- Option 2 approved. Trust score is policy-driven; API validator is OpenAPI-first with fallback parsing.

### Topic: Feature additions split (core extension vs standalone products)
Date_UTC: 2026-02-23
Owner: codex

Options:
1. Add all proposed features directly into the current extension roadmap.
2. Keep high-synergy trust/safety features in core, and spin out high-maintenance/orthogonal features into separate extensions later.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Prevents core product bloat and keeps delivery focused on trust + enforcement differentiator |
| Reviewer B | Option 2 | Reduces maintenance cost and enables faster release cadence for core roadmap |

Decision:
- Implement Option 2.

Rationale:
- Current product mission is local-first AI quality + governance, so features tightly coupled to trust and production safety stay in core.
- Features with separate maintenance burden (multi-template bootstrap, cost-reporting dashboards, large dead-code workflows) are better as standalone-first products.

Approved Core Features:
- Environment Doctor
- AI Trust Score
- Commit Quality Gate
- Codebase Tour Generator
- API Contract Validator (Team/Enterprise)

Standalone-first Candidates:
- Dead Code Cemetery
- One-Click Project Setup
- Tech Debt Counter ($)

Risks:
- Delaying standalone candidates could leave user-requested value on hold.
- Too much added to core could still slow roadmap if sequencing is not enforced.

Mitigation:
- Place core additions as post-enforcement milestones (after 10I/10J).
- Create Milestone 18 packaging gate for standalone extraction decisions and timeline lock.

Final Ruling:
- Option 2 approved. Core roadmap adds trust/safety features first; standalone candidates are planned as separate products after Milestone 18 gate.

### Topic: Enforcement-first milestone ordering before extension-native automation
Date_UTC: 2026-02-23
Owner: codex

Options:
1. Start extension-native background auto-consumer wiring first, then add dependency/coding enforcement later.
2. Complete enforcement baseline first (dependency verification + coding standards + trigger/anti-exfil guardrails), then start extension-native wiring only after those gates pass in this repo.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Prevents local agent automation from applying low-quality changes before guardrails are live |
| Reviewer B | Option 2 | Matches user priority: enforcement is core IP and quality gate, not an optional add-on |

Decision:
- Implement Option 2.

Rationale:
- User requested strict enforcement before extension-native automation so agent output is consistently bounded by dependency and coding standards.
- This keeps current delivery sequence pragmatic: close Slack and Narrate validation first, then turn on enforcement gates, then wire extension-native background execution.

Risks:
- Extension-native automation timeline shifts slightly later.
- Early enforcement may surface blockers in existing code that require refactors.

Mitigation:
- Timebox Milestones 10H-10J and run incremental scans (start-session, post-write, pre-push) before full `pg prod` strict mode.
- Keep blocker feedback rule-ID based and actionable so fixes are quick.

Final Ruling:
- Option 2 approved: enforcement baseline is a hard prerequisite for Milestone 10K extension-native auto-consumer work.

### Topic: Policy-exfiltration and jailbreak response model
Date_UTC: 2026-02-23
Owner: codex

Options:
1. Immediate automatic ban on any suspected policy extraction/bypass prompt.
2. Risk-based staged response: detect, log, soft-block, temporary restriction, then manual escalation/suspension for repeat or severe abuse.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Immediate bans create high false-positive risk and poor trust for legitimate users asking clarifications |
| Reviewer B | Option 2 | Staged controls preserve security while keeping enforcement auditable and fair |

Decision:
- Implement Option 2.

Rationale:
- User requested strong protection against jailbreak/emoji-obfuscated extraction while maintaining practical operations.
- Security needs high signal quality and auditable escalation path.

Risks:
- Under-tuned detectors may miss sophisticated bypass prompts.
- Over-tuned detectors may restrict benign prompts.

Mitigation:
- Keep detector rule packs server-side and continuously tune from audit feedback.
- Require manual admin review for account suspension decisions.

Final Ruling:
- Option 2 approved: staged enforcement with risk scoring and audit trail, not immediate auto-ban.

### Topic: Coding standards policy merge and enforcement visibility model
Date_UTC: 2026-02-23
Owner: codex

Options:
1. Expose full coding policy internals (all thresholds/profiles/scoring) directly to local users and apply one-size-fits-all strict limits.
2. Keep canonical policy server-private, expose opaque rule IDs + minimal remediation hints, and enforce framework-profile-specific thresholds.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Protects IP while keeping deterministic enforcement and reducing false positives from universal thresholds |
| Reviewer B | Option 2 | Aligns with dependency policy boundary and supports per-framework quality rules without overloading unrelated projects |

Decision:
- Implement Option 2.

Rationale:
- User requested strict enforcement with hidden private logic and profile relevance (Java project should not load Next.js rules).
- Dual-threshold approach (`target` warning + `hard` blocker) resolves 80-vs-150 style conflicts between drafts.

Risks:
- Too little user feedback can reduce developer trust in enforcement outcomes.
- Profile detection mistakes in monorepos can apply wrong rule packs.

Mitigation:
- Return stable rule IDs with concise remediation hints and file anchors.
- Add folder-level profile mapping override in project config for monorepos.

Final Ruling:
- Option 2 approved for roadmap implementation (policy vault + profile-aware enforcement + opaque rule IDs).

### Topic: Approval-to-action local worker automation baseline
Date_UTC: 2026-02-23
Owner: codex

Options:
1. Keep decision sync as manual review only (`pull` + human action + optional manual ack).
2. Add local worker baseline that maps approved decisions to local commands and auto-acks execution result.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Enables real team workflow where manager approval can immediately continue local agent work without waiting for manual sync steps |
| Reviewer B | Option 2 | Preserves local-first execution while keeping server audit (`pending -> applied/conflict/skipped`) and Slack visibility |

Decision:
- Implement Option 2.

Rationale:
- User requested direct path from Slack governance approval to local agent continuation.
- Keeps cost low: decision logic remains server-side, execution remains local.

Risks:
- Misconfigured local command mapping can produce `conflict` ack outcomes.

Mitigation:
- Provide default handler script and explicit worker commands in `tools-and-commands.md`.
- Keep execution status/note in ack payload and Slack follow-up visibility.

Final Ruling:
- Option 2 approved and implemented (`pg governance-login`, `pg governance-worker`, local handler script).

### Topic: Expose concrete team role in Slack governance cards
Date_UTC: 2026-02-23
Owner: codex

Options:
1. Keep generic labels (`reviewer`, `voter`) only.
2. Show concrete role (`owner|manager|member`) and map it to permission text in Slack UI.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Removes ambiguity and makes finalize permissions auditable in-channel |
| Reviewer B | Option 2 | Helps teams validate role wiring without opening admin portal |

Decision:
- Implement Option 2.

Rationale:
- User requested clear understanding of why one account can vote + finalize while others can only vote.

Risks:
- Role labels could be stale if membership changes after a card is posted.

Mitigation:
- Keep `Refresh Thread` action and server-side permission checks as source-of-truth for each click.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Slack governance card UX for vote vs finalize responsibilities
Date_UTC: 2026-02-23
Owner: codex

Options:
1. Keep both vote and finalize buttons visible to all thread participants and rely on backend authorization errors.
2. Render role-aware Slack cards: voter-only controls for voters, finalize controls only for users with finalization rights, plus explicit workflow text.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces confusion and aligns with intended governance model (team votes, reviewer finalizes) |
| Reviewer B | Option 2 | Prevents avoidable unauthorized clicks and improves Slack usability for non-manager seats |

Decision:
- Implement Option 2.

Rationale:
- User requested clearer separation between voting and reviewer approval responsibilities.
- Backend already enforced permissions; UI now mirrors those rules to avoid mixed mental model.

Risks:
- Role-aware rendering depends on accurate user/team membership resolution per Slack action.

Mitigation:
- Keep backend authorization checks as source-of-truth and treat UI gating as additional clarity layer, not sole security control.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Slack interactive button timeout handling model
Date_UTC: 2026-02-23
Owner: codex

Options:
1. Keep synchronous fallback on `/integrations/slack/actions` when `response_url` is missing.
2. Fast-ack every action click and move user resolution + governance action execution to async path, with `chat.postEphemeral` fallback when `response_url` is absent.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Guarantees Slack 3-second SLA on button clicks and prevents `Operation timed out` UX failures |
| Reviewer B | Option 2 | Preserves button-first UX while keeping result delivery possible even without `response_url` |

Decision:
- Implement Option 2.

Rationale:
- Live button-click testing surfaced Slack 3-second timeout behavior that can occur before DB/auth work completes.
- Immediate ack on ingress is required for reliable interactive UX.

Risks:
- Async follow-up can still fail if Slack API rejects fallback ephemeral post.

Mitigation:
- Keep detailed server logs for async action failures and preserve slash-command fallback (`decide`) as operational backup.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Dependency verification enforcement placement and visibility model
Date_UTC: 2026-02-22
Owner: codex

Options:
1. Ship full dependency verification policy (deny-list, registry mapping, compatibility matrices, scoring logic) in local repo/agent-visible files.
2. Keep canonical dependency verification policy and evaluation logic server-side/private, expose only enforcement results/reason codes to local clients, and hard-fail `pg prod` on violations.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Protects IP and prevents users/agents bypassing private policy details while still enforcing quality gates |
| Reviewer B | Option 2 | Aligns with fail-closed production posture and supports centralized updates for deprecated/vulnerable dependencies |

Decision:
- Implement Option 2.

Rationale:
- User requires strict dependency verification as a top-tier blocker and wants core logic hidden from end users.
- A server-private policy dataset allows fast deny-list and compatibility updates without local bundle exposure.

Risks:
- Registry/doc source outages can block verification at runtime.
- Overly strict checks may increase false positives without clear remediation output.

Mitigation:
- Add signed cached policy snapshots with bounded staleness windows.
- Return deterministic blocker reason codes and migration suggestions to CLI/extension output.

Final Ruling:
- Option 2 approved. Canonical dependency policy remains server-private; `pg prod` fails closed when dependency verification fails.

### Topic: Cost-effective rollout order for production-readiness package (cloud-first vs offline-first)
Date_UTC: 2026-02-22
Owner: codex

Options:
1. Build offline encrypted policy-pack mode first for all tiers.
2. Finish current Slack + Narrate validation first, then ship cloud-first policy/scoring for Free/Student/Team and reserve encrypted offline pack for Enterprise add-on.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Lowest delivery risk and fastest path to monetizable quality gate while protecting core IP on server |
| Reviewer B | Option 2 | Keeps cost profile low for Free/Student/Team and defers heavier offline crypto operations to enterprise contract path |

Decision:
- Implement Option 2.

Rationale:
- User requested a cost-efficient commercialization path without blocking current milestone closure.
- Cloud-first preserves strongest IP protection for most users because checklist/scoring logic stays server-side.
- Enterprise offline mode still remains available for strict no-network environments, but should follow only after cloud path is stable.

Risks:
- Non-enterprise users depend on cloud scoring availability for premium checks.
- Delayed offline pack may postpone one enterprise sales scenario.

Mitigation:
- Keep deterministic local baseline checks available when cloud scoring is unavailable.
- Prioritize Milestones 10F/10G first, then implement MCP standard cloud bridge and entitlement packaging before offline pack.

Final Ruling:
- Option 2 approved. Sequence: close Slack + Narrate validation -> cloud-first rollout (Free/Student/Team) -> enterprise offline encrypted add-on.

### Topic: Framework skills/checklist IP protection and enforcement channel
Date_UTC: 2026-02-22
Owner: codex

Options:
1. Keep framework/checklist markdown files directly in repo and let agents read them locally.
2. Move framework/checklist assets behind server-side enterprise policy storage and expose only signed summaries + rule checks to clients.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Protects IP and prevents direct file scraping/cloning from client machines |
| Reviewer B | Option 2 | Supports tenant-specific overrides while keeping global baseline private |

Decision:
- Implement Option 2 as the target architecture.

Rationale:
- User requires the framework standards/checklists to remain private IP while still enforcing agent behavior for enterprise/team/student plans.

Risks:
- Enforcement can become expensive if every step requires LLM calls.

Mitigation:
- Use deterministic rule evaluation (no LLM required for core checks) and return compact rule summaries/actions.
- Keep tenant overlays small and versioned; compile effective policy server-side.

Final Ruling:
- Option 2 approved. Begin with server private-policy module + signed summary endpoint + entitlement-gated access levels.

### Topic: Prisma runtime persistence shape and Slack reviewer interaction surface
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Keep single `runtime_state` row persistence for Prisma mode and postpone Slack interactive callbacks.
2. Persist runtime state table-by-table in Postgres now and complete signed Slack interactive action handling (`/integrations/slack/actions`) with vote/decision buttons.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Eliminates runtime-state-row bottleneck and aligns with requested real DB migration |
| Reviewer B | Option 2 | Enables reviewer approvals directly in Slack with signed callbacks and no frontend-only trust |

Decision:
- Implement Option 2.

Rationale:
- User requested full Prisma migration and actionable Slack governance workflow in current phase.

Risks:
- Table-by-table rewrite can be heavier than incremental writes under high volume.

Mitigation:
- Keep this as baseline for correctness now; optimize hot tables to incremental updates in production hardening.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Immediate rollout order for live testing (Prisma mode + Cloudflare lock + Slack commands)
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Delay implementation and only run manual tests on existing JSON/toggle baseline.
2. Implement now: runtime Prisma store mode, optional Cloudflare admin JWT gate, and signed Slack command baseline so user can test live immediately.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | User asked for immediate live testing and real DB path this hour |
| Reviewer B | Option 2 | Keeps momentum and reduces configuration drift before production hardening |

Decision:
- Implement Option 2.

Rationale:
- User explicitly requested immediate end-to-end testability, with JSON fallback still available.

Risks:
- Existing local Prisma client can be locked by running processes during regenerate (`EPERM` on Windows).

Mitigation:
- Keep `STORE_BACKEND=json` fallback operational and add clear regenerate/dbpush step before enabling Prisma mode in production runtime.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Governance rollout order (EOD/Mastermind first, Slack webhook second)
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Build Slack inbound/outbound webhook bridge first, then add governance domain and sync model.
2. Ship governance core first (EOD, mastermind, decision queue, retention, role checks), then add signed Slack bridge on top.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Establishes a stable local-first governance data model before exposing external webhook surface |
| Reviewer B | Option 2 | Reduces security risk and budget risk by proving retention/pruning behavior first |

Decision:
- Implement Option 2.

Rationale:
- User prioritized enterprise-ready governance controls and local-first memory ownership while keeping costs controlled.
- Slack integration is valuable but must be staged with strict signature verification and replay protection.

Risks:
- Temporary gap where Slack add-on is toggleable but signed webhook transport is not yet active.

Mitigation:
- Keep add-on state as entitlement toggle only for now; complete signed webhook bridge in next phase (Milestone 10A).

Final Ruling:
- Option 2 approved and implemented for baseline.

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

### Topic: Narrate implementation starts with JSON cache before SQLite
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Implement SQLite immediately for Milestone 1.
2. Implement stable cache interface with JSON backend first, then swap to SQLite milestone.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Faster delivery of command/UI flow and provider integration |
| Reviewer B | Option 2 | Lower packaging complexity for first executable build |

Decision:
- Milestone 1 uses JSON cache with a clean `CacheProvider` interface.

Rationale:
- Lets team validate UX and narration behavior now while keeping SQLite upgrade path intact.

Risks:
- JSON cache may be slower at large scale versus SQLite.

Mitigation:
- Keep interface stable and ship SQLite provider in Milestone 8 as planned.

Final Ruling:
- Option 2 approved.

### Topic: Milestone 2 delivery style (section summaries + edu enrichment)
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Keep flat line-by-line output and rely only on model-generated narration quality.
2. Add deterministic section grouping/summaries and apply a local edu term glossary post-processing layer.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Better learner readability and stable UX even when provider is unavailable |
| Reviewer B | Option 2 | Keeps outputs consistent and testable without backend/licensing dependency |

Decision:
- Implement Option 2.

Rationale:
- Milestone 2 requires explicit section summaries and better edu clarity; deterministic local logic ensures predictable behavior.

Risks:
- Heuristic classification may mislabel some language constructs.

Mitigation:
- Keep section builder isolated (`sectionBuilder.ts`) so rules can be tuned quickly by language.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Professional web UX split (marketing vs secure portal)
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Keep all customer/team/admin interactions on the landing page (`/`) and incrementally tidy styling only.
2. Split into clean marketing site (`/`) and dedicated secure portal (`/app`) with sidebar navigation and role-based sections.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Enterprise buyers expect clear app-shell UX and separated control surface |
| Reviewer B | Option 2 | Reduces cognitive overload and improves security posture by isolating operational actions |

Decision:
- Implement Option 2.

Rationale:
- User explicitly rejected single-page operational layout as non-enterprise and requested sidebar application behavior.

Risks:
- Additional frontend routing/state complexity in static JS app.

Mitigation:
- Keep lightweight tab-state in one script and expose all operational behavior through authenticated APIs.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Customer account and enterprise team-admin UX channel
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Keep only `x-admin-key` routes for team governance and leave customer web panel checkout-only.
2. Add auth-based customer account APIs and owner/manager team self-service routes directly behind signed-in web session.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Required for real-world customer testing (billing/support/history) without exposing admin key |
| Reviewer B | Option 2 | Aligns enterprise onboarding requirement: delegated manager control and policy updates from secure user auth |

Decision:
- Implement Option 2.

Rationale:
- User explicitly requested real customer account capability plus enterprise team-admin operations for testing.

Risks:
- Runtime still JSON-store based and does not yet enforce full table-backed admin RBAC.

Mitigation:
- Keep management access restricted to authenticated team owner/manager memberships and plan Prisma RBAC cutover in hardening phase.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Postgres rollout strategy for current licensing server
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Replace JSON store with Prisma in one large cutover change.
2. Provision Prisma schema/tables first, then migrate runtime handlers incrementally.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces migration risk and allows DB validation immediately |
| Reviewer B | Option 2 | Keeps service operational while moving persistence in controlled slices |

Decision:
- Implement Option 2.

Rationale:
- User requested immediate real Postgres setup; this approach delivers a live schema now without destabilizing existing routes.

Risks:
- Temporary dual-state (JSON runtime vs Postgres schema) until handler migration is complete.

Mitigation:
- Document current state clearly and prioritize service-layer migration next milestone.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Access-panel exposure on public landing page
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Keep checkout/offline/redeem controls fully visible on public landing.
2. Gate billing/redeem controls behind authentication and reveal after sign-in.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces user confusion/noise and avoids unauthenticated error spam |
| Reviewer B | Option 2 | Cleaner buyer funnel: sign-in first, then transactional actions |

Decision:
- Implement Option 2.

Rationale:
- User requested that the page feel less exposed and suggested sign-in first for access.

Risks:
- Slightly more frontend state logic and OAuth path branching.

Mitigation:
- Added explicit auth-state banner and kept public marketing content unchanged.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Landing page architecture for payment + onboarding
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Build a separate web app/repo before shipping any browser onboarding.
2. Serve a static landing/onboarding surface from the existing Fastify backend now.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Fastest path to publishable pricing/security page and immediate checkout testing |
| Reviewer B | Option 2 | Keeps auth/payment API and onboarding UI in one deployable service for MVP |

Decision:
- Implement Option 2.

Rationale:
- User requested immediate web-first purchase flow and marketing page while keeping extension and backend velocity.

Risks:
- Hosting UI inside API service can become harder to scale independently later.

Mitigation:
- Keep pages static and isolated under `server/public`; production phase can split into dedicated frontend without breaking APIs.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Checkout UX channel (VS Code vs web)
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Attempt in-editor payment UX inside extension webviews.
2. Generate server checkout session and open external browser payment flow.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Aligns with Stripe Checkout best-practice and avoids sensitive payment handling in extension runtime |
| Reviewer B | Option 2 | Reduces compliance risk and keeps payment UI maintainable |

Decision:
- Implement Option 2.

Rationale:
- Payment should happen on hosted Stripe Checkout/web pages; extension only initiates session and refreshes entitlement.

Risks:
- Requires backend config (`STRIPE_SECRET_KEY`, price map, webhook secret) and web success/cancel URLs.

Mitigation:
- Added environment-based configuration and explicit server docs.

Final Ruling:
- Option 2 approved and implemented.

### Topic: GitHub sign-in integration strategy
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Keep GitHub auth as backend-only placeholder until production web app exists.
2. Implement loopback callback bridge so extension can complete OAuth in current local architecture.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Allows immediate GitHub sign-in validation for local extension users |
| Reviewer B | Option 2 | Preserves secure OAuth model while enabling extension token capture without embedding secrets |

Decision:
- Implement Option 2.

Rationale:
- Extension opens `/auth/github/start` and captures callback on localhost loopback, then stores access token and refreshes license.

Risks:
- Requires loopback callback restrictions to avoid token redirection abuse.

Mitigation:
- Server enforces localhost callback URL validation and one-time expiring OAuth state records.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Milestone 3 gate strategy before backend licensing
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Keep export features always enabled until backend is ready.
2. Introduce local placeholder plan gate now, then replace gate source with backend entitlements later.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Validates UX behavior for gated features early |
| Reviewer B | Option 2 | Avoids command contract changes when backend arrives |

Decision:
- Implement Option 2.

Rationale:
- Milestone 3 explicitly requires export with Pro-gating placeholder.

Risks:
- Local config can be manually changed and is not secure licensing enforcement.

Mitigation:
- Treat as development placeholder only; final enforcement moves server-side in licensing milestone.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Milestone 4 git report data source
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Build change report from local git diff (`git diff HEAD`) and parse unified diff directly in extension.
2. Delay report until backend service exists and rely on remote diff computation.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 1 | Milestone 4 requires local functionality now |
| Reviewer B | Option 1 | Keeps feature local-first and aligns with product goals |

Decision:
- Implement Option 1 for Milestone 4.

Rationale:
- Produces immediate user value with no backend dependency and supports offline/local-first workflow.

Risks:
- Untracked files are not fully represented in `git diff HEAD`.

Mitigation:
- Document current behavior and extend parser/data source in follow-up if needed.

Final Ruling:
- Option 1 approved and implemented.

### Topic: Milestone 6 delivery strategy (payments/offline/redeem/affiliate)
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Delay all commercial flow routes until production Postgres/OAuth/Stripe signature validation are complete.
2. Implement local milestone-complete routes now in Fastify JSON store, then harden provider-specific security in production phase.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Unblocks extension-side redeem/device flows and validates end-to-end contracts now |
| Reviewer B | Option 2 | Preserves roadmap momentum while keeping server-side business logic centralized |

Decision:
- Implement Option 2.

Rationale:
- Current phase required functional routes for payments/offline/redeem/affiliate and extension command integration, not production infra hardening.

Risks:
- Local webhook/OAuth behavior is intentionally simplified and not production-safe yet.

Mitigation:
- Explicitly document that Stripe signature validation, OAuth app wiring, and Postgres migration are next hardening tasks.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Admin identity separation from customer users
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Reuse `users` for both customers and admins with a role flag.
2. Create dedicated `admin_*` tables for admin accounts, roles, permissions, scope assignment, and audit logs.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Prevents accidental privilege crossover and keeps governance isolated |
| Reviewer B | Option 2 | Supports board/admin/shop-assistant hierarchy with clear scope boundaries |

Decision:
- Implement Option 2.

Rationale:
- User requested that admin tables not be mixed with end-user data, especially for delegated assistant operations when primary department owners are unavailable.

Risks:
- Initial runtime still uses header key admin auth and not table-backed RBAC checks.

Mitigation:
- Keep admin data model provisioned in Postgres now; migrate admin auth/policy handlers to Prisma-backed RBAC in hardening phase.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Production ingress strategy for `pg-ext.addresly.com`
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Keep direct A-record to server IP only.
2. Install Cloudflare Tunnel tooling now and keep both direct IP DNS and tunnel-ready automation.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Enables immediate live demo and safer migration path to tunnel-only ingress |
| Reviewer B | Option 2 | Avoids last-minute deployment risk by preparing scripts now |

Decision:
- Implement Option 2.

Rationale:
- User explicitly requested domain `pg-ext.addresly.com` and Cloudflare tunnel readiness now.

Risks:
- Named tunnel setup still requires Cloudflare account login/token interaction.

Mitigation:
- Added automated PowerShell helper (`scripts/setup_cloudflare_tunnel.ps1`) with quick, named, and service-token modes.

Final Ruling:
- Option 2 approved and implemented.

### Topic: OAuth runtime config source in backend
Date_UTC: 2026-02-20
Owner: codex

Options:
1. Require shell/session env exports for OAuth keys and keep server code unchanged.
2. Load `server/.env` automatically in backend startup using `dotenv/config`.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Prevents live runtime drift where OAuth appears configured in file but missing in process |
| Reviewer B | Option 2 | Reduces operator error during domain/tunnel deployment |

Decision:
- Implement Option 2.

Rationale:
- User observed `Google/GitHub OAuth is not configured on this server` while keys were already present in `.env`.

Risks:
- Secret file handling remains sensitive on host machine.

Mitigation:
- Keep secrets in protected server environment and rotate keys if exposed.

Final Ruling:
- Option 2 approved and implemented.

### Topic: Hide predictable admin route surface
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Keep `/admin/*` endpoint namespace and rely only on auth checks.
2. Move admin/super-admin operational routes to a non-obvious namespace and keep strict auth checks.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces low-effort route scanning/noise and better matches enterprise expectation of isolated control surface |
| Reviewer B | Option 2 | Preserves existing auth while removing publicly guessable admin path naming |

Decision:
- Implement Option 2.

Rationale:
- User requested that global admin controls should not appear under obvious `/admin` paths and should be separated from tenant enterprise UX.

Risks:
- Security-through-obscurity alone is insufficient.

Mitigation:
- Keep bearer/session auth, super-admin allowlist (`SUPER_ADMIN_EMAILS`), and admin key checks mandatory on all privileged routes.

Final Ruling:
- Option 2 approved and implemented using `/pg-global-admin/*`.

### Topic: Admin control auth model (DB RBAC vs header key)
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Keep `x-admin-key` as primary auth for privileged operations.
2. Enforce DB-backed RBAC permissions by default and keep key mode only as explicit fallback.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Role/permission checks must stay server-side in DB for enterprise trust and delegated admin controls |
| Reviewer B | Option 2 | Removes frontend-exposed privilege assumptions and aligns with zero-trust direction |

Decision:
- Implement Option 2.

Rationale:
- User explicitly requested DB-enforced roles/permissions and stronger security posture for enterprise onboarding.

Risks:
- If DB admin tables are empty, operators can be locked out.

Mitigation:
- Added startup RBAC baseline seeding (`ADMIN_RBAC_BOOTSTRAP=true`) and bootstrap email assignment (`ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS`).
- Kept controlled emergency mode via `ADMIN_AUTH_MODE=hybrid|key`.

Final Ruling:
- Option 2 approved and implemented (`ADMIN_AUTH_MODE=db` default).

### Topic: Governance sync channel for PG EOD / PG Mastermind
Date_UTC: 2026-02-21
Owner: codex

Options:
1. Build dedicated mobile app first and defer Slack integration.
2. Launch Slack-first secure gateway, keep local Memory-bank as source-of-truth, and add mobile app later.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Faster enterprise rollout, lower delivery risk, and existing reviewer adoption via Slack |
| Reviewer B | Option 2 | Keeps code memory local while still enabling centralized governance decisions |

Decision:
- Implement Option 2.

Rationale:
- User requested immediate practical workflow and agreed Slack is simpler/safer for first integration.

Risks:
- Decision events can be missed if local client is offline for long periods.
- Slack command ingress can be abused if signature verification/replay checks are weak.

Mitigation:
- Add pull-based decision queue with cursor + explicit local ack states (`pending/applied/conflict`).
- Enforce signed webhook verification, nonce/timestamp replay protection, RBAC checks, and audit logs.

Final Ruling:
- Option 2 approved as roadmap baseline (Milestone 9-12 planning).

### Topic: Milestone 10F closure execution command
Date_UTC: 2026-02-25
Owner: codex

Options:
1. Keep manual multi-step validation (health, thread, vote, decide, bind, worker, ack) with copy/paste commands.
2. Ship one command that runs the full matrix and prints PASS/FAIL with a saved markdown report.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Removes operator error and gives repeatable closure evidence for Slack transport. |
| Reviewer B | Option 2 | Faster go/no-go checks during tunnel instability and team handoff. |

Decision:
- Implement Option 2.

Rationale:
- User requested a single command to validate remaining 10F transport steps end-to-end.

Risks:
- Public checks may fail during Cloudflare tunnel interruptions even when local stack is healthy.

Mitigation:
- Add `-SkipPublicChecks` flag for local-only validation and keep explicit PASS/FAIL reporting for public checks when enabled.

Final Ruling:
- Option 2 approved and wired via `pg slack-check`.

### Topic: Milestone 10G flow validation execution command
Date_UTC: 2026-02-25
Owner: codex

Options:
1. Keep 10G as manual extension-host checklist only.
2. Add one-shot CLI baseline that validates core flow wiring + compile and emits PASS/FAIL report.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Unblocks milestone progression and catches wiring regressions quickly. |
| Reviewer B | Option 2 | Gives deterministic baseline before manual UI/runtime interaction checks. |

Decision:
- Implement Option 2.

Rationale:
- User requested immediate progression to next milestone and removal of blocking/manual loops.

Risks:
- CLI baseline cannot fully simulate live editor interactions.

Mitigation:
- Keep manual extension-host interaction validation as explicit remaining step in milestone notes.

Final Ruling:
- Option 2 approved and wired via `pg narrate-check`.

### Topic: Milestone closure operator command and slack-check reliability
Date_UTC: 2026-02-25
Owner: codex

Options:
1. Keep `pg slack-check` and `pg narrate-check` separate and require operators to run/interpret both manually.
2. Add one combined command for milestone closure and harden Slack check to auto-recover worker cursor drift.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Reduces repeated operator loops and gives a single go/no-go output for milestone progression. |
| Reviewer B | Option 2 | Cursor drift after restarts caused false negatives; auto-recovery makes closure checks stable. |

Decision:
- Implement Option 2.

Rationale:
- User requested moving forward without getting stuck in repeated Slack transport retries.
- Combined closure reporting and self-healing ack validation remove the recurring manual failure mode.

Risks:
- Public checks can still fail when Cloudflare tunnel is down even if local stack is healthy.

Mitigation:
- Keep `-SkipPublicChecks` for local closure and report public failures explicitly as transport/tunnel dependency.

Final Ruling:
- Option 2 approved and implemented via:
  - `scripts/milestone_closure_check.ps1`
  - `pg closure-check`
  - cursor recovery logic in `scripts/slack_transport_check.ps1`.

### Topic: Closure gate mode for tunnel-dependent public checks
Date_UTC: 2026-02-25
Owner: codex

Options:
1. Keep one strict closure mode only (fail whenever Cloudflare/public endpoint is down).
2. Add explicit gate modes: `strict` and `local-core`.

Voting:
| Reviewer | Vote | Rationale |
|---|---|---|
| Reviewer A | Option 2 | Prevents milestone progress from being blocked by external tunnel uptime while preserving strict mode for release checks. |
| Reviewer B | Option 2 | Local governance execution chain is the true implementation signal; public ingress is operational dependency. |

Decision:
- Implement Option 2.

Rationale:
- Current failures were dominated by Cloudflare `530` and transient account-summary timeout while core local decision workflow was passing.

Risks:
- Teams may overuse `local-core` and skip public transport verification.

Mitigation:
- Keep `strict` as default and require explicit `-ClosureMode local-core` opt-in.

Final Ruling:
- Option 2 approved and implemented.
