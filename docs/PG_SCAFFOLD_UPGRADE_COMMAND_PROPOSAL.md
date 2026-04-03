# PG Scaffold Upgrade Command Proposal

LAST_UPDATED_UTC: 2026-03-20 22:48
UPDATED_BY: copilot
STATUS: baseline-implemented
REQ: REQ-2026-03-20-03

## Current Status

Baseline implementation is now shipped in this repo.

Implemented command paths:

1. `./pg.ps1 upgrade-scaffold`
2. `./pg.ps1 install backend --target <repo> -UpgradeScaffold`
3. machine-wide global CLI sync via `powershell -ExecutionPolicy Bypass -File .\scripts\sync_global_pg_cli.ps1`
4. stale-repo local wrapper path via `./pg.ps1 install backend -UpgradeScaffold` after the global payload is refreshed

Implemented safeguards:

1. dry-run preview by default unless `-Yes` is supplied
2. timestamped report bundle under `Memory-bank/_generated/scaffold-upgrades/<session-id>/`
3. version record at `Memory-bank/_generated/pg-scaffold-version.json`
4. managed replace/create/merge/manual-review classification
5. `Memory-bank/` history preserved by default

Validated dry runs:

1. current repo preview via `./pg.ps1 upgrade-scaffold -DryRun -Json`
2. stale target preview via `./pg.ps1 install backend --target "C:\Users\ebrim\Desktop\WORKING-PRO" -UpgradeScaffold -DryRun -Json`
3. machine-global CLI preview from inside `WORKING-PRO` via `pg help` and `./pg.ps1 install backend --target "." -UpgradeScaffold -DryRun`

Still pending for a later hardening pass:

1. Marketplace or packaged release automation that refreshes `~\.pg-cli` without requiring the local repo-owned sync script
2. richer merge strategies for AGENTS/instruction files beyond create-or-manual-review
3. optional automated rollback command

## Purpose

Define a real non-breaking scaffold upgrade command so future PG releases can upgrade existing user repositories safely.

The problem to solve is specific:

1. current `pg install backend --target "."` behavior is additive and skips existing files
2. old repos can keep stale `pg.ps1`, hook, and guard logic forever
3. current `pg update` lifecycle behavior refreshes auth/profile state only and does not replace scaffold tooling
4. users must not lose `Memory-bank/` history, repo-specific notes, or application code just to receive a tooling upgrade

This proposal defines an enterprise-safe upgrade path with auditability, rollback data, and compatibility for both modern and stale repos.

## Outcome

Future releases should support two compatible entrypoints:

1. modern repo-local command:
   - `./pg.ps1 upgrade-scaffold`
2. bootstrap-compatible command for stale repos:
   - `pg install backend --target "." -UpgradeScaffold`

Recommendation:

1. treat `upgrade-scaffold` as the canonical action name in current scaffolds
2. keep `install ... -UpgradeScaffold` as the compatibility bridge for older repos and delegated global installs
3. do not overload `pg update` with scaffold replacement behavior, because `update` already means auth/profile refresh in the shipped lifecycle model

## Non-Breaking Contract

The upgrade path must preserve the user repo's business code and project memory by default.

The command must not delete or reset:

1. `Memory-bank/daily/*`
2. `Memory-bank/agentsGlobal-memory.md`
3. `Memory-bank/project-details.md`
4. `Memory-bank/project-spec.md`
5. `Memory-bank/structure-and-db.md`
6. `Memory-bank/code-tree/*`
7. `Memory-bank/db-schema/*`
8. `Memory-bank/frontend-integration/*`
9. `Memory-bank/review-workflow/*`
10. application source such as `server/*`, `extension/*`, `src/*`, `app/*`, or user docs outside PG-owned scaffold scope

The upgrade path may replace PG-owned runtime/tooling assets when they are classified as managed scaffold files.

## Managed File Classes

The implementation should use a manifest-driven classifier instead of hard-coded ad hoc overwrite decisions.

### Class A: replace-in-place

Safe to replace after backup because they are PG-owned runtime wrappers or scripts:

1. `pg.ps1`
2. `pg.cmd`
3. `scripts/pg.ps1`
4. PG-owned helper scripts under `scripts/` that are shipped from the scaffold package
5. `.githooks/pre-commit` when it matches a known PG-managed hook signature

### Class B: merge-or-refresh

Should be updated with explicit merge logic or block for manual review if local customization is detected:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `ANTIGRAVITY.md`
4. `GEMINI.md`
5. `.gitignore` PG section
6. `.narrate/config.json`
7. `.narrate/policy.json`
8. optional PG workflow files under `.github/workflows/`

Rule:

1. if the file contains a known PG-managed block or version marker, merge/update that block
2. if the file has local edits outside the managed block and no safe merge strategy exists, preserve the file and emit a `manual_review_required` finding in the upgrade report

### Class C: preserve-only

Never overwrite automatically; only scaffold if missing:

1. `Memory-bank/*.md`
2. `Memory-bank/daily/*`
3. `Memory-bank/_generated/*` except the dedicated upgrade report folder
4. local workflow ledgers and state files
5. application/runtime source

## Versioning Requirement

The scaffold must carry an explicit version record so upgrades can reason about source and target state.

Recommended generated file:

1. `Memory-bank/_generated/pg-scaffold-version.json`

Minimum fields:

1. `scaffold_version`
2. `installed_at_utc`
3. `installed_by_command`
4. `install_channel`
5. `managed_manifest_version`

If the file is missing, the command should classify the repo as `legacy_unversioned` and continue with a compatibility path instead of failing.

## Command Surface

### Canonical modern command

```powershell
./pg.ps1 upgrade-scaffold
```

### Compatibility entrypoint for stale repos

```powershell
pg install backend --target "." -UpgradeScaffold
```

### Proposed switches

1. `-DryRun`
2. `-Yes`
3. `-BackupRoot <path>`
4. `-IncludeCiTemplates`
5. `-ForceManagedMerge`
6. `-Json`
7. `-SkipPostUpgradeStart`
8. `-SkipPostUpgradeHookInstall`
9. `-RunSelfCheck`

### Default behavior

Without `-Yes`, the command should:

1. inventory the repo
2. classify candidate changes
3. show replace/merge/preserve counts
4. write a dry-run report
5. stop before mutating files

That keeps the default enterprise posture preview-first instead of mutate-first.

## Upgrade Algorithm

### Phase 1: discover

1. resolve project root
2. detect local scaffold version or classify as `legacy_unversioned`
3. load the shipped scaffold manifest for the release
4. scan target files and compute action class per file

### Phase 2: preflight

1. verify the repo is writable
2. create an upgrade session ID and timestamp
3. build a backup plan for all replace/merge targets
4. write a dry-run manifest even if the user has not approved mutation yet

### Phase 3: backup

Write backups and reports under:

1. `Memory-bank/_generated/scaffold-upgrades/<timestamp>/backup/`
2. `Memory-bank/_generated/scaffold-upgrades/<timestamp>/upgrade-report.json`
3. `Memory-bank/_generated/scaffold-upgrades/<timestamp>/upgrade-report.md`

The JSON report should include:

1. repo root
2. previous scaffold version
3. target scaffold version
4. files replaced
5. files merged
6. files preserved
7. files requiring manual review
8. hook/config changes applied
9. post-upgrade validation results

### Phase 4: apply

1. replace Class A files from the release package
2. merge Class B files when the merge strategy is deterministic
3. preserve Class C files untouched
4. write the new scaffold version record

### Phase 5: post-upgrade normalize

1. reinstall PG hooks with the current default mode
2. refresh any generated lightweight state needed for command discovery
3. keep project Memory-bank history intact

### Phase 6: validate

Mandatory upgrade validation:

1. confirm the new command surface is present in `./pg.ps1 help`
2. confirm the expected managed files now match the target scaffold version
3. confirm hook installation completed or report why it was skipped

Optional repo-health validation:

1. `./pg.ps1 start -Yes`
2. `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`

Important distinction:

1. scaffold upgrade success means the tooling refresh completed correctly
2. self-check failure after upgrade means the repo has runtime/product issues to address, not that the upgrade itself failed

## Rollback Strategy

The first version does not need a full automated rollback command, but it must preserve enough backup data for deterministic restore.

Minimum requirement:

1. every replaced file is copied into the timestamped backup folder
2. the report includes original relative path and backup path
3. merge operations record both the pre-image and the merged output path

Future enhancement:

1. add `./pg.ps1 restore-scaffold -From <upgrade-session-id>`

## Legacy Repo Compatibility

This is the central enterprise requirement.

Older repos may not expose `upgrade-scaffold` locally, so the release must support upgrade initiation from a path they already have.

Required compatibility rule:

1. the global installer path invoked by `pg install backend --target "."` must recognize `-UpgradeScaffold`
2. when that flag is present, the installer switches from additive bootstrap mode to manifest-driven upgrade mode
3. it may still preserve user files, but it must no longer skip stale PG-managed files just because they already exist

Without this compatibility bridge, stale repos cannot reliably upgrade themselves.

## Safety Rules

1. never run `git reset --hard` or any destructive git cleanup as part of the upgrade
2. never delete `Memory-bank/` to "rebuild" it
3. never overwrite user-authored Memory-bank history files in place
4. never silently downgrade strictness or hook policy during upgrade
5. always emit a machine-readable report
6. always emit a human-readable markdown summary for operators

## Acceptance Criteria

The feature is complete when the following scenarios work:

1. stale repo with old `pg.ps1` and existing `Memory-bank/` can be upgraded via `pg install backend --target "." -UpgradeScaffold`
2. modern repo can be upgraded via `./pg.ps1 upgrade-scaffold`
3. the upgrade preserves historical Memory-bank files and project-specific notes
4. the command writes a backup/report bundle under `Memory-bank/_generated/scaffold-upgrades/`
5. after upgrade, `./pg.ps1 help` exposes the current command set including `self-check`
6. hook/install policy reflects the current scaffold defaults instead of old `warn` defaults
7. additive install without `-UpgradeScaffold` still behaves as non-destructive bootstrap for missing files only

## Recommended Implementation Order

1. introduce scaffold manifest + version file
2. implement inventory and dry-run report generation
3. implement replace-in-place handling for Class A files
4. implement deterministic merge strategies for Class B files
5. add compatibility handling to the global `install` path
6. add repo-local `upgrade-scaffold` alias once the upgraded command router is present

## Explicit Non-Goals For First Release

1. full three-way merge for arbitrary user-edited markdown or workflow files
2. automatic rollback of every upgrade session
3. rewriting project-specific Memory-bank planning/history files to match the new scaffold language
4. treating `pg update` as a synonym for scaffold replacement

## Recommendation Summary

Implement a dedicated scaffold upgrade feature, not a hidden installer side effect.

The release should ship:

1. canonical command: `./pg.ps1 upgrade-scaffold`
2. stale-repo compatibility path: `pg install backend --target "." -UpgradeScaffold`
3. manifest-driven file classification
4. preview-first dry-run behavior
5. timestamped backups and reports
6. strict preservation of `Memory-bank/` history and application code

That gives PG a release-safe enterprise upgrade path instead of asking operators to delete files or manually diff scaffold versions.