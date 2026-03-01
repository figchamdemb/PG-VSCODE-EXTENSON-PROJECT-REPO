<#
.SYNOPSIS
  Fetch governance reviewer digest and activity KPIs from the PG server.

.DESCRIPTION
  Calls GET /account/governance/digest (or admin endpoint when -Admin is set)
  and prints a human-readable summary of governance KPIs.
  Requires a running PG server and a valid access token.

.EXAMPLE
  .\governance_digest.ps1 -ApiBase http://127.0.0.1:8787 -TeamKey my-team
  .\governance_digest.ps1 -ApiBase http://127.0.0.1:8787 -Json
#>
param(
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$StateFile,
    [string]$TeamKey,
    [string]$AccessToken,
    [switch]$Json,
    [switch]$Admin,
    [switch]$Activity
)

$ErrorActionPreference = "Stop"

# ── Resolve access token ──────────────────────────────────────────────────

if (-not $AccessToken) {
    $resolvedStateFile = if ($StateFile) { $StateFile } else {
        Join-Path $PSScriptRoot ".." "Memory-bank" "_generated" "pg-cli-state.json"
    }
    if (Test-Path $resolvedStateFile) {
        $state = Get-Content $resolvedStateFile -Raw | ConvertFrom-Json
        if ($state.access_token) {
            $AccessToken = $state.access_token
        }
    }
}

if (-not $AccessToken) {
    Write-Host "[governance-digest] ERROR: No access token found. Run '.\pg.ps1 governance-login' first." -ForegroundColor Red
    exit 1
}

# ── Build request ──────────────────────────────────────────────────────────

$headers = @{ Authorization = "Bearer $AccessToken" }

if ($Admin) {
    $endpoint = if ($Activity) { "admin/board/governance/activity" } else { "admin/board/governance/digest" }
} else {
    $endpoint = if ($Activity) { "account/governance/digest/activity" } else { "account/governance/digest" }
}

$url = "$ApiBase/$endpoint"
if ($TeamKey) {
    $url += "?team_key=$TeamKey"
}

# ── Fetch ──────────────────────────────────────────────────────────────────

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ContentType "application/json" -ErrorAction Stop
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    $body = ""
    try { $body = $_.ErrorDetails.Message } catch {}
    Write-Host "[governance-digest] ERROR: HTTP $status – $body" -ForegroundColor Red
    exit 1
}

# ── Output ──────────────────────────────────────────────────────────────────

if ($Json) {
    $response | ConvertTo-Json -Depth 10
    exit 0
}

# Human-readable summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Governance Digest" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($Activity -and $response.summary) {
    $s = $response.summary
    Write-Host "  Period:              $($response.period.from) → $($response.period.to)"
    Write-Host "  Threads created:     $($s.threads_created)"
    Write-Host "  Threads decided:     $($s.threads_decided)"
    Write-Host "  Votes cast:          $($s.votes_cast)"
    Write-Host "  Entries submitted:   $($s.entries_submitted)"
    Write-Host "  EOD reports:         $($s.eod_reports_submitted)"
    Write-Host "  Unique active users: $($s.unique_active_users)"
    Write-Host "  Avg approval (ms):   $($s.avg_approval_latency_ms)"
    Write-Host ""
    if ($s.top_contributors -and $s.top_contributors.Count -gt 0) {
        Write-Host "  Top Contributors:" -ForegroundColor Yellow
        foreach ($c in $s.top_contributors) {
            Write-Host "    $($c.user_id): $($c.score) (votes=$($c.votes), entries=$($c.entries), eod=$($c.eod_reports))"
        }
    }
    if ($s.blocked_threads -and $s.blocked_threads.Count -gt 0) {
        Write-Host ""
        Write-Host "  Blocked Threads:" -ForegroundColor Red
        foreach ($t in $s.blocked_threads) {
            Write-Host "    $($t.id): $($t.title)"
        }
    }
} elseif ($response.kpis) {
    $k = $response.kpis
    Write-Host "  Period:               $($response.period.from) → $($response.period.to)"
    Write-Host "  Scope:                $($response.scope_type):$($response.scope_id)"
    Write-Host ""
    Write-Host "  Threads (total):      $($k.total_threads)"
    Write-Host "    Open:               $($k.open_threads)" -ForegroundColor Yellow
    Write-Host "    Decided:            $($k.decided_threads)" -ForegroundColor Green
    Write-Host "    Closed:             $($k.closed_threads)"
    Write-Host "    Blocked:            $($k.blocked_threads)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Avg approval (ms):    $($k.avg_approval_latency_ms)"
    Write-Host "  Median approval (ms): $($k.median_approval_latency_ms)"
    Write-Host "  Total votes:          $($k.total_votes)"
    Write-Host "  Total entries:        $($k.total_entries)"
    Write-Host "  Unique participants:  $($k.unique_participants)"
    Write-Host "  Pending acks:         $($k.pending_acks)" -ForegroundColor $(if ($k.pending_acks -gt 0) { "Yellow" } else { "White" })
    Write-Host ""
    if ($k.decisions_by_type) {
        Write-Host "  Decisions by type:" -ForegroundColor Yellow
        $k.decisions_by_type.PSObject.Properties | ForEach-Object {
            Write-Host "    $($_.Name): $($_.Value)"
        }
    }
    if ($response.threads -and $response.threads.Count -gt 0) {
        Write-Host ""
        Write-Host "  Thread KPIs:" -ForegroundColor Yellow
        foreach ($t in $response.threads) {
            $statusColor = switch ($t.status) {
                "open"    { "Yellow" }
                "decided" { "Green" }
                default   { "White" }
            }
            Write-Host "    [$($t.status)] $($t.title) (votes=$($t.vote_count), entries=$($t.entry_count))" -ForegroundColor $statusColor
        }
    }
} else {
    Write-Host "  (No digest data returned)" -ForegroundColor DarkGray
    $response | ConvertTo-Json -Depth 5
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
exit 0
