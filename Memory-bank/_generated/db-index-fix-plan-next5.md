# DB Index Fix Plan

Generated_UTC: 2026-02-27T22:03:49Z
Status: pass
pg_stat_statements: enabled
UnusedIndexCandidates: 0
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
'@ | npx prisma db execute --stdin
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

No zero-scan non-primary, non-unique indexes were found in the sampled set.
