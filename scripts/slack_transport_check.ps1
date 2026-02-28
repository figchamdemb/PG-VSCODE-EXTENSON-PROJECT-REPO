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
    [switch]$Json
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-DefaultStateFilePath {
    return Join-Path (Get-RepoRoot) "Memory-bank\_generated\governance-agent-state.json"
}

function Ensure-Text([object]$value, [string]$fallback = "") {
    if ($null -eq $value) {
        return $fallback
    }
    return [string]$value
}

function Read-State([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "State file not found: $path"
    }
    $raw = Get-Content -LiteralPath $path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw "State file is empty: $path"
    }
    $parsed = ConvertFrom-Json -InputObject $raw
    if ($null -eq $parsed) {
        throw "State file is invalid JSON: $path"
    }
    return $parsed
}

function Write-State([string]$path, [object]$state) {
    $directory = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -Path $directory -ItemType Directory -Force | Out-Null
    }
    $json = $state | ConvertTo-Json -Depth 12
    Set-Content -LiteralPath $path -Value $json -Encoding UTF8
}

function Format-Details([object]$value) {
    if ($null -eq $value) {
        return ""
    }
    if ($value -is [string]) {
        return $value
    }
    try {
        return ($value | ConvertTo-Json -Depth 8 -Compress)
    } catch {
        return [string]$value
    }
}

function Add-Result(
    [System.Collections.Generic.List[object]]$results,
    [string]$step,
    [bool]$ok,
    [string]$details
) {
    $results.Add([pscustomobject]@{
            step = $step
            ok = $ok
            details = $details
        })
}

function Invoke-JsonGet([string]$uri, [hashtable]$headers = @{}) {
    return Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 15
}

function Invoke-JsonPost([string]$uri, [hashtable]$headers, [object]$body) {
    $jsonBody = $body | ConvertTo-Json -Depth 12
    return Invoke-RestMethod `
        -Method Post `
        -Uri $uri `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $jsonBody `
        -TimeoutSec 90
}

function Resolve-ReportPath {
    return Join-Path (Get-RepoRoot) "Memory-bank\_generated\slack-transport-check-latest.md"
}

function Write-MarkdownReport(
    [string]$path,
    [string]$apiBase,
    [string]$publicBaseUrl,
    [string]$threadId,
    [System.Collections.Generic.List[object]]$results
) {
    $passCount = @($results | Where-Object { $_.ok }).Count
    $failCount = @($results | Where-Object { -not $_.ok }).Count
    $lines = @()
    $lines += "# Slack Transport Check"
    $lines += ""
    $lines += "UTC: $([DateTime]::UtcNow.ToString('o'))"
    $lines += "API Base: $apiBase"
    if (-not [string]::IsNullOrWhiteSpace($publicBaseUrl)) {
        $lines += "Public Base: $publicBaseUrl"
    }
    if (-not [string]::IsNullOrWhiteSpace($threadId)) {
        $lines += "Thread ID: $threadId"
    }
    $lines += ""
    $lines += "- PASS: $passCount"
    $lines += "- FAIL: $failCount"
    $lines += ""

    foreach ($result in $results) {
        $status = if ($result.ok) { "PASS" } else { "FAIL" }
        $lines += "## $status - $($result.step)"
        $lines += ""
        $lines += '```text'
        $lines += (Ensure-Text $result.details "(no details)")
        $lines += '```'
        $lines += ""
    }

    $dir = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
    }
    Set-Content -LiteralPath $path -Value ($lines -join "`n") -Encoding UTF8
}

$results = New-Object System.Collections.Generic.List[object]
$threadId = ""
$reportPath = Resolve-ReportPath
$resolvedStateFile = if ([string]::IsNullOrWhiteSpace($StateFile)) { Get-DefaultStateFilePath } else { $StateFile }
$workerCursorBefore = $null

# Step 1: local backend health
try {
    $health = Invoke-JsonGet -uri ("{0}/health" -f $ApiBase.TrimEnd("/"))
    $ok = ($health.ok -eq $true)
    Add-Result -results $results -step "Local health endpoint" -ok $ok -details (Format-Details $health)
} catch {
    Add-Result -results $results -step "Local health endpoint" -ok $false -details $_.Exception.Message
}

# Step 2: local Slack health
try {
    $slackHealth = Invoke-JsonGet -uri ("{0}/integrations/slack/health" -f $ApiBase.TrimEnd("/"))
    $ok = ($slackHealth.ok -eq $true -and $slackHealth.commands_enabled -eq $true)
    Add-Result -results $results -step "Local Slack health endpoint" -ok $ok -details (Format-Details $slackHealth)
} catch {
    Add-Result -results $results -step "Local Slack health endpoint" -ok $false -details $_.Exception.Message
}

# Step 3/4: public reachability checks
if ($SkipPublicChecks.IsPresent) {
    Add-Result -results $results -step "Public health endpoint" -ok $true -details "Skipped by flag (-SkipPublicChecks)."
    Add-Result -results $results -step "Public Slack health endpoint" -ok $true -details "Skipped by flag (-SkipPublicChecks)."
} else {
    try {
        $publicHealth = Invoke-JsonGet -uri ("{0}/health" -f $PublicBaseUrl.TrimEnd("/"))
        $ok = ($publicHealth.ok -eq $true)
        Add-Result -results $results -step "Public health endpoint" -ok $ok -details (Format-Details $publicHealth)
    } catch {
        Add-Result -results $results -step "Public health endpoint" -ok $false -details $_.Exception.Message
    }
    try {
        $publicSlack = Invoke-JsonGet -uri ("{0}/integrations/slack/health" -f $PublicBaseUrl.TrimEnd("/"))
        $ok = ($publicSlack.ok -eq $true -and $publicSlack.commands_enabled -eq $true)
        Add-Result -results $results -step "Public Slack health endpoint" -ok $ok -details (Format-Details $publicSlack)
    } catch {
        Add-Result -results $results -step "Public Slack health endpoint" -ok $false -details $_.Exception.Message
    }
}

# Token/state load
$token = ""
try {
    $state = Read-State -path $resolvedStateFile
    $token = Ensure-Text $state.access_token
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "access_token is missing in governance state."
    }
    Add-Result -results $results -step "Governance state token" -ok $true -details ("State file loaded: {0}" -f $resolvedStateFile)
} catch {
    Add-Result -results $results -step "Governance state token" -ok $false -details $_.Exception.Message
}

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

if (-not [string]::IsNullOrWhiteSpace($token)) {
    # Step 5: account summary
    try {
        $summary = Invoke-JsonGet -uri ("{0}/account/summary" -f $ApiBase.TrimEnd("/")) -headers @{ Authorization = "Bearer $token" }
        $ok = ($summary.ok -eq $true)
        Add-Result -results $results -step "Account summary auth" -ok $ok -details (Format-Details @{
                ok = $summary.ok
                email = $summary.account.email
                plan = $summary.plan
            })
    } catch {
        Add-Result -results $results -step "Account summary auth" -ok $false -details $_.Exception.Message
    }

    # Step 6: create thread
    try {
        $stamp = [DateTime]::UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
        $thread = Invoke-JsonPost -uri ("{0}/account/governance/mastermind/thread/create" -f $ApiBase.TrimEnd("/")) -headers $headers -body @{
            team_key = $TeamKey
            title = "10F Transport Check $stamp"
            question = "Should worker apply approved decision end-to-end?"
            options = @(
                @{ option_key = "opt1"; title = "approve"; rationale = "ship now" },
                @{ option_key = "opt2"; title = "needs-change"; rationale = "adjust first" }
            )
        }
        $threadId = Ensure-Text $thread.thread_id
        $ok = (-not [string]::IsNullOrWhiteSpace($threadId))
        Add-Result -results $results -step "Create governance thread" -ok $ok -details (Format-Details $thread)
    } catch {
        Add-Result -results $results -step "Create governance thread" -ok $false -details $_.Exception.Message
    }

    # Step 7: vote
    if (-not [string]::IsNullOrWhiteSpace($threadId)) {
        try {
            $vote = Invoke-JsonPost -uri ("{0}/account/governance/mastermind/vote" -f $ApiBase.TrimEnd("/")) -headers $headers -body @{
                thread_id = $threadId
                option_key = "opt1"
                rationale = "transport check vote"
            }
            $ok = ($vote.ok -eq $true)
            Add-Result -results $results -step "Vote thread (opt1)" -ok $ok -details (Format-Details $vote)
        } catch {
            Add-Result -results $results -step "Vote thread (opt1)" -ok $false -details $_.Exception.Message
        }
    } else {
        Add-Result -results $results -step "Vote thread (opt1)" -ok $false -details "Skipped: thread_id unavailable."
    }

    # Step 8: finalize decision
    if (-not [string]::IsNullOrWhiteSpace($threadId)) {
        try {
            $decide = Invoke-JsonPost -uri ("{0}/account/governance/mastermind/decide" -f $ApiBase.TrimEnd("/")) -headers $headers -body @{
                thread_id = $threadId
                decision = "approve"
                option_key = "opt1"
                note = "transport check decide"
            }
            $ok = ($decide.ok -eq $true)
            Add-Result -results $results -step "Finalize decision" -ok $ok -details (Format-Details $decide)
        } catch {
            Add-Result -results $results -step "Finalize decision" -ok $false -details $_.Exception.Message
        }
    } else {
        Add-Result -results $results -step "Finalize decision" -ok $false -details "Skipped: thread_id unavailable."
    }

    # Step 9: bind + worker
    if (-not [string]::IsNullOrWhiteSpace($threadId)) {
        try {
            $bindOutput = & (Join-Path $PSScriptRoot "governance_bind_action.ps1") `
                -ThreadId $threadId `
                -ActionKey $ActionKey `
                -StateFile $resolvedStateFile 2>&1 | Out-String
            $bindDetails = if ([string]::IsNullOrWhiteSpace($bindOutput)) {
                "Binding command completed."
            } else {
                $bindOutput.Trim()
            }
            Add-Result -results $results -step "Bind thread action key" -ok $true -details $bindDetails
        } catch {
            Add-Result -results $results -step "Bind thread action key" -ok $false -details $_.Exception.Message
        }

        if ($SkipWorker.IsPresent) {
            Add-Result -results $results -step "Run governance worker once" -ok $true -details "Skipped by flag (-SkipWorker)."
        } else {
            try {
                try {
                    $stateBeforeWorker = Read-State -path $resolvedStateFile
                    if ($stateBeforeWorker.PSObject.Properties.Name -contains "cursor") {
                        $workerCursorBefore = [int]$stateBeforeWorker.cursor
                    }
                } catch {
                    # continue without cursor snapshot
                }
                $workerOutput = & (Join-Path $PSScriptRoot "governance_worker.ps1") `
                    -ApiBase $ApiBase `
                    -StateFile $resolvedStateFile `
                    -Once 2>&1 | Out-String
                $workerDetails = if ([string]::IsNullOrWhiteSpace($workerOutput)) {
                    "Worker command completed."
                } else {
                    $workerOutput.Trim()
                }
                Add-Result -results $results -step "Run governance worker once" -ok $true -details $workerDetails
            } catch {
                Add-Result -results $results -step "Run governance worker once" -ok $false -details $_.Exception.Message
            }
        }
    } else {
        Add-Result -results $results -step "Bind thread action key" -ok $false -details "Skipped: thread_id unavailable."
        Add-Result -results $results -step "Run governance worker once" -ok $false -details "Skipped: thread_id unavailable."
    }

    # Step 10: verify applied ack
    if (-not [string]::IsNullOrWhiteSpace($threadId)) {
        try {
            $pull = Invoke-JsonGet `
                -uri ("{0}/account/governance/sync/pull?since_sequence=0&limit={1}" -f $ApiBase.TrimEnd("/"), $SyncLimit) `
                -headers @{ Authorization = "Bearer $token" }
            $event = @($pull.events | Where-Object { $_.thread_id -eq $threadId } | Select-Object -First 1)
            if ($event.Count -eq 0) {
                throw "No decision event found for thread $threadId"
            }
            $ackStatus = Ensure-Text $event[0].ack.status
            $recoveryAttempted = $false
            $recoveryResetCursorTo = $null
            $recoveryOutput = ""
            $recoveryError = ""

            if ($ackStatus -ne "applied" -and -not $SkipWorker.IsPresent) {
                try {
                    $recoveryAttempted = $true
                    $targetSequence = [int]$event[0].sequence
                    $resetCursor = [Math]::Max(0, $targetSequence - 1)
                    if ($null -eq $targetSequence -and $null -ne $workerCursorBefore) {
                        $resetCursor = [Math]::Max(0, [int]$workerCursorBefore - 1)
                    }
                    $recoveryResetCursorTo = $resetCursor

                    $stateForRecovery = Read-State -path $resolvedStateFile
                    if ($stateForRecovery.PSObject.Properties.Name -contains "cursor") {
                        $stateForRecovery.cursor = $resetCursor
                    } else {
                        $stateForRecovery | Add-Member -NotePropertyName "cursor" -NotePropertyValue $resetCursor
                    }
                    Write-State -path $resolvedStateFile -state $stateForRecovery

                    $recoveryOutputRaw = & (Join-Path $PSScriptRoot "governance_worker.ps1") `
                        -ApiBase $ApiBase `
                        -StateFile $resolvedStateFile `
                        -Once 2>&1 | Out-String
                    if (-not [string]::IsNullOrWhiteSpace($recoveryOutputRaw)) {
                        $recoveryOutput = $recoveryOutputRaw.Trim()
                    }

                    $pullAfterRecovery = Invoke-JsonGet `
                        -uri ("{0}/account/governance/sync/pull?since_sequence=0&limit={1}" -f $ApiBase.TrimEnd("/"), $SyncLimit) `
                        -headers @{ Authorization = "Bearer $token" }
                    $eventAfterRecovery = @($pullAfterRecovery.events | Where-Object { $_.thread_id -eq $threadId } | Select-Object -First 1)
                    if ($eventAfterRecovery.Count -gt 0) {
                        $event = $eventAfterRecovery
                        $ackStatus = Ensure-Text $event[0].ack.status
                    }
                } catch {
                    $recoveryError = $_.Exception.Message
                }
            }

            $ok = ($ackStatus -eq "applied")
            Add-Result -results $results -step "Verify ack applied" -ok $ok -details (Format-Details @{
                    thread_id = $threadId
                    event_id = $event[0].id
                    sequence = $event[0].sequence
                    ack_status = $ackStatus
                    acked_at = $event[0].ack.acked_at
                    summary = $event[0].summary
                    recovery_attempted = $recoveryAttempted
                    recovery_cursor_reset_to = $recoveryResetCursorTo
                    recovery_worker_output = $recoveryOutput
                    recovery_error = $recoveryError
                })
        } catch {
            Add-Result -results $results -step "Verify ack applied" -ok $false -details $_.Exception.Message
        }
    } else {
        Add-Result -results $results -step "Verify ack applied" -ok $false -details "Skipped: thread_id unavailable."
    }
}

$passCount = @($results | Where-Object { $_.ok }).Count
$failCount = @($results | Where-Object { -not $_.ok }).Count
$report = [pscustomobject]@{
    utc = [DateTime]::UtcNow.ToString("o")
    api_base = $ApiBase
    public_base_url = $PublicBaseUrl
    thread_id = $threadId
    pass = $passCount
    fail = $failCount
    results = $results
    report_file = $reportPath
}

Write-MarkdownReport `
    -path $reportPath `
    -apiBase $ApiBase `
    -publicBaseUrl $(if ($SkipPublicChecks.IsPresent) { "" } else { $PublicBaseUrl }) `
    -threadId $threadId `
    -results $results

if ($Json.IsPresent) {
    $report | ConvertTo-Json -Depth 10
} else {
    Write-Host "Slack transport check:"
    Write-Host ("- pass: {0}" -f $passCount)
    Write-Host ("- fail: {0}" -f $failCount)
    foreach ($item in $results) {
        $status = if ($item.ok) { "PASS" } else { "FAIL" }
        Write-Host ("[{0}] {1}" -f $status, $item.step)
    }
    Write-Host ("Report: {0}" -f $reportPath)
}

if ($failCount -gt 0) {
    exit 2
}
exit 0
