param(
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string]$ManifestPath = "",
    [string[]]$ScanPath = @(),
    [string]$ProjectFramework = "",
    [string]$NodeVersion = "",
    [ValidateRange(1, 2000)]
    [int]$MaxFiles = 400,
    [ValidateSet("legacy", "standard", "strict")]
    [string]$ProdProfile = "standard",
    [switch]$IncludeDevDependencies,
    [switch]$EnableApiContractCheck,
    [switch]$EnableDbIndexMaintenanceCheck,
    [switch]$EnablePlaywrightSmokeCheck,
    [switch]$SkipFunctionChecks,
    [string]$PlaywrightWorkingDirectory = "",
    [string]$PlaywrightConfigPath = "",
    [ValidateSet("minimal", "desktop", "full")]
    [string]$PlaywrightBrowserMatrix = "minimal",
    [switch]$InstallPlaywrightBrowsers,
    [string]$DatabaseUrl = "",
    [string]$StateFile = ""
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-DefaultStateFilePath {
    $root = Get-RepoRoot
    return Join-Path $root "Memory-bank\_generated\governance-agent-state.json"
}

function Read-AccessTokenFromState([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        return ""
    }
    $raw = Get-Content -LiteralPath $path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return ""
    }
    try {
        $json = ConvertFrom-Json -InputObject $raw
        if ($null -eq $json) {
            return ""
        }
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

function Assert-ServerReachable([string]$base) {
    $uri = "{0}/health" -f $base.TrimEnd("/")
    try {
        $health = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 10
        if (-not $health.ok) {
            throw "Health endpoint did not return ok=true."
        }
    } catch {
        throw "Cannot reach API health endpoint at $uri. Start backend server and retry."
    }
}

function Resolve-OptionalGatePlan(
    [string]$profile,
    [bool]$enableApiContract,
    [bool]$enableDbIndexMaintenance,
    [bool]$enablePlaywrightSmoke
) {
    $plan = [ordered]@{
        ApiContract = $false
        DbIndexMaintenance = $false
        PlaywrightSmoke = $true
    }

    switch ($profile) {
        "legacy" { }
        "standard" {
            $plan.ApiContract = $true
            $plan.DbIndexMaintenance = $true
        }
        "strict" {
            $plan.ApiContract = $true
            $plan.DbIndexMaintenance = $true
        }
        default {
            throw "Unsupported prod profile '$profile'. Use: legacy, standard, strict."
        }
    }

    if ($enableApiContract) {
        $plan.ApiContract = $true
    }
    if ($enableDbIndexMaintenance) {
        $plan.DbIndexMaintenance = $true
    }
    if ($enablePlaywrightSmoke) {
        $plan.PlaywrightSmoke = $true
    }

    return [pscustomobject]$plan
}

function Format-EnabledState([bool]$enabled) {
    if ($enabled) {
        return "on"
    }
    return "off"
}

$statePath = if ([string]::IsNullOrWhiteSpace($StateFile)) { Get-DefaultStateFilePath } else { $StateFile }
$token = Resolve-AccessToken -provided $AccessToken -statePath $statePath
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "No access token found. Pass -AccessToken, set PG_ACCESS_TOKEN, or run '.\pg.ps1 governance-login' first."
}

$optionalGatePlan = Resolve-OptionalGatePlan `
    -profile $ProdProfile `
    -enableApiContract $EnableApiContractCheck.IsPresent `
    -enableDbIndexMaintenance $EnableDbIndexMaintenanceCheck.IsPresent `
    -enablePlaywrightSmoke $EnablePlaywrightSmokeCheck.IsPresent

$runApiContractCheck = [bool]$optionalGatePlan.ApiContract
$runDbIndexMaintenanceCheck = [bool]$optionalGatePlan.DbIndexMaintenance
$runPlaywrightSmokeCheck = [bool]$optionalGatePlan.PlaywrightSmoke

Write-Host "PG Prod Check (baseline) starting..."
Write-Host ("- rollout profile: {0} (api-contract={1}, db-index={2}, playwright={3})" -f `
    $ProdProfile, `
    (Format-EnabledState -enabled $runApiContractCheck), `
    (Format-EnabledState -enabled $runDbIndexMaintenanceCheck), `
    (Format-EnabledState -enabled $runPlaywrightSmokeCheck))
$totalSteps = 3
if ($runApiContractCheck) {
    $totalSteps += 1
}
if ($runDbIndexMaintenanceCheck) {
    $totalSteps += 1
}
if ($runPlaywrightSmokeCheck) {
    $totalSteps += 1
}
$step = 1
Write-Host "- step $step/$($totalSteps): API health check"
Assert-ServerReachable -base $ApiBase

$step += 1
Write-Host "- step $step/$($totalSteps): strict dependency verification"
$verifyArgs = @{
    ApiBase = $ApiBase
    AccessToken = $token
}
if (-not [string]::IsNullOrWhiteSpace($ManifestPath)) {
    $verifyArgs["ManifestPath"] = $ManifestPath
}
if (-not [string]::IsNullOrWhiteSpace($ProjectFramework)) {
    $verifyArgs["ProjectFramework"] = $ProjectFramework
}
if (-not [string]::IsNullOrWhiteSpace($NodeVersion)) {
    $verifyArgs["NodeVersion"] = $NodeVersion
}
if (-not $IncludeDevDependencies.IsPresent) {
    $verifyArgs["DependenciesOnly"] = $true
}

& (Join-Path $PSScriptRoot "dependency_verify.ps1") @verifyArgs
$verifyExit = $LASTEXITCODE

if ($verifyExit -ne 0) {
    if ($verifyExit -eq 2) {
        Write-Host "PG Prod Check blocked by dependency policy violations."
        exit 2
    }
    Write-Host "PG Prod Check failed during dependency verification."
    exit $verifyExit
}

Write-Host "PG Prod Check passed (dependency baseline)."
$step += 1
Write-Host "- step $step/$($totalSteps): strict coding standards verification"
$codingArgs = @{
    ApiBase = $ApiBase
    AccessToken = $token
    ProjectFramework = if (-not [string]::IsNullOrWhiteSpace($ProjectFramework)) { $ProjectFramework } else { "unknown" }
    MaxFiles = $MaxFiles
    SkipFunctionChecks = $SkipFunctionChecks.IsPresent
}
if ($ScanPath -and $ScanPath.Count -gt 0) {
    $codingArgs["ScanPath"] = $ScanPath
}
& (Join-Path $PSScriptRoot "coding_verify.ps1") @codingArgs
$codingExit = $LASTEXITCODE

if ($codingExit -ne 0) {
    if ($codingExit -eq 2) {
        Write-Host "PG Prod Check blocked by coding standards policy violations."
        exit 2
    }
    Write-Host "PG Prod Check failed during coding standards verification."
    exit $codingExit
}

if ($runApiContractCheck) {
    $step += 1
    Write-Host "- step $step/$($totalSteps): strict API contract verification"
    $apiContractArgs = @{
        ApiBase = $ApiBase
        AccessToken = $token
        MaxFiles = $MaxFiles
    }
    if ($ScanPath -and $ScanPath.Count -gt 0) {
        $apiContractArgs["ScanPath"] = $ScanPath
    }
    & (Join-Path $PSScriptRoot "api_contract_verify.ps1") @apiContractArgs
    $apiContractExit = $LASTEXITCODE

    if ($apiContractExit -ne 0) {
        if ($apiContractExit -eq 2) {
            Write-Host "PG Prod Check blocked by API contract policy violations."
            exit 2
        }
        Write-Host "PG Prod Check failed during API contract verification."
        exit $apiContractExit
    }
}
else {
    Write-Host "PG Prod optional API contract check skipped. Use -EnableApiContractCheck or -ProdProfile standard/strict."
}

if ($runDbIndexMaintenanceCheck) {
    $step += 1
    Write-Host "- step $step/$($totalSteps): DB index maintenance verification"
    $dbCheckArgs = @{
        DatabaseUrl = $DatabaseUrl
    }
    & (Join-Path $PSScriptRoot "db_index_maintenance_check.ps1") @dbCheckArgs
    $dbCheckExit = $LASTEXITCODE

    if ($dbCheckExit -ne 0) {
        if ($dbCheckExit -eq 2) {
            Write-Host "PG Prod Check blocked by DB index maintenance verification."
            exit 2
        }
        Write-Host "PG Prod Check failed during DB index maintenance verification."
        exit $dbCheckExit
    }
}
else {
    Write-Host "PG Prod optional DB index maintenance check skipped. Use -EnableDbIndexMaintenanceCheck or -ProdProfile standard/strict."
}

$step += 1
Write-Host "- step $step/$($totalSteps): Playwright UI smoke verification"
$resolvedPlaywrightWorkingDirectory = $PlaywrightWorkingDirectory
if ([string]::IsNullOrWhiteSpace($resolvedPlaywrightWorkingDirectory)) {
    $serverCandidate = Join-Path (Get-RepoRoot) "server"
    if (Test-Path -LiteralPath $serverCandidate) {
        $resolvedPlaywrightWorkingDirectory = $serverCandidate
    }
}
$playwrightArgs = @{
    WorkingDirectory = $resolvedPlaywrightWorkingDirectory
    ConfigPath = $PlaywrightConfigPath
    BrowserMatrix = $PlaywrightBrowserMatrix
}
if ($InstallPlaywrightBrowsers.IsPresent) {
    $playwrightArgs["InstallBrowsers"] = $true
}
& (Join-Path $PSScriptRoot "playwright_smoke_check.ps1") @playwrightArgs
$playwrightExit = $LASTEXITCODE

if ($playwrightExit -ne 0) {
    if ($playwrightExit -eq 2) {
        Write-Host "PG Prod Check blocked by Playwright smoke verification."
        exit 2
    }
    Write-Host "PG Prod Check failed during Playwright smoke verification."
    exit $playwrightExit
}

Write-Host ("PG Prod Check passed (profile: {0}; dependency + coding + mandatory Playwright + configured profile gates)." -f $ProdProfile)
exit 0
