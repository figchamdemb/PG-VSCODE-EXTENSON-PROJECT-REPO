<#
.SYNOPSIS
  Tech Debt Counter ($) — CLI bridge for the tech debt cost model.
  Called via: .\pg.ps1 tech-debt [-Json] [-Verbose]
.DESCRIPTION
  Calls POST /account/policy/tech-debt/evaluate on the local server
  to estimate remediation cost for discovered findings.
  When run without findings input, queries the cost model metadata.
#>
[CmdletBinding()]
param(
    [switch]$Json,
    [switch]$ModelOnly,
    [string]$FindingsFile = "",
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = ""
)

$ErrorActionPreference = "Stop"

# ── Auth header ──────────────────────────────────────────────────────────

$headers = @{ "Content-Type" = "application/json" }
if ($AccessToken) {
    $headers["Authorization"] = "Bearer $AccessToken"
} else {
    $stateFile = Join-Path $PSScriptRoot ".." "Memory-bank" "_generated" "pg-cli-state.json"
    if (Test-Path $stateFile) {
        try {
            $st = Get-Content $stateFile -Raw | ConvertFrom-Json
            if ($st.access_token) { $headers["Authorization"] = "Bearer $($st.access_token)" }
        } catch { }
    }
}

# ── Model-only mode ─────────────────────────────────────────────────────

if ($ModelOnly.IsPresent) {
    try {
        $resp = Invoke-RestMethod -Uri "$ApiBase/account/policy/tech-debt/model" `
            -Method GET -Headers $headers -TimeoutSec 15
        if ($Json.IsPresent) {
            $resp | ConvertTo-Json -Depth 5
        } else {
            Write-Host ""
            Write-Host "  Tech Debt Cost Model" -ForegroundColor Cyan
            Write-Host "  ──────────────────────────────────────────"
            Write-Host "  Plan:             $($resp.plan)"
            Write-Host "  Base rate:        `$$($resp.base_hourly_rate)/hr"
            Write-Host "  Effective rate:   `$$($resp.effective_hourly_rate)/hr"
            Write-Host "  Currency:         $($resp.currency)"
            Write-Host "  Hours/critical:   $($resp.hours_by_severity.critical)"
            Write-Host "  Hours/warning:    $($resp.hours_by_severity.warning)"
            Write-Host "  Hours/info:       $($resp.hours_by_severity.info)"
            Write-Host ""
        }
    } catch {
        Write-Error "Failed to query tech debt model: $_"
        exit 1
    }
    exit 0
}

# ── Load findings ────────────────────────────────────────────────────────

$findings = @()
if ($FindingsFile -and (Test-Path $FindingsFile)) {
    $findings = (Get-Content $FindingsFile -Raw | ConvertFrom-Json).findings
} else {
    # Placeholder: in production, findings come from the last policy evaluation run
    Write-Host "  No findings file specified. Use -FindingsFile <path> or pipe findings." -ForegroundColor Yellow
    Write-Host "  Running with empty findings set for cost model preview." -ForegroundColor Yellow
}

$body = @{ findings = $findings } | ConvertTo-Json -Depth 5

# ── Evaluate ─────────────────────────────────────────────────────────────

try {
    $resp = Invoke-RestMethod -Uri "$ApiBase/account/policy/tech-debt/evaluate" `
        -Method POST -Headers $headers -Body $body -TimeoutSec 30
} catch {
    Write-Error "Tech debt evaluation failed: $_"
    exit 1
}

# ── Output ───────────────────────────────────────────────────────────────

if ($Json.IsPresent) {
    $resp | ConvertTo-Json -Depth 6
} else {
    Write-Host ""
    Write-Host "  Tech Debt Report" -ForegroundColor Cyan
    Write-Host "  ──────────────────────────────────────────"
    Write-Host "  Status:           $($resp.status)" -ForegroundColor $(
        if ($resp.status -eq "healthy") { "Green" }
        elseif ($resp.status -eq "attention") { "Yellow" }
        else { "Red" }
    )
    Write-Host "  Total findings:   $($resp.total_findings)"
    Write-Host "  Est. hours:       $($resp.total_estimated_hours)"
    Write-Host "  Est. cost:        `$$($resp.total_estimated_cost) $($resp.currency)"
    Write-Host "  Hourly rate:      `$$($resp.hourly_rate)/hr"
    Write-Host ""

    if ($resp.domains -and $resp.domains.Count -gt 0) {
        Write-Host "  Domain Breakdown:" -ForegroundColor White
        foreach ($d in $resp.domains) {
            $color = if ($d.critical_count -gt 0) { "Red" } elseif ($d.warning_count -gt 0) { "Yellow" } else { "Green" }
            Write-Host "    $($d.domain): $($d.finding_count) findings, `$$($d.estimated_cost)" -ForegroundColor $color
        }
        Write-Host ""
    }
}
