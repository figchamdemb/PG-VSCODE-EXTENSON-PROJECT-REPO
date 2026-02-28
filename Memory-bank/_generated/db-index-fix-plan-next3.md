# DB Index Fix Plan

Generated_UTC: 2026-02-27T02:52:54Z
Status: action-required
pg_stat_statements: enabled
UnusedIndexCandidates: 3
shared_preload_libraries: 

## Step 1 - Enable pg_stat_statements

Run this first to make query-performance decisions data-driven.
Important: SQL statements below run inside PostgreSQL, not directly in PowerShell.

```sql
-- 1) Check preload setting
SHOW shared_preload_libraries;

-- 2) If pg_stat_statements is missing from preload list, set it and restart PostgreSQL
-- Example (replace with full required list for your environment):
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

-- 3) After restart, enable extension in the target database
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 4) Verify extension
SELECT extname FROM pg_extension WHERE extname = 'pg_stat_statements';
```

## Step 1A - Run SQL from terminal (Prisma example, no psql required)

From repo root:

```powershell
cd .\server
@'
SHOW shared_preload_libraries;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
'@ | npx prisma db execute --stdin --schema .\prisma\schema.prisma
```

If ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements'; was applied, restart PostgreSQL service/container, then re-run the SQL verify step.

If your platform is managed Postgres (for example RDS/Cloud SQL), apply preload changes through its parameter-group mechanism, then restart.

## Step 2 - Safety checks before dropping unused indexes

Use this checklist for each candidate index:

```sql
-- A) Confirm index definition
SELECT pg_get_indexdef('schema.index_name'::regclass);

-- B) Confirm no constraint depends on the index
SELECT conname FROM pg_constraint WHERE conindid = 'schema.index_name'::regclass;

-- C) Sample usage over a real traffic window (run multiple times)
SELECT now() AS sampled_at, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'schema' AND relname = 'table_name' AND indexrelname = 'index_name';
```

Only drop indexes that remain unused across representative workload windows and are not required by constraints.

## Step 3 - Candidate-specific SQL

### Candidate 1: narate_enterprise.admin_role_permissions_role_id_idx
- table: narate_enterprise.admin_role_permissions
- idx_scan: 0
- estimated_size: 16.00 KiB

```sql
-- Guard check
SELECT now() AS sampled_at, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'narate_enterprise' AND relname = 'admin_role_permissions' AND indexrelname = 'admin_role_permissions_role_id_idx';

-- Drop candidate (run during low-traffic window)
DROP INDEX CONCURRENTLY IF EXISTS "narate_enterprise"."admin_role_permissions_role_id_idx";

-- Rollback (if query performance regresses)
CREATE INDEX CONCURRENTLY admin_role_permissions_role_id_idx ON narate_enterprise.admin_role_permissions USING btree (role_id);
```

### Candidate 2: narate_enterprise.devices_user_id_install_id_key
- table: narate_enterprise.devices
- idx_scan: 0
- estimated_size: 16.00 KiB

```sql
-- Guard check
SELECT now() AS sampled_at, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'narate_enterprise' AND relname = 'devices' AND indexrelname = 'devices_user_id_install_id_key';

-- Drop candidate (run during low-traffic window)
DROP INDEX CONCURRENTLY IF EXISTS "narate_enterprise"."devices_user_id_install_id_key";

-- Rollback (if query performance regresses)
CREATE UNIQUE INDEX CONCURRENTLY devices_user_id_install_id_key ON narate_enterprise.devices USING btree (user_id, install_id);
```

### Candidate 3: narate_enterprise.admin_role_permissions_permission_id_idx
- table: narate_enterprise.admin_role_permissions
- idx_scan: 0
- estimated_size: 16.00 KiB

```sql
-- Guard check
SELECT now() AS sampled_at, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'narate_enterprise' AND relname = 'admin_role_permissions' AND indexrelname = 'admin_role_permissions_permission_id_idx';

-- Drop candidate (run during low-traffic window)
DROP INDEX CONCURRENTLY IF EXISTS "narate_enterprise"."admin_role_permissions_permission_id_idx";

-- Rollback (if query performance regresses)
CREATE INDEX CONCURRENTLY admin_role_permissions_permission_id_idx ON narate_enterprise.admin_role_permissions USING btree (permission_id);
```

