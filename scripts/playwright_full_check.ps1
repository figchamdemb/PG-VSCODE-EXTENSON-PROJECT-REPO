param(
    [string]$ProjectRoot = "",
    [string]$WorkingDirectory = "",
    [string]$ConfigPath = "",
    [ValidateSet("minimal", "desktop", "full")]
    [string]$BrowserMatrix = "full",
    [switch]$InstallBrowsers
)

$ErrorActionPreference = "Stop"

function Resolve-ProjectRoot([string]$PathValue) {
    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    }
    $candidate = if ([System.IO.Path]::IsPathRooted($PathValue)) { $PathValue } else { Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path $PathValue }
    if (-not (Test-Path -LiteralPath $candidate)) {
        throw "ProjectRoot not found: $candidate"
    }
    return (Resolve-Path -LiteralPath $candidate).Path
}

$resolvedProjectRoot = Resolve-ProjectRoot $ProjectRoot
$resolvedWorkingDirectory = if ([string]::IsNullOrWhiteSpace($WorkingDirectory)) {
    $resolvedProjectRoot
}
else {
    if ([System.IO.Path]::IsPathRooted($WorkingDirectory)) {
        (Resolve-Path -LiteralPath $WorkingDirectory).Path
    }
    else {
        (Resolve-Path -LiteralPath (Join-Path $resolvedProjectRoot $WorkingDirectory)).Path
    }
}

function Ensure-Directory([string]$PathValue) {
    if (-not (Test-Path -LiteralPath $PathValue)) {
        New-Item -ItemType Directory -Path $PathValue -Force | Out-Null
    }
}

function Rel([string]$PathValue) {
    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return ""
    }
    $resolved = $PathValue
    try {
        if (Test-Path -LiteralPath $PathValue) {
            $resolved = (Resolve-Path -LiteralPath $PathValue).Path
        }
    }
    catch {
        $resolved = $PathValue
    }
    if ($resolved.StartsWith($resolvedProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $resolved.Substring($resolvedProjectRoot.Length).TrimStart([char[]]@('\', '/')).Replace('\\', '/')
    }
    return $resolved.Replace('\\', '/')
}

$authorScript = Join-Path $PSScriptRoot "playwright_author_suite.ps1"
$runScript = Join-Path $PSScriptRoot "playwright_smoke_check.ps1"
if (-not (Test-Path -LiteralPath $authorScript)) {
    throw "playwright_author_suite.ps1 not found."
}
if (-not (Test-Path -LiteralPath $runScript)) {
    throw "playwright_smoke_check.ps1 not found."
}

& $authorScript -ProjectRoot $resolvedProjectRoot -WorkingDirectory $resolvedWorkingDirectory
$authorExitCode = $LASTEXITCODE
if ($authorExitCode -ne 0) {
    Write-Host "Playwright full check blocked: authoring step failed."
    exit $authorExitCode
}

$runArgs = @{
    WorkingDirectory = $resolvedWorkingDirectory
    BrowserMatrix = $BrowserMatrix
    RunMode = "full"
}
if ($ConfigPath) {
    $runArgs["ConfigPath"] = $ConfigPath
}
if ($InstallBrowsers.IsPresent) {
    $runArgs["InstallBrowsers"] = $true
}

& $runScript @runArgs
$runExitCode = $LASTEXITCODE

$authorSummaryPath = Join-Path $resolvedProjectRoot "Memory-bank\_generated\playwright-authoring\playwright-authoring-latest.json"
$runSummaryPath = Join-Path $resolvedProjectRoot "Memory-bank\_generated\playwright-smoke\playwright-smoke-latest.json"
$authorSummary = $null
$runSummary = $null
if (Test-Path -LiteralPath $authorSummaryPath) {
    $authorSummary = Get-Content -LiteralPath $authorSummaryPath -Raw | ConvertFrom-Json -Depth 20
}
if (Test-Path -LiteralPath $runSummaryPath) {
    $runSummary = Get-Content -LiteralPath $runSummaryPath -Raw | ConvertFrom-Json -Depth 30
}

$summaryRoot = Join-Path $resolvedProjectRoot "Memory-bank\_generated\playwright-full-check"
Ensure-Directory $summaryRoot
$runDir = Join-Path $summaryRoot ((Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ"))
Ensure-Directory $runDir
$latestPath = Join-Path $summaryRoot "playwright-full-check-latest.json"
$summaryPath = Join-Path $runDir "summary.json"
$payload = [ordered]@{
    generated_at_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    project_root = $resolvedProjectRoot
    working_directory = $resolvedWorkingDirectory
    browser_matrix = $BrowserMatrix
    author_summary_path = $(if (Test-Path -LiteralPath $authorSummaryPath) { Rel $authorSummaryPath } else { "" })
    run_summary_path = $(if (Test-Path -LiteralPath $runSummaryPath) { Rel $runSummaryPath } else { "" })
    author_status = $(if ($authorSummary) { [string]$authorSummary.status } else { "missing" })
    run_status = $(if ($runSummary) { [string]$runSummary.status } else { "missing" })
    config_path = $(if ($runSummary -and $runSummary.config_path) { [string]$runSummary.config_path } elseif ($authorSummary -and $authorSummary.config_path) { [string]$authorSummary.config_path } else { "" })
    html_report_path = $(if ($runSummary) { [string]$runSummary.html_report_path } else { "" })
    json_report_path = $(if ($runSummary) { [string]$runSummary.json_report_path } else { "" })
    results_directory = $(if ($runSummary) { [string]$runSummary.results_directory } else { "" })
    failures_json_path = $(if ($runSummary) { [string]$runSummary.failures_json_path } else { "" })
    failures_markdown_path = $(if ($runSummary) { [string]$runSummary.failures_markdown_path } else { "" })
    failure_count = $(if ($runSummary) { [int]$runSummary.failure_count } else { 0 })
    authored_routes = $(if ($authorSummary) { @($authorSummary.selected_routes) } else { @() })
    generated_files = $(if ($authorSummary) { @($authorSummary.generated_files) } else { @() })
    status = $(if ($runExitCode -eq 0) { "pass" } else { "blocked" })
}

($payload | ConvertTo-Json -Depth 20) | Set-Content -LiteralPath $summaryPath -Encoding utf8
($payload | ConvertTo-Json -Depth 20) | Set-Content -LiteralPath $latestPath -Encoding utf8
Write-Host ("- playwright_full_summary: {0}" -f (Rel $latestPath))
if ($payload.failures_markdown_path) {
    Write-Host ("- playwright_failure_list: {0}" -f $payload.failures_markdown_path)
}
Write-Host ("PG_PLAYWRIGHT_FULL_JSON:{0}" -f ($payload | ConvertTo-Json -Compress -Depth 20))

if ($runExitCode -ne 0) {
    Write-Host "Playwright full check blocked: authored suite found failures."
    exit 2
}
Write-Host "Playwright full check passed."
exit 0
