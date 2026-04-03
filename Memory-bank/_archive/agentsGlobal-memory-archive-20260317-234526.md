# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-17 23:45
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 30


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260317-230319.md` on 2026-03-17 23:03 UTC.

- Hardened dependency verification so enforcement is no longer single-manifest:
  - `scripts/dependency_verify.ps1` now scans all local service manifests by default (`extension`, `server`, and other top-level service folders with `package.json`), while still allowing explicit `-ManifestPath`.
- Added local CVE-severity ingestion path:
  - per manifest, script now reads `npm audit --json --package-lock-only` output and enriches dependency payload with `vulnerability_max_severity`, allowing server-side policy to block high/critical packages (`DEP-SEC-001`).
- Aligned cloud-score dependency stage:
  - `scripts/mcp_cloud_score_verify.ps1` now uses multi-manifest dependency collection and includes local audit severity metadata in dependency scanner payload.

Validation:
- `powershell -ExecutionPolicy Bypass -File scripts/dependency_verify.ps1 -DependenciesOnly`: PASS aggregate on 2 manifests.
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS in warn mode (dependency stage now explicitly reports both manifests).
- `./pg.ps1 cloud-score -WorkloadSensitivity regulated`: blocked with scanner blockers `16`, warnings `106` (warning increase reflects broader dependency scanner input coverage).
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: FAIL (strict mode) because existing coding blockers remain and DB index check cannot reach remote DB host.

Anchors:
- `scripts/dependency_verify.ps1`
- `scripts/mcp_cloud_score_verify.ps1`
- `scripts/pg.ps1`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/project-details.md`
- `Memory-bank/daily/2026-02-28.md`

### [2026-03-17 23:59 UTC] - copilot
Scope:
- Components: frontend-integration-evidence-seeding, auth-smoke-baseline
- Files touched: integration proposal/testing docs, Playwright smoke config/tests, integration summary generator, memory docs

Summary:
