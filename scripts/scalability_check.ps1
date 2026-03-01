param(
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string]$StateFile = "",
    [string]$Content = "",
    [string]$ContentFile = "",
    [string[]]$FilePaths = @(),
    [string]$DiscoveryConcurrency = "",
    [string]$DiscoveryDirection = "",
    [string]$DiscoveryLatency = "",
    [string]$DiscoveryAsyncNeed = "",
    [string]$DiscoveryFramework = "",
    [string]$DiscoveryExistingInfra = "",
    [switch]$QuestionsOnly,
    [switch]$Json
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
    if (-not (Test-Path -LiteralPath $path)) { return "" }
    $raw = Get-Content -LiteralPath $path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) { return "" }
    try {
        $json = ConvertFrom-Json -InputObject $raw
        if ($null -eq $json) { return "" }
        return [string]$json.access_token
    } catch { return "" }
}

function Resolve-AccessToken([string]$provided, [string]$statePath) {
    if (-not [string]::IsNullOrWhiteSpace($provided)) { return $provided }
    if (-not [string]::IsNullOrWhiteSpace($env:PG_ACCESS_TOKEN)) { return [string]$env:PG_ACCESS_TOKEN }
    return Read-AccessTokenFromState -path $statePath
}

function Assert-ServerReachable([string]$base) {
    $uri = "{0}/health" -f $base.TrimEnd("/")
    try {
        $health = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 10
        if (-not $health.ok) { throw "Health endpoint did not return ok=true." }
    } catch {
        throw "Cannot reach API health endpoint at $uri. Start backend server and retry."
    }
}

# --- Resolve state file ---
if ([string]::IsNullOrWhiteSpace($StateFile)) {
    $StateFile = Get-DefaultStateFilePath
}
$resolvedToken = Resolve-AccessToken -provided $AccessToken -statePath $StateFile
if ([string]::IsNullOrWhiteSpace($resolvedToken)) {
    Write-Host "[WARN] No access token available. Run 'pg login' first." -ForegroundColor Yellow
    exit 1
}

# --- Questions-only mode ---
if ($QuestionsOnly) {
    $resolvedBase = $ApiBase.TrimEnd("/")
    Assert-ServerReachable -base $resolvedBase
    $uri = "$resolvedBase/account/policy/scalability/questions"
    $headers = @{ Authorization = "Bearer $resolvedToken" }
    try {
        $response = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 15
        if ($Json) {
            $response | ConvertTo-Json -Depth 10
        } else {
            Write-Host "`n=== Scalability Discovery Questions ===" -ForegroundColor Cyan
            foreach ($q in $response.questions) {
                Write-Host ("  [{0}] {1}" -f $q.id, $q.question) -ForegroundColor White
                Write-Host ("       Categories: {0}" -f ($q.categories -join ", ")) -ForegroundColor DarkGray
            }
            Write-Host ""
        }
    } catch {
        Write-Host "[ERROR] Failed to fetch discovery questions: $_" -ForegroundColor Red
        exit 1
    }
    exit 0
}

# --- Build content ---
$evaluationContent = $Content
if ([string]::IsNullOrWhiteSpace($evaluationContent) -and -not [string]::IsNullOrWhiteSpace($ContentFile)) {
    if (Test-Path -LiteralPath $ContentFile) {
        $evaluationContent = Get-Content -LiteralPath $ContentFile -Raw
    } else {
        Write-Host "[WARN] Content file not found: $ContentFile" -ForegroundColor Yellow
    }
}

if ([string]::IsNullOrWhiteSpace($evaluationContent) -and $FilePaths.Count -eq 0) {
    Write-Host "[WARN] No content or file paths provided. Pass -Content, -ContentFile, or -FilePaths." -ForegroundColor Yellow
    exit 1
}

# --- Build discovery answers ---
$discoveryAnswers = @{}
if (-not [string]::IsNullOrWhiteSpace($DiscoveryConcurrency)) { $discoveryAnswers["concurrency"] = $DiscoveryConcurrency }
if (-not [string]::IsNullOrWhiteSpace($DiscoveryDirection)) { $discoveryAnswers["direction"] = $DiscoveryDirection }
if (-not [string]::IsNullOrWhiteSpace($DiscoveryLatency)) { $discoveryAnswers["latency"] = $DiscoveryLatency }
if (-not [string]::IsNullOrWhiteSpace($DiscoveryAsyncNeed)) { $discoveryAnswers["async_need"] = $DiscoveryAsyncNeed }
if (-not [string]::IsNullOrWhiteSpace($DiscoveryFramework)) { $discoveryAnswers["framework"] = $DiscoveryFramework }
if (-not [string]::IsNullOrWhiteSpace($DiscoveryExistingInfra)) { $discoveryAnswers["existing_infra"] = $DiscoveryExistingInfra }

# --- POST evaluation ---
$resolvedBase = $ApiBase.TrimEnd("/")
Assert-ServerReachable -base $resolvedBase

$uri = "$resolvedBase/account/policy/scalability/evaluate"
$headers = @{
    Authorization = "Bearer $resolvedToken"
    "Content-Type" = "application/json"
}

$payload = @{
    source = "cli"
}
if (-not [string]::IsNullOrWhiteSpace($evaluationContent)) {
    $payload["content"] = $evaluationContent
}
if ($FilePaths.Count -gt 0) {
    $payload["file_paths"] = $FilePaths
}
if ($discoveryAnswers.Count -gt 0) {
    $payload["discovery_answers"] = $discoveryAnswers
}

$body = $payload | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod `
        -Method Post `
        -Uri $uri `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 30
} catch {
    Write-Host "[ERROR] Scalability evaluation failed: $_" -ForegroundColor Red
    exit 1
}

# --- Output ---
if ($Json) {
    $response | ConvertTo-Json -Depth 10
    exit 0
}

$status = $response.status
$risk = $response.risk_score
$discoveryOk = $response.discovery_complete
$findingsCount = $response.summary.findings_count
$categories = $response.summary.categories_affected -join ", "
$answered = $response.summary.discovery_answered
$required = $response.summary.discovery_required

Write-Host "`n=== PG Scalability Discovery Check ===" -ForegroundColor Cyan
$statusColor = switch ($status) { "pass" { "Green" } "warn" { "Yellow" } "blocked" { "Red" } default { "White" } }
Write-Host ("  Status:             {0}" -f $status.ToUpper()) -ForegroundColor $statusColor
Write-Host ("  Risk Score:         {0}" -f $risk)
Write-Host ("  Discovery Complete: {0}" -f $discoveryOk)
Write-Host ("  Discovery:          {0}/{1} answered" -f $answered, $required)
Write-Host ("  Findings:           {0}" -f $findingsCount)
if ($categories) {
    Write-Host ("  Categories:         {0}" -f $categories) -ForegroundColor DarkCyan
}

if ($response.missing_discovery -and $response.missing_discovery.Count -gt 0) {
    Write-Host "`n  Missing Discovery Questions:" -ForegroundColor Yellow
    foreach ($id in $response.missing_discovery) {
        Write-Host ("    - {0}" -f $id) -ForegroundColor Yellow
    }
}

if ($response.findings -and $response.findings.Count -gt 0) {
    Write-Host "`n  Findings:" -ForegroundColor White
    foreach ($f in $response.findings) {
        $sevColor = if ($f.severity -eq "blocker") { "Red" } else { "Yellow" }
        Write-Host ("    [{0}] {1} ({2}, score={3})" -f $f.rule_id, $f.message, $f.severity.ToUpper(), $f.score) -ForegroundColor $sevColor
        Write-Host ("           Hint: {0}" -f $f.hint) -ForegroundColor DarkGray
    }
}

Write-Host ""

if ($status -eq "blocked") { exit 1 }
if ($status -eq "warn") { exit 0 }
exit 0
