<#
.SYNOPSIS
  Manage enterprise reviewer automation policies via PG server API.

.DESCRIPTION
  CLI bridge for M10A reviewer automation endpoints.
  Actions: get, set, delete, assign, sla, escalate, approval, status.

.EXAMPLE
  .\reviewer_automation.ps1 -Action get
  .\reviewer_automation.ps1 -Action set -ReviewerEmails "a@co.com,b@co.com" -RequiredApprovals 2 -SlaHours 48
  .\reviewer_automation.ps1 -Action assign -ThreadId abc-123
  .\reviewer_automation.ps1 -Action sla -Json
#>
param(
    [ValidateSet("get", "set", "delete", "assign", "sla", "escalate", "approval", "status")]
    [string]$Action = "status",
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$StateFile,
    [string]$TeamKey,
    [string]$AccessToken,
    [string]$ThreadId,
    [string]$ReviewerEmails,
    [int]$RequiredApprovals = 0,
    [int]$SlaHours = 0,
    [string]$EscalationEmail,
    [ValidateSet("round_robin", "all", "")]
    [string]$AssignmentMode = "",
    [switch]$Enable,
    [switch]$Disable,
    [switch]$Json
)

$ErrorActionPreference = "Stop"

# ── Resolve access token ──────────────────────────────────────────────────

if (-not $AccessToken) {
    $resolvedStateFile = if ($StateFile) { $StateFile } else {
        Join-Path $PSScriptRoot ".." "Memory-bank" "_generated" "pg-cli-state.json"
    }
    if (Test-Path $resolvedStateFile) {
        $state = Get-Content $resolvedStateFile -Raw | ConvertFrom-Json
        if ($state.access_token) { $AccessToken = $state.access_token }
    }
}
if (-not $AccessToken) {
    Write-Host "[reviewer-policy] ERROR: No access token. Run '.\pg.ps1 governance-login' first." -ForegroundColor Red
    exit 1
}

$headers = @{ Authorization = "Bearer $AccessToken" }
$base = "$ApiBase/account/governance"

function Invoke-Api {
    param([string]$Method, [string]$Url, [object]$Body)
    try {
        $params = @{
            Uri = $Url; Headers = $headers; Method = $Method
            ContentType = "application/json"; ErrorAction = "Stop"
        }
        if ($Body) { $params["Body"] = ($Body | ConvertTo-Json -Depth 5 -Compress) }
        Invoke-RestMethod @params
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $detail = try { $_.ErrorDetails.Message } catch { "" }
        Write-Host "[reviewer-policy] ERROR: HTTP $status – $detail" -ForegroundColor Red
        exit 1
    }
}

function Write-PolicySummary($r) {
    if ($r.policy) {
        $p = $r.policy
        Write-Host ""
        Write-Host "  Reviewer Automation Policy" -ForegroundColor Cyan
        Write-Host "  ─────────────────────────────"
        Write-Host "  Scope:       $($p.scope_type):$($p.scope_id)"
        Write-Host "  Enabled:     $($p.enabled)"
        Write-Host "  Reviewers:   $($p.reviewer_emails -join ', ')"
        Write-Host "  Approvals:   $($p.required_approvals)"
        Write-Host "  SLA hours:   $($p.sla_hours)"
        Write-Host "  Assignment:  $($p.assignment_mode)"
        Write-Host "  Escalation:  $(if ($p.escalation_email) { $p.escalation_email } else { '(none)' })"
        Write-Host ""
    } elseif ($r.message) {
        Write-Host "  $($r.message)" -ForegroundColor Yellow
    }
}

# ── Query string helper ───────────────────────────────────────────────────

$qs = if ($TeamKey) { "?team_key=$TeamKey" } else { "" }

# ── Dispatch ──────────────────────────────────────────────────────────────

switch ($Action) {
    "get" {
        $r = Invoke-Api -Method GET -Url "$base/reviewer-policy$qs"
        if ($Json) { $r | ConvertTo-Json -Depth 10; exit 0 }
        Write-PolicySummary $r
    }
    "set" {
        $body = @{}
        if ($Enable)  { $body["enabled"] = $true }
        if ($Disable) { $body["enabled"] = $false }
        if ($ReviewerEmails) {
            $body["reviewer_emails"] = @($ReviewerEmails -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        }
        if ($RequiredApprovals -gt 0) { $body["required_approvals"] = $RequiredApprovals }
        if ($SlaHours -gt 0)          { $body["sla_hours"] = $SlaHours }
        if ($AssignmentMode)           { $body["assignment_mode"] = $AssignmentMode }
        if ($PSBoundParameters.ContainsKey("EscalationEmail")) {
            $body["escalation_email"] = if ($EscalationEmail) { $EscalationEmail } else { $null }
        }
        if ($TeamKey) { $body["team_key"] = $TeamKey }

        $r = Invoke-Api -Method PUT -Url "$base/reviewer-policy" -Body $body
        if ($Json) { $r | ConvertTo-Json -Depth 10; exit 0 }
        Write-Host "  Policy updated." -ForegroundColor Green
        Write-PolicySummary $r
    }
    "delete" {
        $r = Invoke-Api -Method DELETE -Url "$base/reviewer-policy$qs"
        if ($Json) { $r | ConvertTo-Json -Depth 10; exit 0 }
        Write-Host "  Policy deleted." -ForegroundColor Green
    }
    "assign" {
        if (-not $ThreadId) {
            Write-Host "[reviewer-policy] ERROR: -ThreadId is required for assign." -ForegroundColor Red
            exit 1
        }
        $body = @{}
        if ($TeamKey) { $body["team_key"] = $TeamKey }
        $r = Invoke-Api -Method POST -Url "$base/reviewer-assign/$ThreadId" -Body $body
        if ($Json) { $r | ConvertTo-Json -Depth 10; exit 0 }
        $a = $r.assignment
        Write-Host "  Assigned: $($a.assigned_emails -join ', ') ($($a.assignment_mode))" -ForegroundColor Green
    }
    "sla" {
        $r = Invoke-Api -Method GET -Url "$base/reviewer-sla$qs"
        if ($Json) { $r | ConvertTo-Json -Depth 10; exit 0 }
        if ($r.threads -and $r.threads.Count -gt 0) {
            Write-Host ""
            Write-Host "  SLA Status" -ForegroundColor Cyan
            Write-Host "  ──────────"
            foreach ($t in $r.threads) {
                $icon = if ($t.breached) { "!!" } else { "OK" }
                $color = if ($t.breached) { "Red" } else { "Green" }
                Write-Host "  [$icon] $($t.title) — age: $($t.age_hours)h / limit: $($t.sla_hours)h" -ForegroundColor $color
            }
            Write-Host ""
        } else {
            Write-Host "  No open threads or no active policy." -ForegroundColor Yellow
        }
    }
    "escalate" {
        $body = @{}
        if ($TeamKey) { $body["team_key"] = $TeamKey }
        $r = Invoke-Api -Method POST -Url "$base/reviewer-escalate" -Body $body
        if ($Json) { $r | ConvertTo-Json -Depth 10; exit 0 }
        Write-Host "  Escalation check complete: $($r.escalation_count) thread(s) escalated." -ForegroundColor $(if ($r.escalation_count -gt 0) { "Red" } else { "Green" })
    }
    "approval" {
        if (-not $ThreadId) {
            Write-Host "[reviewer-policy] ERROR: -ThreadId is required for approval." -ForegroundColor Red
            exit 1
        }
        $r = Invoke-Api -Method GET -Url "$base/reviewer-approval/$ThreadId$qs"
        if ($Json) { $r | ConvertTo-Json -Depth 10; exit 0 }
        $g = $r.gate
        $icon = if ($g.met) { "PASS" } else { "PENDING" }
        $color = if ($g.met) { "Green" } else { "Yellow" }
        Write-Host "  Approval gate: [$icon] $($g.current)/$($g.required) votes" -ForegroundColor $color
    }
    "status" {
        $r = Invoke-Api -Method GET -Url "$base/reviewer-status$qs"
        if ($Json) { $r | ConvertTo-Json -Depth 10; exit 0 }
        if ($r.status) {
            $s = $r.status
            Write-Host ""
            Write-Host "  Reviewer Automation Status" -ForegroundColor Cyan
            Write-Host "  ──────────────────────────"
            Write-Host "  Scope:          $($s.scope_type):$($s.scope_id)"
            Write-Host "  Enabled:        $($s.enabled)"
            Write-Host "  Reviewers:      $($s.reviewer_count)"
            Write-Host "  Approvals req:  $($s.required_approvals)"
            Write-Host "  SLA hours:      $($s.sla_hours)"
            Write-Host "  Assignment:     $($s.assignment_mode)"
            Write-Host "  Open threads:   $($s.open_threads)"
            Write-Host "  SLA breached:   $($s.breached_threads)" -ForegroundColor $(if ($s.breached_threads -gt 0) { "Red" } else { "Green" })
            Write-Host ""
        } else {
            Write-Host "  $($r.message)" -ForegroundColor Yellow
        }
    }
}

exit 0
