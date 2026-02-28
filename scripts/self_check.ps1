param(
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string[]]$ScanPath = @(),
    [string[]]$ChangedPath = @(),
    [string]$ProjectFramework = "unknown",
    [ValidateRange(1, 2000)]
    [int]$MaxFiles = 400,
    [switch]$IncludeDevDependencies,
    [switch]$SkipFunctionChecks,
    [switch]$EnableDbIndexMaintenanceCheck,
    [string]$DatabaseUrl = "",
    [ValidateRange(1, 1000)]
    [int]$DbMaxRows = 25,
    [string]$DbPlanOutputPath = "",
    [switch]$SkipAutoDbFixPlan,
    [switch]$EnablePlaywrightSmokeCheck,
    [string]$PlaywrightWorkingDirectory = "",
    [string]$PlaywrightConfigPath = "",
    [switch]$WarnOnly,
    [string]$StateFile = ""
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
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
        SkipFunctionChecks = $SkipFunctionChecks.IsPresent
        StateFile = $StateFile
    }
    if ($WarnOnly.IsPresent) {
        $args["WarnOnly"] = $true
    }
    if ($ScanPath -and $ScanPath.Count -gt 0) {
        $args["ScanPath"] = $ScanPath
    }
    if ($Targets -and $Targets.Count -gt 0) {
        $args["ChangedPath"] = $Targets
    }

    $output = & (Join-Path $PSScriptRoot "enforcement_trigger.ps1") @args
    $exitCode = $LASTEXITCODE
    $outputText = ($output | Out-String)
    if ($exitCode -eq 1 -and $outputText -match "blocked by policy violations") {
        return 2
    }
    return $exitCode
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
    }
    # Prevent stdout lines from being interpreted as the return value; keep logs visible.
    & (Join-Path $PSScriptRoot "playwright_smoke_check.ps1") @args | Out-Host
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

Write-Host "- step 1/3: post-write enforcement trigger"
$enforcementExit = Invoke-PostWriteEnforcement -Root $repoRoot -Targets $changedTargets
if ($enforcementExit -eq 2) {
    $hasBlockers = $true
}
elseif ($enforcementExit -ne 0) {
    $hasRuntimeError = $true
}

if ($EnableDbIndexMaintenanceCheck.IsPresent) {
    Write-Host "- step 2/3: DB index maintenance check (JSON mode)"
    $dbCheck = Invoke-DbMaintenanceJson
    if ($dbCheck.exit_code -eq 2) {
        $hasBlockers = $true
    }
    elseif ($dbCheck.exit_code -ne 0) {
        $hasRuntimeError = $true
        if (-not [string]::IsNullOrWhiteSpace($dbCheck.output)) {
            Write-Warning "DB index check returned runtime error output."
            Write-Host $dbCheck.output
        }
    }
    elseif ($dbCheck.payload) {
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
}
else {
    Write-Host "- step 2/3: DB index check skipped (use -EnableDbIndexMaintenanceCheck to run)"
}

if ($EnablePlaywrightSmokeCheck.IsPresent) {
    Write-Host "- step 3/3: Playwright smoke check"
    $playwrightExit = Invoke-PlaywrightSmoke
    if ($playwrightExit -eq 2) {
        $hasBlockers = $true
    }
    elseif ($playwrightExit -ne 0) {
        $hasRuntimeError = $true
    }
}
else {
    Write-Host "- step 3/3: Playwright smoke skipped (use -EnablePlaywrightSmokeCheck to run)"
}

if ($hasRuntimeError) {
    if ($WarnOnly.IsPresent) {
        Write-Warning "PG Self Check encountered runtime errors but is continuing in warn mode."
        exit 0
    }
    Write-Host "PG Self Check failed due to runtime errors."
    exit 1
}

if ($hasBlockers) {
    if ($WarnOnly.IsPresent) {
        Write-Warning "PG Self Check detected blockers but is continuing in warn mode."
        exit 0
    }
    Write-Host "PG Self Check blocked by policy violations."
    exit 2
}

Write-Host "PG Self Check passed."
exit 0
