param(
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$PublicBaseUrl = "https://pg-ext.addresly.com",
    [string]$TeamKey = "TEAM-EXTENSON-PG",
    [string]$StateFile = "",
    [string]$ActionKey = "default-handler",
    [ValidateRange(1, 1000)]
    [int]$SyncLimit = 300,
    [switch]$SkipPublicChecks,
    [switch]$SkipWorker,
    [switch]$SkipCompile,
    [ValidateSet("strict", "local-core")]
    [string]$Mode = "strict",
    [switch]$Json
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Ensure-Text([object]$value, [string]$fallback = "") {
    if ($null -eq $value) {
        return $fallback
    }
    return [string]$value
}

function Parse-ReportCounts([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        return @{
            pass = 0
            fail = 0
            found = $false
        }
    }
    $content = Get-Content -LiteralPath $path -Raw
    $pass = 0
    $fail = 0
    $passMatch = [regex]::Match($content, "(?m)^- PASS:\s*(\d+)\s*$")
    $failMatch = [regex]::Match($content, "(?m)^- FAIL:\s*(\d+)\s*$")
    if ($passMatch.Success) {
        $pass = [int]$passMatch.Groups[1].Value
    }
    if ($failMatch.Success) {
        $fail = [int]$failMatch.Groups[1].Value
    }
    return @{
        pass = $pass
        fail = $fail
        found = ($passMatch.Success -or $failMatch.Success)
    }
}

function Parse-FailedSteps([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        return @()
    }
    $lines = Get-Content -LiteralPath $path
    $failed = @()
    foreach ($line in $lines) {
        if ($line -match '^## FAIL - (.+)$') {
            $failed += $Matches[1].Trim()
        }
    }
    return $failed
}

function Parse-StepStatuses([string]$path) {
    $map = @{}
    if (-not (Test-Path -LiteralPath $path)) {
        return $map
    }
    $lines = Get-Content -LiteralPath $path
    foreach ($line in $lines) {
        if ($line -match '^## (PASS|FAIL) - (.+)$') {
            $status = $Matches[1].Trim().ToUpperInvariant()
            $step = $Matches[2].Trim()
            $map[$step] = ($status -eq "PASS")
        }
    }
    return $map
}

function Invoke-PgSubcommand([string[]]$arguments) {
    $repoRoot = Get-RepoRoot
    $pgScript = Join-Path $repoRoot "pg.ps1"
    if (-not (Test-Path -LiteralPath $pgScript)) {
        throw "pg.ps1 was not found at repo root: $pgScript"
    }
    $invokeArgs = @("-ExecutionPolicy", "Bypass", "-File", $pgScript) + $arguments
    $output = & powershell @invokeArgs 2>&1 | Out-String
    return @{
        exit_code = $LASTEXITCODE
        output = (Ensure-Text $output).Trim()
        command = ".\pg.ps1 " + ($arguments -join " ")
    }
}

function Resolve-ReportPath([string]$name) {
    $repoRoot = Get-RepoRoot
    return Join-Path $repoRoot ("Memory-bank\_generated\{0}" -f $name)
}

function Write-MarkdownReport(
    [string]$path,
    [hashtable]$slack,
    [hashtable]$narrate,
    [string]$mode,
    [bool]$ok
) {
    $lines = @()
    $lines += "# Milestone Closure Check"
    $lines += ""
    $lines += "UTC: $([DateTime]::UtcNow.ToString('o'))"
    $lines += "Mode: $mode"
    $lines += "Overall: $(if ($ok) { "PASS" } else { "FAIL" })"
    $lines += ""
    $lines += "## Slack Transport (10F)"
    $lines += "- Command: $($slack.command)"
    $lines += "- Exit Code: $($slack.exit_code)"
    $lines += "- PASS: $($slack.pass)"
    $lines += "- FAIL: $($slack.fail)"
    $lines += "- Report: $($slack.report)"
    if (-not [string]::IsNullOrWhiteSpace($slack.output)) {
        $lines += ""
        $lines += '```text'
        $lines += $slack.output
        $lines += '```'
    }
    $lines += ""
    $lines += "## Narrate Flow (10G)"
    $lines += "- Command: $($narrate.command)"
    $lines += "- Exit Code: $($narrate.exit_code)"
    $lines += "- PASS: $($narrate.pass)"
    $lines += "- FAIL: $($narrate.fail)"
    $lines += "- Report: $($narrate.report)"
    if (-not [string]::IsNullOrWhiteSpace($narrate.output)) {
        $lines += ""
        $lines += '```text'
        $lines += $narrate.output
        $lines += '```'
    }

    $directory = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -Path $directory -ItemType Directory -Force | Out-Null
    }
    Set-Content -LiteralPath $path -Value ($lines -join "`n") -Encoding UTF8
}

$slackArgs = @(
    "slack-check",
    "-ApiBase", $ApiBase,
    "-PublicBaseUrl", $PublicBaseUrl,
    "-TeamKey", $TeamKey,
    "-ActionKey", $ActionKey,
    "-SyncLimit", [string]$SyncLimit
)
if (-not [string]::IsNullOrWhiteSpace($StateFile)) {
    $slackArgs += @("-StateFile", $StateFile)
}
if ($SkipPublicChecks.IsPresent) {
    $slackArgs += "-SkipPublicChecks"
}
if ($SkipWorker.IsPresent) {
    $slackArgs += "-SkipWorker"
}

$narrateArgs = @("narrate-check")
if ($SkipCompile.IsPresent) {
    $narrateArgs += "-SkipCompile"
}

$slackRun = Invoke-PgSubcommand -arguments $slackArgs
$narrateRun = Invoke-PgSubcommand -arguments $narrateArgs

$slackReportPath = Resolve-ReportPath -name "slack-transport-check-latest.md"
$narrateReportPath = Resolve-ReportPath -name "narrate-flow-check-latest.md"
$closureReportPath = Resolve-ReportPath -name "milestone-closure-check-latest.md"

$slackCounts = Parse-ReportCounts -path $slackReportPath
$narrateCounts = Parse-ReportCounts -path $narrateReportPath
$slackFailedSteps = Parse-FailedSteps -path $slackReportPath
$slackStepStatus = Parse-StepStatuses -path $slackReportPath

$slackResult = @{
    command = $slackRun.command
    exit_code = [int]$slackRun.exit_code
    output = Ensure-Text $slackRun.output
    pass = [int]$slackCounts.pass
    fail = [int]$slackCounts.fail
    report = $slackReportPath
}
$narrateResult = @{
    command = $narrateRun.command
    exit_code = [int]$narrateRun.exit_code
    output = Ensure-Text $narrateRun.output
    pass = [int]$narrateCounts.pass
    fail = [int]$narrateCounts.fail
    report = $narrateReportPath
}

$slackLocalCoreOk = $true
if ($slackStepStatus.Count -eq 0) {
    $slackLocalCoreOk = $false
} else {
    $requiredLocalCoreSteps = @(
        "Local health endpoint",
        "Local Slack health endpoint",
        "Governance state token",
        "Create governance thread",
        "Vote thread (opt1)",
        "Finalize decision",
        "Bind thread action key",
        "Run governance worker once",
        "Verify ack applied"
    )
    foreach ($requiredStep in $requiredLocalCoreSteps) {
        if (-not $slackStepStatus.ContainsKey($requiredStep) -or -not [bool]$slackStepStatus[$requiredStep]) {
            $slackLocalCoreOk = $false
            break
        }
    }
}

$ok = $false
if ($Mode -eq "strict") {
    $ok = ($slackResult.exit_code -eq 0 -and $narrateResult.exit_code -eq 0)
} else {
    $ok = ($slackLocalCoreOk -and $narrateResult.exit_code -eq 0)
}

Write-MarkdownReport -path $closureReportPath -slack $slackResult -narrate $narrateResult -mode $Mode -ok $ok

$summary = [pscustomobject]@{
    utc = [DateTime]::UtcNow.ToString("o")
    mode = $Mode
    ok = $ok
    slack_local_core_ok = $slackLocalCoreOk
    slack_failed_steps = $slackFailedSteps
    slack = $slackResult
    narrate = $narrateResult
    report_file = $closureReportPath
}

if ($Json.IsPresent) {
    $summary | ConvertTo-Json -Depth 10
} else {
    Write-Host "Milestone closure check:"
    Write-Host ("- overall: {0}" -f $(if ($ok) { "PASS" } else { "FAIL" }))
    Write-Host ("- slack-check exit: {0} (pass={1}, fail={2})" -f $slackResult.exit_code, $slackResult.pass, $slackResult.fail)
    Write-Host ("- narrate-check exit: {0} (pass={1}, fail={2})" -f $narrateResult.exit_code, $narrateResult.pass, $narrateResult.fail)
    Write-Host ("Report: {0}" -f $closureReportPath)
}

if ($ok) {
    exit 0
}
exit 2
