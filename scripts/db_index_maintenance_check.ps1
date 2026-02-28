param(
    [string]$DatabaseUrl = "",
    [string]$ServerEnvPath = "",
    [ValidateRange(1, 1000000)]
    [int]$SeqScanThreshold = 1000,
    [ValidateRange(1, 100000000)]
    [int]$MinLiveTuples = 10000,
    [ValidateRange(1, 1000)]
    [int]$MaxRows = 50,
    [switch]$Json
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

function Invoke-NodeMaintenanceCheck {
    param(
        [string]$ServerDir,
        [hashtable]$Config
    )
    $node = Get-Command "node" -ErrorAction SilentlyContinue
    if ($null -eq $node) {
        throw "Node.js is required to run DB maintenance verification."
    }

    $jsonConfig = $Config | ConvertTo-Json -Depth 10 -Compress
    $env:PG_DB_MAINTENANCE_CONFIG = $jsonConfig

    $nodeScript = @'
const { PrismaClient } = require("@prisma/client");

function normalizeNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.floor(n);
}

async function main() {
  const cfgRaw = process.env.PG_DB_MAINTENANCE_CONFIG || "{}";
  let cfg = {};
  try {
    cfg = JSON.parse(cfgRaw);
  } catch {
    cfg = {};
  }

  const databaseUrl = String(cfg.database_url || "").trim();
  if (!databaseUrl) {
    console.log(JSON.stringify({
      ok: false,
      status: "blocked",
      runtime_error: null,
      blockers: [
        {
          rule_id: "DBM-INPUT-001",
          severity: "blocker",
          message: "DATABASE_URL is not set for DB maintenance verification.",
          hint: "Pass -DatabaseUrl, set DATABASE_URL env var, or configure server/.env."
        }
      ],
      warnings: [],
      summary: {
        blockers: 1,
        warnings: 0,
        checked: 0
      }
    }));
    process.exit(2);
    return;
  }

  process.env.DATABASE_URL = databaseUrl;
  const seqScanThreshold = normalizeNumber(cfg.seq_scan_threshold, 1000);
  const minLiveTuples = normalizeNumber(cfg.min_live_tuples, 10000);
  const maxRows = normalizeNumber(cfg.max_rows, 50);
  const prisma = new PrismaClient();

  const blockers = [];
  const warnings = [];
  try {
    const invalidIndexes = await prisma.$queryRawUnsafe(`
      SELECT ns.nspname AS schema_name, c.relname AS index_name
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE i.indisvalid = false
        AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY ns.nspname, c.relname
      LIMIT ${maxRows}
    `);
    if (Array.isArray(invalidIndexes) && invalidIndexes.length > 0) {
      blockers.push({
        rule_id: "DBM-IND-001",
        severity: "blocker",
        message: `Invalid indexes detected (${invalidIndexes.length}).`,
        hint: "Rebuild invalid indexes using REINDEX INDEX CONCURRENTLY or drop/recreate safely."
      });
    }

    const extRows = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
      ) AS enabled
    `);
    const extensionEnabled = Array.isArray(extRows) && extRows.length > 0
      ? Boolean(extRows[0].enabled)
      : false;
    if (!extensionEnabled) {
      blockers.push({
        rule_id: "DBM-EXT-001",
        severity: "blocker",
        message: "pg_stat_statements extension is not enabled.",
        hint: "Enable pg_stat_statements for query performance observability."
      });
    }

    const highSeqScans = await prisma.$queryRawUnsafe(`
      SELECT
        schemaname,
        relname,
        seq_scan,
        idx_scan,
        n_live_tup,
        ROUND((100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0))::numeric, 2) AS pct_sequential
      FROM pg_stat_user_tables
      WHERE seq_scan > ${seqScanThreshold}
        AND n_live_tup > ${minLiveTuples}
      ORDER BY seq_scan DESC
      LIMIT ${maxRows}
    `);
    if (Array.isArray(highSeqScans) && highSeqScans.length > 0) {
      warnings.push({
        rule_id: "DBM-SCAN-001",
        severity: "warning",
        message: `High sequential scan pressure detected on ${highSeqScans.length} table(s).`,
        hint: "Review index strategy for heavily scanned tables and validate with EXPLAIN ANALYZE."
      });
    }

    const unusedIndexes = await prisma.$queryRawUnsafe(`
      SELECT
        s.schemaname,
        s.relname,
        s.indexrelname,
        s.idx_scan
      FROM pg_stat_user_indexes s
      JOIN pg_class c ON c.relname = s.indexrelname
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = s.schemaname
      JOIN pg_index i ON i.indexrelid = c.oid
      WHERE s.idx_scan = 0
        AND i.indisprimary = false
        AND i.indisunique = false
      ORDER BY s.schemaname, s.relname, s.indexrelname
      LIMIT ${maxRows}
    `);
    if (Array.isArray(unusedIndexes) && unusedIndexes.length > 0) {
      warnings.push({
        rule_id: "DBM-IND-002",
        severity: "warning",
        message: `Unused non-primary, non-unique indexes detected (${unusedIndexes.length}).`,
        hint: "Review pg_stat_user_indexes and remove truly unused non-unique indexes to reduce write overhead."
      });
    }

    const maintenanceLag = await prisma.$queryRawUnsafe(`
      SELECT
        schemaname,
        relname,
        n_live_tup,
        n_dead_tup,
        n_mod_since_analyze,
        COALESCE(last_autovacuum, last_vacuum) AS last_vacuum,
        COALESCE(last_autoanalyze, last_analyze) AS last_analyze
      FROM pg_stat_user_tables
      WHERE n_live_tup > ${minLiveTuples}
        AND (
          COALESCE(last_autovacuum, last_vacuum) IS NULL
          OR COALESCE(last_autoanalyze, last_analyze) IS NULL
          OR n_dead_tup > (n_live_tup * 0.20)
          OR n_mod_since_analyze > (n_live_tup * 0.20)
        )
      ORDER BY n_dead_tup DESC
      LIMIT ${maxRows}
    `);
    if (Array.isArray(maintenanceLag) && maintenanceLag.length > 0) {
      warnings.push({
        rule_id: "DBM-MAINT-001",
        severity: "warning",
        message: `VACUUM/ANALYZE lag or high dead tuples detected on ${maintenanceLag.length} table(s).`,
        hint: "Tune autovacuum/analyze settings and schedule targeted maintenance for high-write tables."
      });
    }

    const result = {
      ok: blockers.length === 0,
      status: blockers.length === 0 ? "pass" : "blocked",
      runtime_error: null,
      blockers,
      warnings,
      summary: {
        blockers: blockers.length,
        warnings: warnings.length,
        checked: 5
      }
    };
    console.log(JSON.stringify(result));
    process.exit(blockers.length === 0 ? 0 : 2);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify({
      ok: false,
      status: "error",
      runtime_error: message,
      blockers: [],
      warnings: [],
      summary: {
        blockers: 0,
        warnings: 0,
        checked: 0
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
        Remove-Item Env:PG_DB_MAINTENANCE_CONFIG -ErrorAction SilentlyContinue
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
    seq_scan_threshold = $SeqScanThreshold
    min_live_tuples = $MinLiveTuples
    max_rows = $MaxRows
}

$result = Invoke-NodeMaintenanceCheck -ServerDir $serverDir -Config $config
$rawOutput = ($result.output | Out-String).Trim()
if ([string]::IsNullOrWhiteSpace($rawOutput)) {
    throw "DB maintenance verifier returned no output."
}

$rawClean = $rawOutput -replace [char]27 + '\[[0-9;]*[A-Za-z]', ''
$rawClean = $rawClean.Trim([char]0xFEFF).Trim()
$rawClean = -join ($rawClean.ToCharArray() | Where-Object {
    $code = [int]$_
    ($code -ge 32 -and $code -ne 127) -or $_ -eq "`r" -or $_ -eq "`n" -or $_ -eq "`t"
})

if ($Json.IsPresent) {
    $jsonOut = $rawClean
    $startIndex = $rawClean.IndexOf("{")
    $endIndex = $rawClean.LastIndexOf("}")
    if ($startIndex -ge 0 -and $endIndex -gt $startIndex) {
        $jsonOut = $rawClean.Substring($startIndex, $endIndex - $startIndex + 1)
    }
    Write-Output $jsonOut

    if ($result.exit_code -eq 2) {
        exit 2
    }
    if ($result.exit_code -ne 0) {
        exit 1
    }
    exit 0
}

$jsonInput = $rawClean
$jsonStart = $rawClean.IndexOf("{")
$jsonEnd = $rawClean.LastIndexOf("}")
if ($jsonStart -ge 0 -and $jsonEnd -gt $jsonStart) {
    $jsonInput = $rawClean.Substring($jsonStart, $jsonEnd - $jsonStart + 1)
}

$json = $null
try {
    $json = ConvertFrom-Json -InputObject ([string]$jsonInput)
}
catch {
    $json = $null
}

if ($null -ne $json -and ($json -is [string])) {
    try {
        $json = ConvertFrom-Json -InputObject ([string]$json)
    }
    catch {
        $json = $null
    }
}

if ($null -ne $json -and ($json -is [System.Array]) -and $json.Count -gt 0) {
    $json = $json[0]
}

if ($null -ne $json) {
    $hasStatus = $false
    if ($json.PSObject -and $json.PSObject.Properties) {
        $hasStatus = ($json.PSObject.Properties.Name -contains "status")
    }
    if (-not $hasStatus) {
        $json = $null
    }
}

if ($null -eq $json) {
    Write-Warning "DB maintenance verifier returned non-parseable payload; showing raw output."
    Write-Host "Raw payload:"
    Write-Host $jsonInput
    Write-Host ""
    Write-Host "Quick remediation flow:"
    Write-Host "  .\pg.ps1 db-index-fix-plan -DbMaxRows 5 -DbPlanOutputPath .\Memory-bank\_generated\db-index-fix-plan-next5.md"
    if ($result.exit_code -eq 2) {
        exit 2
    }
    if ($result.exit_code -ne 0) {
        exit 1
    }
    exit 0
}

$statusText = [string]$json.status
$checkedText = [string]$json.summary.checked
$blockersText = [string]$json.summary.blockers
$warningsText = [string]$json.summary.warnings

if ([string]::IsNullOrWhiteSpace($statusText)) {
    $statusMatch = [regex]::Match($jsonInput, '"status"\s*:\s*"([^"]*)"')
    if ($statusMatch.Success) {
        $statusText = $statusMatch.Groups[1].Value
    }
}
if ([string]::IsNullOrWhiteSpace($checkedText)) {
    $checkedMatch = [regex]::Match($jsonInput, '"checked"\s*:\s*([0-9]+)')
    if ($checkedMatch.Success) {
        $checkedText = $checkedMatch.Groups[1].Value
    }
}
if ([string]::IsNullOrWhiteSpace($blockersText)) {
    $blockerMatch = [regex]::Match($jsonInput, '"blockers"\s*:\s*([0-9]+)')
    if ($blockerMatch.Success) {
        $blockersText = $blockerMatch.Groups[1].Value
    }
}
if ([string]::IsNullOrWhiteSpace($warningsText)) {
    $warningMatch = [regex]::Match($jsonInput, '"warnings"\s*:\s*([0-9]+)')
    if ($warningMatch.Success) {
        $warningsText = $warningMatch.Groups[1].Value
    }
}

Write-Host "DB index maintenance verification status: $statusText"
Write-Host "Checks: $checkedText | blockers: $blockersText | warnings: $warningsText"

if ($json.blockers -and $json.blockers.Count -gt 0) {
    Write-Host ""
    Write-Host "Blockers:"
    foreach ($item in $json.blockers) {
        Write-Host "- [$($item.rule_id)] $($item.message)"
        Write-Host "  hint: $($item.hint)"
    }
}

if ($json.warnings -and $json.warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "Warnings:"
    foreach ($item in $json.warnings) {
        Write-Host "- [$($item.rule_id)] $($item.message)"
        Write-Host "  hint: $($item.hint)"
    }
}

$hasFindings = ($json.blockers -and $json.blockers.Count -gt 0) -or ($json.warnings -and $json.warnings.Count -gt 0)
$parsedBlockerCount = 0
$parsedWarningCount = 0
[void][int]::TryParse($blockersText, [ref]$parsedBlockerCount)
[void][int]::TryParse($warningsText, [ref]$parsedWarningCount)
if ($parsedBlockerCount -gt 0 -or $parsedWarningCount -gt 0) {
    $hasFindings = $true
}
$hasExtensionBlocker = $false
if ($json.blockers) {
    $hasExtensionBlocker = (@($json.blockers | Where-Object { $_.rule_id -eq "DBM-EXT-001" }).Count -gt 0)
}
$hasUnusedIndexWarning = $false
if ($json.warnings) {
    $hasUnusedIndexWarning = (@($json.warnings | Where-Object { $_.rule_id -eq "DBM-IND-002" }).Count -gt 0)
}
if ($hasFindings) {
    Write-Host ""
    Write-Host "Quick remediation flow (run from repo root):"
    Write-Host "1) Generate SQL plan:"
    Write-Host "   .\pg.ps1 db-index-fix-plan -DbMaxRows 5 -DbPlanOutputPath .\Memory-bank\_generated\db-index-fix-plan-next5.md"
    Write-Host "2) Open the plan file and run SQL in PostgreSQL (psql/Prisma/pgAdmin):"
    Write-Host "   .\Memory-bank\_generated\db-index-fix-plan-next5.md"
    Write-Host "3) Re-check:"
    Write-Host "   .\pg.ps1 db-index-check"
    Write-Host ""
    Write-Host "Troubleshooting:"
    Write-Host "  - Use local command prefix: .\pg.ps1 ..."
    Write-Host "  - If '.\pg.ps1' is not recognized: cd '$repoRoot'"
    Write-Host "  - If command set shows {install,start,...}: you hit global pg CLI; rerun with .\pg.ps1"
    Write-Host "  - If terminal shows '>>': press Ctrl+C once, then rerun one command per line."

    if ($hasExtensionBlocker) {
        Write-Host ""
        Write-Host "pg_stat_statements quick fix (example using Prisma):"
        Write-Host "  cd .\server"
        Write-Host "  @'"
        Write-Host "  SHOW shared_preload_libraries;"
        Write-Host "  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
        Write-Host "  '@ | npx prisma db execute --stdin"
        Write-Host "  # If preload change was applied, restart PostgreSQL service/container, then re-run db-index-check."
    }

    if ($hasUnusedIndexWarning) {
        Write-Host ""
        Write-Host "Unused index warning cleanup:"
        Write-Host "  - Review one candidate at a time from the fix-plan."
        Write-Host "  - Run each candidate Guard check SQL before DROP INDEX CONCURRENTLY."
        Write-Host "  - Re-run '.\pg.ps1 db-index-check' after each small batch."
    }
}

if ($result.exit_code -eq 2) {
    exit 2
}
if ($result.exit_code -ne 0) {
    if ($json.runtime_error) {
        Write-Host ""
        Write-Host "Runtime error: $($json.runtime_error)"
    }
    exit 1
}
exit 0
