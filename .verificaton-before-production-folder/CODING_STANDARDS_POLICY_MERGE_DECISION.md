# CODING STANDARDS POLICY MERGE DECISION (V1)

Status: approved-for-planning (not yet runtime-implemented)  
Date: 2026-02-23  
Owner: product + engineering

## Canonical Source Decision

1. `CODING_STANDARDS_ENFORCEMENT.md` is the canonical policy base.
2. `CODDING-STANDARD-V2.MD` is treated as advisory rationale and refinement notes.
3. Merge conflicts are resolved by this file until enforcement engine implementation lands.

---

## Keep / Change / Reject

## Keep (Accepted)

1. Clean architecture separation by layer is mandatory:
   - controller/route: transport only
   - service/use-case: business orchestration
   - repository/data-access: persistence only
   - dto/request/response: boundary validation/data contract
   - entity/model: domain behavior only
2. Absolute hard cap of `500 LOC` per file remains non-negotiable.
3. Missing boundary validation is a blocker.
4. Controller/business-logic mixing is a blocker.
5. Dependency policy + coding standards policy must both pass before `pg prod` allows green status.

## Change (Adjusted for practical enforcement)

1. Introduce two thresholds per rule:
   - `target` (warning)
   - `hard` (blocker)
2. Resolve size conflicts with dual-threshold model:
   - controller: target 80, hard 150
   - service/use-case: target 200, hard 350
   - repository: target 150, hard 250
   - dto: target 50, hard 80
   - entity/model: target 100, hard 150
   - ui component/screen/page: target 150, hard 250
   - custom hook/helper: target 80, hard 120
3. Function length:
   - target 20 lines
   - hard 40 lines
4. Controller body rule:
   - not forced to exactly one line
   - hard rule: no business branch/domain logic/direct DB calls in controller

## Reject (Not adopted)

1. Single universal hard limit of `150` for all controllers in all frameworks without profile context.
2. Forcing auto-push/auto-merge as default behavior.
3. Storing full private rule internals in plain local docs for non-enterprise tiers.

---

## Enforcement Visibility Model (IP Protection)

Goal: user gets quality enforcement but cannot extract full private policy logic.

1. Client/agent-visible output uses opaque rule IDs only.
2. Canonical rule definitions, thresholds, scoring, and exception tables remain server-private.
3. User-visible feedback can show:
   - severity
   - impacted file
   - short remediation hint
   - rule ID
4. User-visible feedback should not include full private weighting tables, deny-lists, or full policy corpus.

Example response:

```json
{
  "status": "blocked",
  "violations": [
    {
      "rule_id": "CSTD-CTRL-001",
      "severity": "blocker",
      "file": "src/orders/order.controller.ts",
      "hint": "Controller contains domain/business logic. Move logic to service."
    }
  ]
}
```

---

## Rule ID Taxonomy (Proposed)

1. `CSTD-CORE-*` : cross-language standards
2. `CSTD-CTRL-*` : controller/route rules
3. `CSTD-SVC-*` : service/use-case rules
4. `CSTD-DTO-*` : DTO and contract rules
5. `CSTD-ENT-*` : entity/domain rules
6. `CSTD-UI-*` : frontend page/component/hook rules
7. `CSTD-TEST-*` : test quality and structure rules
8. `CSTD-SEC-*` : security-sensitive coding standards
9. `CSTD-PROFILE-*` : framework-specific profile rules

---

## Profile-Based Skills/Policy Packs

Only load rules relevant to detected stack.

1. `profile-spring-java-v1`
2. `profile-nest-ts-v1`
3. `profile-next-app-router-v1`
4. `profile-react-native-v1`
5. `profile-kotlin-android-v1`
6. `profile-flutter-dart-v1`

Behavior:
1. At session start, detect framework(s) from repo markers.
2. Activate matching profile(s) only.
3. For mono-repo, map profile by folder boundary.
4. Non-matching profiles stay unloaded.

---

## Integration with Existing Tracks

1. Dependency verification gate and coding standards gate run as separate validators under `pg prod`.
2. PG Life fix pipeline must run coding-standards validator before PR creation.
3. Governance approvals remain required for high-risk changes.
4. Every agent-applied change must be written to local change ledger for rollback traceability.

## Milestone Placement Lock (Approved)

1. Close current delivery validation first:
   - Slack launch closure
   - Narrate flow completion validation
2. Run enforcement baseline next as hard prerequisites:
   - dependency verification baseline
   - coding standards baseline
   - trigger + anti-exfil guardrail baseline
3. Start extension-native background auto-consumer wiring only after step 2 passes on this repo.

---

## Enforcement Lifecycle Hooks (Mandatory)

These checks are required so the agent cannot skip standards accidentally.

1. Start-of-session baseline scan:
   - Trigger when Memory-bank session starts.
   - Detect active framework profile(s).
   - Run dependency + coding standards baseline scan on current workspace.
   - Produce warning/blocker report with rule IDs.
2. Post-write self-check:
   - Trigger after agent creates/updates file(s).
   - Re-scan only changed files + nearest module context.
   - Agent must include pass/fail + violated rule IDs in its own work summary.
3. Pre-PR/Pre-push gate:
   - Trigger before PR creation and before `pg push`.
   - Block if any blocker severity remains unresolved.
4. Pre-production gate (`pg prod`):
   - Full-scope scan (dependency + coding standards + required quality checks).
   - Fail-closed on blockers.

---

## Private Rule Reference Flow (Agent-visible, user-minimal)

1. Agent receives rule references as IDs and compact hints only.
2. Canonical policy text/weights/exception maps remain server-private.
3. Agent output examples:
   - `CSTD-CTRL-001 failed in src/orders/order.controller.ts`
   - `CSTD-DTO-004 warning in src/orders/dto/create-order.dto.ts`
4. User can see remediation hints, but not full private policy internals.

---

## Prompt Exfiltration / Jailbreak Protection

Goal: detect and contain attempts to extract private policy logic or bypass enforcement.

1. Detection signals (server-side):
   - repeated requests to reveal hidden policy internals/weights
   - obfuscated extraction attempts (emoji wrapping, spacing tricks, encoding tricks)
   - instructions to disable scanner, bypass rule checks, or forge pass results
2. Response policy (recommended):
   - first events: soft block + warning + audit event
   - repeated/high-confidence events: temporary policy-lock mode (restricted actions)
   - severe/repeated abuse: account escalation for manual review and optional suspension
3. Do not auto-ban on first signal:
   - use risk scoring to reduce false positives
   - preserve incident evidence for admin review
4. Log all events in governance/security audit trail with:
   - account/team ID
   - timestamp
   - risk score
   - normalized detector reason codes

---

## MVP Scope Recommendation

Phase A (low cost):
1. Local deterministic scanner for structural checks and LOC limits.
2. Rule-ID output format.
3. Profile selection by framework detection.

Phase B (server-private premium):
1. Server policy resolver for private thresholds/weights/overrides.
2. Entitlement-aware profile access.
3. Tenant/org policy overlays.

Phase C (enterprise offline add-on):
1. Signed/encrypted policy pack.
2. Rotating pack versions and expiration.
