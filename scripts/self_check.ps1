param(
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string[]]$ScanPath = @(),
    [string[]]$ChangedPath = @(),
    [string]$ProjectFramework = "unknown",
    [ValidateRange(1, 2000)]
    [int]$MaxFiles = 400,
    [switch]$IncludeDevDependencies,
    [switch]$SkipDependencyRegistryFetch,
    [switch]$SkipFunctionChecks,
    [switch]$EnableDbIndexMaintenanceCheck,
    [string]$DatabaseUrl = "",
    [switch]$AllowDbIndexConnectionWarning,
    [ValidateRange(1, 1000)]
    [int]$DbMaxRows = 25,
    [string]$DbPlanOutputPath = "",
    [switch]$SkipAutoDbFixPlan,
    [switch]$EnablePlaywrightSmokeCheck,
    [string]$PlaywrightWorkingDirectory = "",
    [string]$PlaywrightConfigPath = "",
    [ValidateSet("minimal", "desktop", "full")]
    [string]$PlaywrightBrowserMatrix = "minimal",
    [switch]$InstallPlaywrightBrowsers,
    [switch]$WarnOnly,
    [string]$StateFile = ""
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-SelfCheckSummaryPath {
    $generatedDir = Join-Path (Get-RepoRoot) "Memory-bank\_generated"
    if (-not (Test-Path -LiteralPath $generatedDir)) {
        New-Item -ItemType Directory -Path $generatedDir -Force | Out-Null
    }
    return Join-Path $generatedDir "self-check-latest.json"
}

function Write-SelfCheckSummary {
    param(
        [string]$Status,
        [int]$ExitCode,
        [hashtable]$CheckResults,
        [int]$ChangedTargetCount,
        [object]$EnforcementSummary = $null,
        [object]$PlaywrightSummary = $null
    )
    $summaryPath = Get-SelfCheckSummaryPath
    $repoRoot = Get-RepoRoot
    $payload = [ordered]@{
        generated_at_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        repo_root = $repoRoot
        status = $Status
        exit_code = $ExitCode
        warn_only = [bool]$WarnOnly.IsPresent
        enable_db_index_maintenance_check = [bool]$EnableDbIndexMaintenanceCheck.IsPresent
        enable_playwright_smoke_check = $true
        skip_dependency_registry_fetch = [bool]$SkipDependencyRegistryFetch.IsPresent
        allow_db_index_connection_warning = [bool]$AllowDbIndexConnectionWarning.IsPresent
        changed_target_count = $ChangedTargetCount
        check_results = $CheckResults
        command = "pg self-check"
        enforcement_summary = $EnforcementSummary
        playwright_smoke_summary = $PlaywrightSummary
    }
    ($payload | ConvertTo-Json -Depth 12) | Set-Content -LiteralPath $summaryPath -Encoding utf8
    $relativePath = $summaryPath.Replace((Get-RepoRoot), "").TrimStart("\")
    if (-not [string]::IsNullOrWhiteSpace($relativePath)) {
        Write-Host ("- self_check_summary: {0}" -f $relativePath.Replace("\", "/"))
    } else {
        Write-Host ("- self_check_summary: {0}" -f $summaryPath)
    }
}

function Resolve-ChangedPathsFromGit {
    param([string]$RepoRoot)

    $paths = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)

    $commands = @(
        @("diff", "--name-only", "--diff-filter=ACMR"),
        @("diff", "--cached", "--name-only", "--diff-filter=ACMR"),
        @("ls-files", "--others", "--exclude-standard")
    )

    foreach ($cmd in $commands) {
        try {
            $output = & git -C $RepoRoot @cmd 2>$null
            if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($output | Out-String))) {
                continue
            }
            foreach ($line in ($output -split "`r?`n")) {
                $trimmed = $line.Trim()
                if (-not $trimmed) {
                    continue
                }
                $candidate = Join-Path $RepoRoot $trimmed
                if (Test-Path -LiteralPath $candidate) {
                    $resolved = (Resolve-Path -LiteralPath $candidate).Path
                    $null = $paths.Add($resolved)
                }
            }
        }
        catch {
            continue
        }
    }

    return @($paths)
}

function Resolve-ChangedTargets {
    param(
        [string]$RepoRoot,
        [string[]]$Requested
    )
    if ($Requested -and $Requested.Count -gt 0) {
        $resolved = @()
        foreach ($item in $Requested) {
            if ([string]::IsNullOrWhiteSpace($item)) {
                continue
            }
            $candidate = if ([System.IO.Path]::IsPathRooted($item)) { $item } else { Join-Path $RepoRoot $item }
            if (Test-Path -LiteralPath $candidate) {
                $resolved += (Resolve-Path -LiteralPath $candidate).Path
            }
        }
        return @($resolved | Sort-Object -Unique)
    }
    return Resolve-ChangedPathsFromGit -RepoRoot $RepoRoot
}

function Invoke-PostWriteEnforcement {
    param(
        [string]$Root,
        [string[]]$Targets
    )
    $args = @{
        Phase = "post-write"
        ApiBase = $ApiBase
        AccessToken = $AccessToken
        ProjectFramework = $ProjectFramework
        MaxFiles = $MaxFiles
        IncludeDevDependencies = $IncludeDevDependencies.IsPresent
        SkipDependencyRegistryFetch = $SkipDependencyRegistryFetch.IsPresent
        SkipFunctionChecks = $SkipFunctionChecks.IsPresent
        StateFile = $StateFile
    }
    if ($WarnOnly.IsPresent) {
        $args["WarnOnly"] = $true
    }
    $args["Json"] = $true
    if ($ScanPath -and $ScanPath.Count -gt 0) {
        $args["ScanPath"] = $ScanPath
    }
    if ($Targets -and $Targets.Count -gt 0) {
        $args["ChangedPath"] = $Targets
    }

    $output = & (Join-Path $PSScriptRoot "enforcement_trigger.ps1") @args
    $exitCode = $LASTEXITCODE
    $outputText = ($output | Out-String)
    $parsed = Parse-MarkedJson -RawOutput $outputText -Marker "PG_ENFORCEMENT_JSON:"
    if ($exitCode -eq 1 -and $outputText -match "blocked by policy violations") {
        return @{
            exit_code = 2
            json = $parsed
        }
    }
    return @{
        exit_code = $exitCode
        json = $parsed
    }
}

function Parse-MarkedJson {
    param(
        [string]$RawOutput,
        [string]$Marker
    )
    if ([string]::IsNullOrWhiteSpace($RawOutput) -or [string]::IsNullOrWhiteSpace($Marker)) {
        return $null
    }
    $index = $RawOutput.IndexOf($Marker, [System.StringComparison]::Ordinal)
    if ($index -lt 0) {
        return $null
    }
    $jsonStart = $index + $Marker.Length
    $lineEnd = $RawOutput.IndexOf("`n", $jsonStart, [System.StringComparison]::Ordinal)
    $jsonText = if ($lineEnd -lt 0) {
        $RawOutput.Substring($jsonStart).Trim()
    }
    else {
        $RawOutput.Substring($jsonStart, $lineEnd - $jsonStart).Trim()
    }
    if ([string]::IsNullOrWhiteSpace($jsonText)) {
        return $null
    }
    try {
        return ConvertFrom-Json -InputObject $jsonText -ErrorAction Stop
    }
    catch {
        return $null
    }
}

function Invoke-DbMaintenanceJson {
    $args = @{
        Json = $true
        DatabaseUrl = $DatabaseUrl
    }
    $raw = & (Join-Path $PSScriptRoot "db_index_maintenance_check.ps1") @args
    $exitCode = $LASTEXITCODE
    $text = ($raw | Out-String).Trim()
    $parsed = $null
    if (-not [string]::IsNullOrWhiteSpace($text)) {
        try {
            $parsed = ConvertFrom-Json -InputObject $text
        }
        catch {
            $parsed = $null
        }
    }
    return @{
        exit_code = $exitCode
        output = $text
        payload = $parsed
    }
}

function Invoke-DbFixPlan {
    $args = @{
        DatabaseUrl = $DatabaseUrl
        MaxRows = $DbMaxRows
        OutputPath = $DbPlanOutputPath
    }
    & (Join-Path $PSScriptRoot "db_index_fix_plan.ps1") @args
    return $LASTEXITCODE
}

function Invoke-PlaywrightSmoke {
    param(
        [string]$BrowserMatrix,
        [bool]$InstallBrowsers
    )

    $resolvedWorkingDirectory = $PlaywrightWorkingDirectory
    if ([string]::IsNullOrWhiteSpace($resolvedWorkingDirectory)) {
        $serverCandidate = Join-Path (Get-RepoRoot) "server"
        if (Test-Path -LiteralPath $serverCandidate) {
            $resolvedWorkingDirectory = $serverCandidate
        }
    }

    $args = @{
        WorkingDirectory = $resolvedWorkingDirectory
        ConfigPath = $PlaywrightConfigPath
        BrowserMatrix = $BrowserMatrix
    }
    if ($InstallBrowsers) {
        $args["InstallBrowsers"] = $true
    }

    $output = & (Join-Path $PSScriptRoot "playwright_smoke_check.ps1") @args 2>&1
    $exitCode = $LASTEXITCODE
    if ($output) {
        $output | Out-Host
    }
    $outputText = ($output | Out-String)
    $parsed = Parse-MarkedJson -RawOutput $outputText -Marker "PG_PLAYWRIGHT_SMOKE_JSON:"
    return @{
        exit_code = $exitCode
        json = $parsed
    }
}

function Invoke-MemoryBankGuard {
    param([string]$Mode)

    & python (Join-Path $PSScriptRoot "memory_bank_guard.py") --mode $Mode --scope working-tree | Out-Host
    return $LASTEXITCODE
}

$repoRoot = Get-RepoRoot
$changedTargets = Resolve-ChangedTargets -RepoRoot $repoRoot -Requested $ChangedPath

Write-Host "PG Self Check (as-you-go) starting..."
if ($changedTargets.Count -gt 0) {
    Write-Host "- changed targets detected: $($changedTargets.Count)"
}
else {
    Write-Host "- changed targets: none detected (falling back to default scan behavior)"
}

$hasBlockers = $false
$hasRuntimeError = $false
$checkResults = [ordered]@{
    post_write_enforcement = "pending"
    db_index_maintenance = "skipped"
    playwright_smoke = "skipped"
    memory_bank_guard = "pending"
}
$playwrightSummary = $null

Write-Host "- step 1/3: post-write enforcement trigger"
$enforcementResult = Invoke-PostWriteEnforcement -Root $repoRoot -Targets $changedTargets
$enforcementExit = [int]$enforcementResult.exit_code
if ($enforcementExit -eq 2) {
    $hasBlockers = $true
    $checkResults["post_write_enforcement"] = "blocked"
}
elseif ($enforcementExit -ne 0) {
    $hasRuntimeError = $true
    $checkResults["post_write_enforcement"] = "error"
}
else {
    $checkResults["post_write_enforcement"] = "pass"
}

if ($EnableDbIndexMaintenanceCheck.IsPresent) {
    Write-Host "- step 2/3: DB index maintenance check (JSON mode)"
    $dbCheck = Invoke-DbMaintenanceJson
    if ($dbCheck.exit_code -eq 2) {
        $hasBlockers = $true
        $checkResults["db_index_maintenance"] = "blocked"
    }
    elseif ($dbCheck.exit_code -ne 0) {
        $dbOutputText = [string]$dbCheck.output
        $dbConnectionFailure = $dbOutputText -match "Can''t reach database server at"
        if ($AllowDbIndexConnectionWarning.IsPresent -and $dbConnectionFailure) {
            $checkResults["db_index_maintenance"] = "warning"
            Write-Warning "DB index check could not reach the configured database. Continuing because -AllowDbIndexConnectionWarning was provided."
            if (-not [string]::IsNullOrWhiteSpace($dbOutputText)) {
                Write-Host $dbOutputText
            }
        }
        else {
            $hasRuntimeError = $true
            $checkResults["db_index_maintenance"] = "error"
            if (-not [string]::IsNullOrWhiteSpace($dbOutputText)) {
                Write-Warning "DB index check returned runtime error output."
                Write-Host $dbOutputText
            }
        }
    }
    elseif ($dbCheck.payload) {
        $checkResults["db_index_maintenance"] = "pass"
        $dbBlockers = 0
        $dbWarnings = 0
        if ($dbCheck.payload.summary) {
            $dbBlockers = [int]$dbCheck.payload.summary.blockers
            $dbWarnings = [int]$dbCheck.payload.summary.warnings
        }
        Write-Host ("  DB summary: blockers={0} warnings={1}" -f $dbBlockers, $dbWarnings)

        $hasDbFindings = ($dbBlockers -gt 0) -or ($dbWarnings -gt 0)
        if ($hasDbFindings -and -not $SkipAutoDbFixPlan.IsPresent) {
            Write-Host "- generating DB remediation plan (auto) because findings were detected"
            $planExit = Invoke-DbFixPlan
            if ($planExit -ne 0) {
                $hasRuntimeError = $true
            }
        }
    }
    else {
        $checkResults["db_index_maintenance"] = "pass"
    }
}
else {
    Write-Host "- step 2/3: DB index check skipped (use -EnableDbIndexMaintenanceCheck to run)"
}

Write-Host "- step 3/3: Playwright smoke check (mandatory)"
$playwrightResult = Invoke-PlaywrightSmoke -BrowserMatrix $PlaywrightBrowserMatrix -InstallBrowsers $InstallPlaywrightBrowsers.IsPresent
$playwrightExit = [int]$playwrightResult.exit_code
$playwrightSummary = $playwrightResult.json
if ($playwrightExit -eq 2) {
    $hasBlockers = $true
    $checkResults["playwright_smoke"] = "blocked"
}
elseif ($playwrightExit -ne 0) {
    $hasRuntimeError = $true
    $checkResults["playwright_smoke"] = "error"
}
else {
    $checkResults["playwright_smoke"] = "pass"
}

if ($hasRuntimeError) {
    $checkResults["memory_bank_guard"] = "skipped"
    if ($WarnOnly.IsPresent) {
        Write-Warning "PG Self Check encountered runtime errors but is continuing in warn mode."
        Write-SelfCheckSummary -Status "error" -ExitCode 0 -CheckResults $checkResults -ChangedTargetCount $changedTargets.Count -EnforcementSummary $enforcementResult.json -PlaywrightSummary $playwrightSummary
        exit 0
    }
    Write-Host "PG Self Check failed due to runtime errors."
    Write-SelfCheckSummary -Status "error" -ExitCode 1 -CheckResults $checkResults -ChangedTargetCount $changedTargets.Count -EnforcementSummary $enforcementResult.json -PlaywrightSummary $playwrightSummary
    exit 1
}

if ($hasBlockers) {
    $checkResults["memory_bank_guard"] = "skipped"
    if ($WarnOnly.IsPresent) {
        Write-Warning "PG Self Check detected blockers but is continuing in warn mode."
        Write-SelfCheckSummary -Status "warn" -ExitCode 0 -CheckResults $checkResults -ChangedTargetCount $changedTargets.Count -EnforcementSummary $enforcementResult.json -PlaywrightSummary $playwrightSummary
        exit 0
    }
    Write-Host "PG Self Check blocked by policy violations."
    Write-SelfCheckSummary -Status "blocked" -ExitCode 2 -CheckResults $checkResults -ChangedTargetCount $changedTargets.Count -EnforcementSummary $enforcementResult.json -PlaywrightSummary $playwrightSummary
    exit 2
}

$guardMode = if ($WarnOnly.IsPresent) { "warn" } else { "strict" }
Write-SelfCheckSummary -Status "pass" -ExitCode 0 -CheckResults $checkResults -ChangedTargetCount $changedTargets.Count -EnforcementSummary $enforcementResult.json -PlaywrightSummary $playwrightSummary

Write-Host "- step 4/4: Memory-bank guard ($guardMode, working-tree)"
$guardExit = Invoke-MemoryBankGuard -Mode $guardMode
if ($guardExit -ne 0) {
    $checkResults["memory_bank_guard"] = "blocked"
    if ($WarnOnly.IsPresent) {
        Write-Warning "PG Self Check detected Memory-bank guard issues but is continuing in warn mode."
        Write-SelfCheckSummary -Status "warn" -ExitCode 0 -CheckResults $checkResults -ChangedTargetCount $changedTargets.Count -EnforcementSummary $enforcementResult.json -PlaywrightSummary $playwrightSummary
        exit 0
    }
    Write-Host "PG Self Check blocked by Memory-bank guard violations."
    Write-SelfCheckSummary -Status "blocked" -ExitCode 2 -CheckResults $checkResults -ChangedTargetCount $changedTargets.Count -EnforcementSummary $enforcementResult.json -PlaywrightSummary $playwrightSummary
    exit 2
}

$checkResults["memory_bank_guard"] = "pass"
Write-Host "PG Self Check passed."
Write-SelfCheckSummary -Status "pass" -ExitCode 0 -CheckResults $checkResults -ChangedTargetCount $changedTargets.Count -EnforcementSummary $enforcementResult.json -PlaywrightSummary $playwrightSummary
exit 0
