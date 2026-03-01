<#
.SYNOPSIS
  Production Checklist — CLI bridge for the production readiness gate.
  Called via: .\pg.ps1 prod-checklist [-Json] [-Verbose]
.DESCRIPTION
  Calls POST /account/policy/production-checklist on the local server
  to evaluate production readiness across all policy domains.
#>
[CmdletBinding()]
param(
    [switch]$Json,
    [switch]$DomainsOnly,
    [string]$Framework = "",
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

# ── Domains-only mode ────────────────────────────────────────────────────

if ($DomainsOnly.IsPresent) {
    try {
        $resp = Invoke-RestMethod -Uri "$ApiBase/account/policy/production-checklist/domains" `
            -Method GET -Headers $headers -TimeoutSec 15
        if ($Json.IsPresent) {
            $resp | ConvertTo-Json -Depth 3
        } else {
            Write-Host ""
            Write-Host "  Available Policy Domains ($($resp.count)):" -ForegroundColor Cyan
            foreach ($d in $resp.domains) { Write-Host "    - $d" }
            Write-Host ""
        }
    } catch {
        Write-Error "Failed to list domains: $_"
        exit 1
    }
    exit 0
}

# ── Evaluate ─────────────────────────────────────────────────────────────

$body = @{ domains = @{} }
if ($Framework) { $body["framework"] = $Framework }
$bodyJson = $body | ConvertTo-Json -Depth 3

try {
    $resp = Invoke-RestMethod -Uri "$ApiBase/account/policy/production-checklist" `
        -Method POST -Headers $headers -Body $bodyJson -TimeoutSec 60
} catch {
    Write-Error "Production checklist evaluation failed: $_"
    exit 1
}

# ── Output ───────────────────────────────────────────────────────────────

if ($Json.IsPresent) {
    $resp | ConvertTo-Json -Depth 6
} else {
    $statusColor = if ($resp.status -eq "pass") { "Green" } else { "Red" }
    Write-Host ""
    Write-Host "  Production Readiness Checklist" -ForegroundColor Cyan
    Write-Host "  ──────────────────────────────────────────"
    Write-Host "  Status:           $($resp.status)" -ForegroundColor $statusColor
    Write-Host "  Domains eval'd:   $($resp.domains_evaluated)"
    Write-Host "  Domains passed:   $($resp.domains_passed)"
    Write-Host "  Total blockers:   $($resp.total_blockers)"
    Write-Host "  Total warnings:   $($resp.total_warnings)"
    Write-Host "  Duration:         $($resp.total_duration_ms)ms"
    Write-Host ""

    if ($resp.domains -and $resp.domains.Count -gt 0) {
        Write-Host "  Domain Results:" -ForegroundColor White
        foreach ($d in $resp.domains) {
            $icon = if ($d.status -eq "pass") { "[PASS]" } elseif ($d.status -eq "blocked") { "[FAIL]" } else { "[SKIP]" }
            $color = if ($d.status -eq "pass") { "Green" } elseif ($d.status -eq "blocked") { "Red" } else { "DarkGray" }
            Write-Host "    $icon $($d.domain) — $($d.message)" -ForegroundColor $color
            if ($d.blockers -and $d.blockers.Count -gt 0) {
                foreach ($b in $d.blockers) { Write-Host "      ! $b" -ForegroundColor Red }
            }
            if ($d.warnings -and $d.warnings.Count -gt 0) {
                foreach ($w in $d.warnings) { Write-Host "      ~ $w" -ForegroundColor Yellow }
            }
        }
        Write-Host ""
    }
}

if ($resp.status -ne "pass") { exit 1 }
