# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-15 18:06
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 40


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260315-175958.md` on 2026-03-15 17:59 UTC.

- Left unique `_key` indexes intact for data-integrity safety.
- Updated DB maintenance warning scope so `DBM-IND-002` flags only unused non-primary, non-unique indexes (not unique integrity indexes).
- Validation:
  - `./pg.ps1 db-index-check` => `status: pass`, `blockers: 0`, `warnings: 0`
  - `./pg.ps1 db-index-fix-plan -DbMaxRows 10` => `unused index candidates: 0`
  - `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck` => DB summary `blockers=0 warnings=0`

Dropped indexes:
- `narate_enterprise.admin_account_roles_assigned_by_admin_id_idx`
- `narate_enterprise.admin_account_roles_scope_id_idx`
- `narate_enterprise.admin_audit_logs_actor_admin_id_idx`
- `narate_enterprise.admin_audit_logs_scope_id_idx`
- `narate_enterprise.admin_audit_logs_target_type_target_id_idx`
- `narate_enterprise.admin_role_permissions_permission_id_idx`
- `narate_enterprise.admin_role_permissions_role_id_idx`
- `narate_enterprise.affiliate_conversions_affiliate_user_id_status_idx`
- `narate_enterprise.affiliate_payouts_affiliate_user_id_status_idx`
- `narate_enterprise.project_quotas_user_id_scope_idx`
- `narate_enterprise.refund_requests_user_id_idx`

Anchors:
- `scripts/db_index_maintenance_check.ps1`
- `scripts/db_index_fix_plan.ps1`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/project-details.md`

### [2026-02-27 15:02 UTC] - codex
Scope:
- Components: self-check-exit-fix + diagnostics-bundle-export
- Files touched: self-check script + diagnostics command/help + memory docs

Summary:
- Fixed strict self-check false runtime classification for UI-smoke path:
  - `scripts/self_check.ps1` now routes Playwright smoke stdout to host (`Out-Host`) so command return value remains numeric exit code.
  - strict self-check now ends as blocker (`policy violations`) when coding gates fail, instead of incorrectly reporting runtime failure.
- Advanced Milestone 10L diagnostics UX:
