param(
    [ValidateSet("auto", "approve", "needs_change", "reject")]
    [string]$Mode = "auto",
    [string]$LogFile = "Memory-bank/_generated/governance-worker-execution.log",
    [string]$QueueFile = "Memory-bank/_generated/governance-agent-queue.jsonl"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedLogFile = if ([System.IO.Path]::IsPathRooted($LogFile)) {
    $LogFile
} else {
    Join-Path $repoRoot $LogFile
}
$resolvedQueueFile = if ([System.IO.Path]::IsPathRooted($QueueFile)) {
    $QueueFile
} else {
    Join-Path $repoRoot $QueueFile
}

$directory = Split-Path -Parent $resolvedLogFile
if (-not (Test-Path -LiteralPath $directory)) {
    New-Item -Path $directory -ItemType Directory -Force | Out-Null
}
$queueDirectory = Split-Path -Parent $resolvedQueueFile
if (-not (Test-Path -LiteralPath $queueDirectory)) {
    New-Item -Path $queueDirectory -ItemType Directory -Force | Out-Null
}

$timestamp = [DateTime]::UtcNow.ToString("o")
$effectiveMode = if ($Mode -eq "auto") {
    if ($env:PG_GOV_DECISION) { $env:PG_GOV_DECISION } else { "approve" }
} else {
    $Mode
}
$entry = @(
    "[{0}] governance action applied" -f $timestamp
    "event_id={0}" -f $env:PG_GOV_EVENT_ID
    "decision={0}" -f $env:PG_GOV_DECISION
    "mode={0}" -f $effectiveMode
    "thread_id={0}" -f $env:PG_GOV_THREAD_ID
    "option={0}" -f $env:PG_GOV_WINNING_OPTION_KEY
    "action_source={0}" -f $env:PG_GOV_ACTION_SOURCE
    "action_key={0}" -f $env:PG_GOV_ACTION_KEY
    "summary={0}" -f $env:PG_GOV_SUMMARY
) -join " | "

Add-Content -LiteralPath $resolvedLogFile -Value $entry -Encoding UTF8

$queueRecord = @{
    event_id = $env:PG_GOV_EVENT_ID
    thread_id = $env:PG_GOV_THREAD_ID
    decision = $env:PG_GOV_DECISION
    mode = $effectiveMode
    winning_option_key = $env:PG_GOV_WINNING_OPTION_KEY
    action_source = $env:PG_GOV_ACTION_SOURCE
    action_key = $env:PG_GOV_ACTION_KEY
    summary = $env:PG_GOV_SUMMARY
    queued_at = $timestamp
}
Add-Content -LiteralPath $resolvedQueueFile -Value ($queueRecord | ConvertTo-Json -Compress) -Encoding UTF8

Write-Output ("governance action queued for local agent (event={0}, mode={1})" -f $env:PG_GOV_EVENT_ID, $effectiveMode)
