param(
    [ValidateSet("start-session", "post-write", "pre-push")]
    [string]$Phase = "start-session",
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string]$ManifestPath = "",
    [string[]]$ScanPath = @(),
    [string[]]$ChangedPath = @(),
    [string]$ProjectFramework = "unknown",
    [string]$NodeVersion = "",
    [ValidateRange(1, 2000)]
    [int]$MaxFiles = 400,
    [switch]$IncludeDevDependencies,
    [switch]$SkipFunctionChecks,
    [switch]$EnableDbIndexMaintenanceCheck,
    [string]$DatabaseUrl = "",
    [switch]$WarnOnly,
    [switch]$Json,
    [string]$StateFile = ""
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-DefaultStateFilePath {
    return Join-Path (Get-RepoRoot) "Memory-bank\_generated\governance-agent-state.json"
}

function Read-AccessTokenFromState([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        return ""
    }
    try {
        $raw = Get-Content -LiteralPath $path -Raw
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return ""
        }
        $json = ConvertFrom-Json -InputObject $raw
        return [string]$json.access_token
    } catch {
        return ""
    }
}

function Resolve-AccessToken([string]$provided, [string]$statePath) {
    if (-not [string]::IsNullOrWhiteSpace($provided)) {
        return $provided
    }
    if (-not [string]::IsNullOrWhiteSpace($env:PG_ACCESS_TOKEN)) {
        return [string]$env:PG_ACCESS_TOKEN
    }
    return Read-AccessTokenFromState -path $statePath
}

function Get-StagedChangedPaths([string]$root) {
    $out = & git -C $root diff --cached --name-only --diff-filter=ACMR
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($out)) {
        return @()
    }
    $paths = @()
    foreach ($line in ($out -split "`r?`n")) {
        $trimmed = $line.Trim()
        if (-not $trimmed) {
            continue
        }
        $candidate = Join-Path $root $trimmed
        if (Test-Path -LiteralPath $candidate) {
            $paths += (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    return $paths
}

function Resolve-ChangedScanTargets(
    [string]$root,
    [string[]]$requested,
    [string]$phase
) {
    if ($requested -and $requested.Count -gt 0) {
        $resolved = @()
        foreach ($item in $requested) {
            if ([string]::IsNullOrWhiteSpace($item)) {
                continue
            }
            $candidate = if ([System.IO.Path]::IsPathRooted($item)) { $item } else { Join-Path $root $item }
            if (Test-Path -LiteralPath $candidate) {
                $resolved += (Resolve-Path -LiteralPath $candidate).Path
            }
        }
        return $resolved
    }
    if ($phase -eq "pre-push") {
        return Get-StagedChangedPaths -root $root
    }
    return @()
}

function Should-RunDependencyCheck([string]$phase, [string[]]$changedPaths) {
    if ($phase -eq "start-session" -or $phase -eq "pre-push") {
        return $true
    }
    if (-not $changedPaths -or $changedPaths.Count -eq 0) {
        return $false
    }
    foreach ($path in $changedPaths) {
        $name = [System.IO.Path]::GetFileName($path).ToLowerInvariant()
        if ($name -in @("package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock")) {
            return $true
        }
    }
    return $false
}

function Invoke-DependencyCheck {
    param(
        [string]$Token
    )
    $args = @{
        ApiBase = $ApiBase
        AccessToken = $Token
    }
    if (-not [string]::IsNullOrWhiteSpace($ManifestPath)) {
        $args["ManifestPath"] = $ManifestPath
    }
    if (-not [string]::IsNullOrWhiteSpace($ProjectFramework)) {
        $args["ProjectFramework"] = $ProjectFramework
    }
    if (-not [string]::IsNullOrWhiteSpace($NodeVersion)) {
        $args["NodeVersion"] = $NodeVersion
    }
    if (-not $IncludeDevDependencies.IsPresent) {
        $args["DependenciesOnly"] = $true
    }
    & (Join-Path $PSScriptRoot "dependency_verify.ps1") @args
    return $LASTEXITCODE
}

function Invoke-CodingCheck {
    param(
        [string]$Token,
        [string[]]$ChangedTargets
    )
    $args = @{
        ApiBase = $ApiBase
        AccessToken = $Token
        ProjectFramework = $ProjectFramework
        MaxFiles = $MaxFiles
        SkipFunctionChecks = $SkipFunctionChecks.IsPresent
    }
    if ($ChangedTargets -and $ChangedTargets.Count -gt 0) {
        $args["ScanPath"] = $ChangedTargets
    } elseif ($ScanPath -and $ScanPath.Count -gt 0) {
        $args["ScanPath"] = $ScanPath
    }
    & (Join-Path $PSScriptRoot "coding_verify.ps1") @args
    return $LASTEXITCODE
}

function Invoke-DbIndexMaintenanceCheck {
    param(
        [string]$DbUrl
    )
    $args = @{
        DatabaseUrl = $DbUrl
    }
    & (Join-Path $PSScriptRoot "db_index_maintenance_check.ps1") @args
    return $LASTEXITCODE
}

$repoRoot = Get-RepoRoot
$statePath = if ([string]::IsNullOrWhiteSpace($StateFile)) { Get-DefaultStateFilePath } else { $StateFile }
$token = Resolve-AccessToken -provided $AccessToken -statePath $statePath

if ([string]::IsNullOrWhiteSpace($token)) {
    $message = "No access token available for enforcement trigger. Use -AccessToken, PG_ACCESS_TOKEN, or run '.\pg.ps1 governance-login'."
    if ($WarnOnly.IsPresent) {
        Write-Warning $message
        Write-Host "Enforcement trigger ($Phase) skipped in warn mode."
        exit 0
    }
    throw $message
}

$changedTargets = Resolve-ChangedScanTargets -root $repoRoot -requested $ChangedPath -phase $Phase
$runDependency = Should-RunDependencyCheck -phase $Phase -changedPaths $changedTargets

Write-Host "Enforcement trigger: $Phase"
Write-Host "- warn_only: $($WarnOnly.IsPresent)"
if ($changedTargets.Count -gt 0) {
    Write-Host "- changed_targets: $($changedTargets.Count)"
}

$hasBlockers = $false
$hasRuntimeError = $false

if ($runDependency) {
    Write-Host "- running dependency verification"
    $depExit = Invoke-DependencyCheck -Token $token
    if ($depExit -eq 2) {
        $hasBlockers = $true
    } elseif ($depExit -ne 0) {
        $hasRuntimeError = $true
    }
} else {
    Write-Host "- dependency verification skipped for phase '$Phase'"
}

Write-Host "- running coding standards verification"
$codingExit = Invoke-CodingCheck -Token $token -ChangedTargets $changedTargets
if ($codingExit -eq 2) {
    $hasBlockers = $true
} elseif ($codingExit -ne 0) {
    $hasRuntimeError = $true
}

if ($EnableDbIndexMaintenanceCheck.IsPresent) {
    Write-Host "- running DB index maintenance verification"
    $dbExit = Invoke-DbIndexMaintenanceCheck -DbUrl $DatabaseUrl
    if ($dbExit -eq 2) {
        $hasBlockers = $true
    } elseif ($dbExit -ne 0) {
        $hasRuntimeError = $true
    }
} else {
    Write-Host "- DB index maintenance verification skipped. Use -EnableDbIndexMaintenanceCheck to enforce."
}

# ── Report enforcement event to audit trail ──

function Send-EnforcementAuditEvent(
    [string]$AuditApiBase,
    [string]$AuditToken,
    [string]$AuditPhase,
    [string]$AuditStatus,
    [int]$BlockerCount,
    [int]$WarningCount,
    [string[]]$ChecksRun,
    [string]$FindingsSummary
) {
    try {
        $payload = @{
            phase = $AuditPhase
            status = $AuditStatus
            risk_score = if ($AuditStatus -eq "blocked") { 100 } elseif ($AuditStatus -eq "warn") { 50 } else { 0 }
            blocker_count = $BlockerCount
            warning_count = $WarningCount
            checks_run = $ChecksRun
            findings_summary = $FindingsSummary
            source = "cli"
        } | ConvertTo-Json -Depth 5 -Compress
        $headers = @{
            "Authorization" = "Bearer $AuditToken"
            "Content-Type" = "application/json"
        }
        Invoke-RestMethod -Uri "$AuditApiBase/account/policy/enforcement/event" `
            -Method Post -Body $payload -Headers $headers `
            -TimeoutSec 10 -ErrorAction SilentlyContinue | Out-Null
        Write-Host "- audit event reported"
    } catch {
        Write-Host "- audit event report skipped (server unreachable)"
    }
}

$checksRun = @()
if ($runDependency) { $checksRun += "dependency" }
$checksRun += "coding"
if ($EnableDbIndexMaintenanceCheck.IsPresent) { $checksRun += "db-index" }

$checkResults = [ordered]@{}
if ($runDependency) {
    $checkResults["dependency"] = if ($depExit -eq 0) { "pass" } elseif ($depExit -eq 2) { "blocked" } else { "error" }
} else {
    $checkResults["dependency"] = "skipped"
}
$checkResults["coding"] = if ($codingExit -eq 0) { "pass" } elseif ($codingExit -eq 2) { "blocked" } else { "error" }
if ($EnableDbIndexMaintenanceCheck.IsPresent) {
    $checkResults["db-index"] = if ($dbExit -eq 0) { "pass" } elseif ($dbExit -eq 2) { "blocked" } else { "error" }
} else {
    $checkResults["db-index"] = "skipped"
}

$blockerCount = 0
$warningCount = 0
if ($depExit -eq 2) { $blockerCount++ }
if ($codingExit -eq 2) { $blockerCount++ } elseif ($codingExit -ne 0) { $warningCount++ }
if ($EnableDbIndexMaintenanceCheck.IsPresent -and $dbExit -eq 2) { $blockerCount++ }

$auditStatus = if ($hasBlockers) { "blocked" } elseif ($hasRuntimeError) { "error" } elseif ($warningCount -gt 0) { "warn" } else { "pass" }
$findingsSummary = "Phase=$Phase blockers=$blockerCount warnings=$warningCount checks=($($checksRun -join ','))"

Send-EnforcementAuditEvent `
    -AuditApiBase $ApiBase -AuditToken $token `
    -AuditPhase $Phase -AuditStatus $auditStatus `
    -BlockerCount $blockerCount -WarningCount $warningCount `
    -ChecksRun $checksRun -FindingsSummary $findingsSummary

function Write-JsonResult([string]$resultStatus, [int]$exitCode) {
    if (-not $Json.IsPresent) { return }
    $result = [ordered]@{
        phase = $Phase
        status = $resultStatus
        blocker_count = $blockerCount
        warning_count = $warningCount
        checks_run = $checksRun
        check_results = $checkResults
        warn_only = [bool]$WarnOnly.IsPresent
    }
    $line = ConvertTo-Json -InputObject $result -Depth 5 -Compress
    Write-Host "PG_ENFORCEMENT_JSON:$line"
}

if ($hasRuntimeError) {
    if ($WarnOnly.IsPresent) {
        Write-Warning "Enforcement trigger encountered runtime errors but is continuing in warn mode."
        Write-JsonResult -resultStatus "error" -exitCode 0
        exit 0
    }
    Write-Host "Enforcement trigger failed due to runtime errors."
    Write-JsonResult -resultStatus "error" -exitCode 1
    exit 1
}

if ($hasBlockers) {
    if ($WarnOnly.IsPresent) {
        Write-Warning "Enforcement trigger found policy blockers but is continuing in warn mode."
        Write-JsonResult -resultStatus "blocked" -exitCode 0
        exit 0
    }
    Write-Host "Enforcement trigger blocked by policy violations."
    Write-JsonResult -resultStatus "blocked" -exitCode 2
    exit 2
}

Write-Host "Enforcement trigger passed."
Write-JsonResult -resultStatus "pass" -exitCode 0
exit 0
