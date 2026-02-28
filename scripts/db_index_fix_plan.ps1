param(
    [string]$DatabaseUrl = "",
    [string]$ServerEnvPath = "",
    [ValidateRange(1, 1000)]
    [int]$MaxRows = 25,
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Resolve-ServerEnvPath {
    param([string]$Requested)
    $repoRoot = Get-RepoRoot
    if (-not [string]::IsNullOrWhiteSpace($Requested)) {
        $candidate = if ([System.IO.Path]::IsPathRooted($Requested)) { $Requested } else { Join-Path $repoRoot $Requested }
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
        return ""
    }
    $defaultPath = Join-Path $repoRoot "server\.env"
    if (Test-Path -LiteralPath $defaultPath) {
        return (Resolve-Path -LiteralPath $defaultPath).Path
    }
    return ""
}

function Read-DatabaseUrlFromEnvFile {
    param([string]$EnvPath)
    if ([string]::IsNullOrWhiteSpace($EnvPath) -or -not (Test-Path -LiteralPath $EnvPath)) {
        return ""
    }
    $lines = Get-Content -LiteralPath $EnvPath -ErrorAction SilentlyContinue
    foreach ($raw in $lines) {
        $line = $raw.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            continue
        }
        if ($line -notmatch "^DATABASE_URL\s*=\s*(.+)$") {
            continue
        }
        $value = $Matches[1].Trim()
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        return $value.Trim()
    }
    return ""
}

function Resolve-DatabaseUrl {
    param(
        [string]$Requested,
        [string]$EnvPath
    )
    if (-not [string]::IsNullOrWhiteSpace($Requested)) {
        return $Requested
    }
    if (-not [string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
        return [string]$env:DATABASE_URL
    }
    return Read-DatabaseUrlFromEnvFile -EnvPath $EnvPath
}

function Resolve-OutputPath {
    param([string]$Requested)
    $repoRoot = Get-RepoRoot
    if ([string]::IsNullOrWhiteSpace($Requested)) {
        return Join-Path $repoRoot "Memory-bank\_generated\db-index-fix-plan-latest.md"
    }
    if ([System.IO.Path]::IsPathRooted($Requested)) {
        return $Requested
    }
    return Join-Path $repoRoot $Requested
}

function Escape-SqlLiteral {
    param([string]$Value)
    if ($null -eq $Value) {
        return ""
    }
    return ($Value -replace "'", "''")
}

function Quote-SqlIdentifier {
    param([string]$Value)
    if ($null -eq $Value) {
        return '""'
    }
    return '"' + ($Value -replace '"', '""') + '"'
}

function Convert-ToHumanBytes {
    param([object]$Bytes)
    $n = 0.0
    if ($null -ne $Bytes) {
        $parsed = 0.0
        if ([double]::TryParse([string]$Bytes, [ref]$parsed)) {
            $n = $parsed
        }
    }
    if ($n -lt 1024) {
        return ("{0:N0} B" -f $n)
    }
    if ($n -lt 1048576) {
        return ("{0:N2} KiB" -f ($n / 1024))
    }
    if ($n -lt 1073741824) {
        return ("{0:N2} MiB" -f ($n / 1048576))
    }
    return ("{0:N2} GiB" -f ($n / 1073741824))
}

function To-CreateIndexConcurrentlyStatement {
    param([string]$IndexDefinition)
    if ([string]::IsNullOrWhiteSpace($IndexDefinition)) {
        return ""
    }
    $statement = $IndexDefinition.Trim().TrimEnd(";")
    if ($statement -match "^\s*CREATE\s+UNIQUE\s+INDEX\s+") {
        return (($statement -replace "^\s*CREATE\s+UNIQUE\s+INDEX\s+", "CREATE UNIQUE INDEX CONCURRENTLY ") + ";")
    }
    if ($statement -match "^\s*CREATE\s+INDEX\s+") {
        return (($statement -replace "^\s*CREATE\s+INDEX\s+", "CREATE INDEX CONCURRENTLY ") + ";")
    }
    return ($statement + ";")
}

function Invoke-NodeFixPlan {
    param(
        [string]$ServerDir,
        [hashtable]$Config
    )
    $node = Get-Command "node" -ErrorAction SilentlyContinue
    if ($null -eq $node) {
        throw "Node.js is required to generate DB index remediation plan."
    }

    $jsonConfig = $Config | ConvertTo-Json -Depth 10 -Compress
    $env:PG_DB_FIX_PLAN_CONFIG = $jsonConfig

    $nodeScript = @'
const { PrismaClient } = require("@prisma/client");

function normalizeNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.floor(n);
}

function toSafeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return n;
}

async function main() {
  const cfgRaw = process.env.PG_DB_FIX_PLAN_CONFIG || "{}";
  let cfg = {};
  try {
    cfg = JSON.parse(cfgRaw);
  } catch {
    cfg = {};
  }

  const databaseUrl = String(cfg.database_url || "").trim();
  const maxRows = normalizeNumber(cfg.max_rows, 25);

  if (!databaseUrl) {
    console.log(JSON.stringify({
      ok: false,
      status: "blocked",
      runtime_error: null,
      blockers: [
        {
          rule_id: "DBM-INPUT-001",
          severity: "blocker",
          message: "DATABASE_URL is not set for DB index remediation plan generation.",
          hint: "Pass -DatabaseUrl, set DATABASE_URL env var, or configure server/.env."
        }
      ],
      extension_enabled: false,
      shared_preload_libraries: "",
      unused_indexes: [],
      summary: {
        unused_index_count: 0,
        sampled_at_utc: new Date().toISOString()
      }
    }));
    process.exit(2);
    return;
  }

  process.env.DATABASE_URL = databaseUrl;
  const prisma = new PrismaClient();

  try {
    const extRows = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
      ) AS enabled
    `);
    const extensionEnabled = Array.isArray(extRows) && extRows.length > 0
      ? Boolean(extRows[0].enabled)
      : false;

    const preloadRows = await prisma.$queryRawUnsafe(`SHOW shared_preload_libraries`);
    let sharedPreloadLibraries = "";
    if (Array.isArray(preloadRows) && preloadRows.length > 0) {
      const row = preloadRows[0] || {};
      sharedPreloadLibraries = String(
        row.shared_preload_libraries || row.setting || ""
      ).trim();
    }

    const unusedRows = await prisma.$queryRawUnsafe(`
      SELECT
        s.schemaname,
        s.relname AS table_name,
        s.indexrelname AS index_name,
        s.idx_scan,
        pg_relation_size(format('%I.%I', s.schemaname, s.indexrelname)::regclass) AS index_size_bytes,
        pg_get_indexdef(format('%I.%I', s.schemaname, s.indexrelname)::regclass) AS index_definition
      FROM pg_stat_user_indexes s
      JOIN pg_class c ON c.relname = s.indexrelname
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = s.schemaname
      JOIN pg_index i ON i.indexrelid = c.oid
      WHERE s.idx_scan = 0
        AND i.indisprimary = false
        AND i.indisunique = false
      ORDER BY pg_relation_size(format('%I.%I', s.schemaname, s.indexrelname)::regclass) DESC
      LIMIT ${maxRows}
    `);

    const unusedIndexes = Array.isArray(unusedRows)
      ? unusedRows.map((row) => ({
          schemaname: String(row.schemaname || ""),
          table_name: String(row.table_name || ""),
          index_name: String(row.index_name || ""),
          idx_scan: toSafeNumber(row.idx_scan),
          index_size_bytes: toSafeNumber(row.index_size_bytes),
          index_definition: String(row.index_definition || "").trim()
        }))
      : [];

    const result = {
      ok: true,
      status: (!extensionEnabled || unusedIndexes.length > 0) ? "action-required" : "pass",
      runtime_error: null,
      blockers: [],
      extension_enabled: extensionEnabled,
      shared_preload_libraries: sharedPreloadLibraries,
      unused_indexes: unusedIndexes,
      summary: {
        unused_index_count: unusedIndexes.length,
        sampled_at_utc: new Date().toISOString()
      }
    };
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify({
      ok: false,
      status: "error",
      runtime_error: message,
      blockers: [],
      extension_enabled: false,
      shared_preload_libraries: "",
      unused_indexes: [],
      summary: {
        unused_index_count: 0,
        sampled_at_utc: new Date().toISOString()
      }
    }));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
'@

    Push-Location $ServerDir
    try {
        $output = $nodeScript | & $node.Source -
        $exitCode = $LASTEXITCODE
        return @{
            output = $output
            exit_code = $exitCode
        }
    }
    finally {
        Pop-Location
        Remove-Item Env:PG_DB_FIX_PLAN_CONFIG -ErrorAction SilentlyContinue
    }
}

$repoRoot = Get-RepoRoot
$serverDir = Join-Path $repoRoot "server"
if (-not (Test-Path -LiteralPath $serverDir)) {
    throw "Server directory not found at $serverDir."
}

$envPath = Resolve-ServerEnvPath -Requested $ServerEnvPath
$resolvedDatabaseUrl = Resolve-DatabaseUrl -Requested $DatabaseUrl -EnvPath $envPath

$config = @{
    database_url = $resolvedDatabaseUrl
    max_rows = $MaxRows
}

$result = Invoke-NodeFixPlan -ServerDir $serverDir -Config $config
$rawOutput = ($result.output | Out-String).Trim()
if ([string]::IsNullOrWhiteSpace($rawOutput)) {
    throw "DB index fix-plan generator returned no output."
}

try {
    $json = ConvertFrom-Json -InputObject $rawOutput
}
catch {
    throw "DB index fix-plan generator returned invalid JSON: $rawOutput"
}

if ($result.exit_code -eq 2) {
    if ($json.blockers -and $json.blockers.Count -gt 0) {
        foreach ($item in $json.blockers) {
            Write-Host "- [$($item.rule_id)] $($item.message)"
            Write-Host "  hint: $($item.hint)"
        }
    }
    exit 2
}
if ($result.exit_code -ne 0) {
    if ($json.runtime_error) {
        throw "DB index fix-plan generator failed: $($json.runtime_error)"
    }
    throw "DB index fix-plan generator failed with exit code $($result.exit_code)."
}

$resolvedOutputPath = Resolve-OutputPath -Requested $OutputPath
$outputDirectory = Split-Path -Parent $resolvedOutputPath
if (-not [string]::IsNullOrWhiteSpace($outputDirectory) -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$extensionState = if ($json.extension_enabled) { "enabled" } else { "missing" }
$unusedIndexes = @()
if ($json.unused_indexes) {
    $unusedIndexes = @($json.unused_indexes)
}
$unusedCount = $unusedIndexes.Count

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# DB Index Fix Plan")
$lines.Add("")
$lines.Add("Generated_UTC: $generatedAt")
$lines.Add("Status: $($json.status)")
$lines.Add("pg_stat_statements: $extensionState")
$lines.Add("UnusedIndexCandidates: $unusedCount")
$lines.Add("shared_preload_libraries: $($json.shared_preload_libraries)")
$lines.Add("")
$lines.Add("## Step 1 - Enable pg_stat_statements")
$lines.Add("")
$lines.Add("Run this first to make query-performance decisions data-driven.")
$lines.Add("Important: SQL statements below run inside PostgreSQL, not directly in PowerShell.")
$lines.Add("")
$lines.Add('```sql')
$lines.Add("-- 1) Check preload setting")
$lines.Add("SHOW shared_preload_libraries;")
$lines.Add("")
$lines.Add("-- 2) If pg_stat_statements is missing from preload list, set it and restart PostgreSQL")
$lines.Add("-- Example (replace with full required list for your environment):")
$lines.Add("ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';")
$lines.Add("")
$lines.Add("-- 3) After restart, enable extension in the target database")
$lines.Add("CREATE EXTENSION IF NOT EXISTS pg_stat_statements;")
$lines.Add("")
$lines.Add("-- 4) Verify extension")
$lines.Add("SELECT extname FROM pg_extension WHERE extname = 'pg_stat_statements';")
$lines.Add('```')
$lines.Add("")
$lines.Add("## Step 1A - Run SQL from terminal (Prisma example, no psql required)")
$lines.Add("")
$lines.Add("From repo root:")
$lines.Add("")
$lines.Add('```powershell')
$lines.Add("cd .\server")
$lines.Add("@'")
$lines.Add("SHOW shared_preload_libraries;")
$lines.Add("CREATE EXTENSION IF NOT EXISTS pg_stat_statements;")
$lines.Add("'@ | npx prisma db execute --stdin")
$lines.Add('```')
$lines.Add("")
$lines.Add("If `ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';` was applied, restart PostgreSQL service/container, then re-run the SQL verify step.")
$lines.Add("")
$lines.Add("If your platform is managed Postgres (for example RDS/Cloud SQL), apply preload changes through its parameter-group mechanism, then restart.")
$lines.Add("")
$lines.Add("## Step 2 - Safety checks before dropping unused indexes")
$lines.Add("")
$lines.Add("Use this checklist for each candidate index:")
$lines.Add("")
$lines.Add('```sql')
$lines.Add("-- A) Confirm index definition")
$lines.Add("SELECT pg_get_indexdef('schema.index_name'::regclass);")
$lines.Add("")
$lines.Add("-- B) Confirm no constraint depends on the index")
$lines.Add("SELECT conname FROM pg_constraint WHERE conindid = 'schema.index_name'::regclass;")
$lines.Add("")
$lines.Add("-- C) Sample usage over a real traffic window (run multiple times)")
$lines.Add("SELECT now() AS sampled_at, idx_scan, idx_tup_read, idx_tup_fetch")
$lines.Add("FROM pg_stat_user_indexes")
$lines.Add("WHERE schemaname = 'schema' AND relname = 'table_name' AND indexrelname = 'index_name';")
$lines.Add('```')
$lines.Add("")
$lines.Add("Only drop indexes that remain unused across representative workload windows and are not required by constraints.")
$lines.Add("")
$lines.Add("## Step 3 - Candidate-specific SQL")
$lines.Add("")

if ($unusedCount -eq 0) {
    $lines.Add("No zero-scan non-primary, non-unique indexes were found in the sampled set.")
}
else {
    $candidateNumber = 1
    foreach ($candidate in $unusedIndexes) {
        $schemaName = [string]$candidate.schemaname
        $tableName = [string]$candidate.table_name
        $indexName = [string]$candidate.index_name
        $idxScan = [string]$candidate.idx_scan
        $sizeBytes = $candidate.index_size_bytes
        $sizeLabel = Convert-ToHumanBytes -Bytes $sizeBytes
        $indexDefinition = [string]$candidate.index_definition

        $qualifiedQuoted = ("{0}.{1}" -f (Quote-SqlIdentifier -Value $schemaName), (Quote-SqlIdentifier -Value $indexName))
        $schemaLiteral = Escape-SqlLiteral -Value $schemaName
        $tableLiteral = Escape-SqlLiteral -Value $tableName
        $indexLiteral = Escape-SqlLiteral -Value $indexName
        $rollbackStatement = To-CreateIndexConcurrentlyStatement -IndexDefinition $indexDefinition

        $lines.Add("### Candidate ${candidateNumber}: $schemaName.$indexName")
        $lines.Add("- table: $schemaName.$tableName")
        $lines.Add("- idx_scan: $idxScan")
        $lines.Add("- estimated_size: $sizeLabel")
        $lines.Add("")
        $lines.Add('```sql')
        $lines.Add("-- Guard check")
        $lines.Add("SELECT now() AS sampled_at, idx_scan, idx_tup_read, idx_tup_fetch")
        $lines.Add("FROM pg_stat_user_indexes")
        $lines.Add("WHERE schemaname = '$schemaLiteral' AND relname = '$tableLiteral' AND indexrelname = '$indexLiteral';")
        $lines.Add("")
        $lines.Add("-- Drop candidate (run during low-traffic window)")
        $lines.Add("DROP INDEX CONCURRENTLY IF EXISTS $qualifiedQuoted;")
        $lines.Add("")
        if (-not [string]::IsNullOrWhiteSpace($rollbackStatement)) {
            $lines.Add("-- Rollback (if query performance regresses)")
            $lines.Add($rollbackStatement)
        }
        else {
            $lines.Add("-- Rollback unavailable: capture index definition before dropping.")
        }
        $lines.Add('```')
        $lines.Add("")
        $candidateNumber += 1
    }
}

$content = ($lines -join [Environment]::NewLine)
Set-Content -LiteralPath $resolvedOutputPath -Value $content -Encoding UTF8

Write-Host "DB index remediation plan generated."
Write-Host "- output: $resolvedOutputPath"
Write-Host "- pg_stat_statements: $extensionState"
Write-Host "- unused index candidates: $unusedCount"
Write-Host ""
Write-Host "Next:"
Write-Host "1) Open plan: $resolvedOutputPath"
Write-Host "2) Execute Step 1 SQL in PostgreSQL (Step 1A includes Prisma terminal examples)."
Write-Host "3) Review candidate SQL and apply only after Guard checks."
Write-Host "4) Re-run '.\pg.ps1 db-index-check' after changes."
Write-Host ""
Write-Host "Troubleshooting:"
Write-Host "  - Use local command prefix: .\pg.ps1 ..."
Write-Host "  - If command set shows {install,start,...}, you hit global pg CLI from PATH."
Write-Host "  - SQL commands (SHOW/ALTER/CREATE/DROP) must run inside PostgreSQL, not directly in PowerShell."

exit 0
