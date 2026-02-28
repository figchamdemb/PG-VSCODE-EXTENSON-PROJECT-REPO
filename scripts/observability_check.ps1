param(
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string]$StateFile = "",
    [ValidateSet("auto", "pg-hosted", "customer-hosted", "hybrid")]
    [string]$DeploymentProfile = "auto",
    [ValidateSet("auto", "on", "off")]
    [string]$OtlpEnabled = "auto",
    [string]$OtlpEndpoint = "",
    [ValidateSet("auto", "pg", "customer", "unknown")]
    [string]$OtlpHostedBy = "auto",
    [ValidateSet("auto", "present", "missing")]
    [string]$OtlpToken = "auto",
    [ValidateSet("auto", "on", "off")]
    [string]$SentryEnabled = "auto",
    [string]$SentryEndpoint = "",
    [ValidateSet("auto", "pg", "customer", "unknown")]
    [string]$SentryHostedBy = "auto",
    [ValidateSet("auto", "present", "missing")]
    [string]$SentryToken = "auto",
    [ValidateSet("auto", "on", "off")]
    [string]$SignozEnabled = "auto",
    [string]$SignozEndpoint = "",
    [ValidateSet("auto", "pg", "customer", "unknown")]
    [string]$SignozHostedBy = "auto",
    [ValidateSet("auto", "present", "missing")]
    [string]$SignozToken = "auto",
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
    }
    catch {
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
    }
    catch {
        throw "Cannot reach API health endpoint at $uri. Start backend server and retry."
    }
}

function Convert-Enabled([string]$value) {
    switch ($value) {
        "on" { return $true }
        "off" { return $false }
        default { return $null }
    }
}

function Convert-HostedBy([string]$value) {
    if ($value -eq "auto") { return $null }
    return $value
}

function Convert-TokenState([string]$value) {
    switch ($value) {
        "present" { return $true }
        "missing" { return $false }
        default { return $null }
    }
}

function New-AdapterEvidence {
    param(
        [string]$Adapter,
        [string]$Enabled,
        [string]$Endpoint,
        [string]$HostedBy,
        [string]$TokenState
    )

    $enabledValue = Convert-Enabled -value $Enabled
    $endpointValue = if ([string]::IsNullOrWhiteSpace($Endpoint)) { $null } else { $Endpoint.Trim() }
    $hostedByValue = Convert-HostedBy -value $HostedBy
    $tokenValue = Convert-TokenState -value $TokenState

    $hasExplicitValue = ($enabledValue -ne $null) -or ($endpointValue -ne $null) -or ($hostedByValue -ne $null) -or ($tokenValue -ne $null)
    if (-not $hasExplicitValue) {
        return $null
    }

    return @{
        adapter = $Adapter
        enabled = $enabledValue
        endpoint_url = $endpointValue
        ingest_token_present = $tokenValue
        hosted_by = $hostedByValue
    }
}

$resolvedStateFile = if ($StateFile) { $StateFile } else { Get-DefaultStateFilePath }
$resolvedAccessToken = Resolve-AccessToken -provided $AccessToken -statePath $resolvedStateFile
if ([string]::IsNullOrWhiteSpace($resolvedAccessToken)) {
    throw "Missing AccessToken. Pass -AccessToken, set PG_ACCESS_TOKEN, or run governance login first."
}

Assert-ServerReachable -base $ApiBase

$adapters = New-Object System.Collections.Generic.List[object]
$otlp = New-AdapterEvidence -Adapter "otlp" -Enabled $OtlpEnabled -Endpoint $OtlpEndpoint -HostedBy $OtlpHostedBy -TokenState $OtlpToken
if ($otlp) { $adapters.Add($otlp) }
$sentry = New-AdapterEvidence -Adapter "sentry" -Enabled $SentryEnabled -Endpoint $SentryEndpoint -HostedBy $SentryHostedBy -TokenState $SentryToken
if ($sentry) { $adapters.Add($sentry) }
$signoz = New-AdapterEvidence -Adapter "signoz" -Enabled $SignozEnabled -Endpoint $SignozEndpoint -HostedBy $SignozHostedBy -TokenState $SignozToken
if ($signoz) { $adapters.Add($signoz) }

$body = @{
    runtime = @{
        source = "pg-cli"
        session_id = [guid]::NewGuid().ToString()
    }
    deployment_profile = $(if ($DeploymentProfile -eq "auto") { $null } else { $DeploymentProfile })
    adapters = $adapters
}

$headers = @{
    Authorization = "Bearer $resolvedAccessToken"
    "Content-Type" = "application/json"
}

$response = Invoke-RestMethod `
    -Method Post `
    -Uri "$ApiBase/account/policy/observability/check" `
    -Headers $headers `
    -Body ($body | ConvertTo-Json -Depth 20)

if ($Json.IsPresent) {
    $response | ConvertTo-Json -Depth 20
}
else {
    Write-Host "Observability health status: $($response.status)"
    Write-Host ("Profile: {0}" -f $response.summary.deployment_profile)
    Write-Host (
        "Adapters checked: {0} | enabled: {1} | ready: {2}" -f `
            $response.summary.adapters_checked, `
            $response.summary.enabled_adapters, `
            $response.summary.ready_adapters
    )
    Write-Host ("Blockers: {0} | warnings: {1}" -f $response.summary.blockers, $response.summary.warnings)

    if ($response.adapters -and $response.adapters.Count -gt 0) {
        Write-Host ""
        Write-Host "Adapter status:"
        foreach ($adapter in $response.adapters) {
            $endpointLabel = if ($adapter.endpoint_url) { $adapter.endpoint_url } else { "-" }
            $tokenLabel = if ($null -eq $adapter.ingest_token_present) { "unknown" } elseif ($adapter.ingest_token_present) { "present" } else { "missing" }
            Write-Host (
                "- {0}: enabled={1}, readiness={2}, hosted_by={3}, token={4}, endpoint={5}" -f `
                    $adapter.adapter, `
                    $adapter.enabled, `
                    $adapter.readiness, `
                    $adapter.hosted_by, `
                    $tokenLabel, `
                    $endpointLabel
            )
        }
    }

    if ($response.findings -and $response.findings.Count -gt 0) {
        Write-Host ""
        Write-Host "Findings:"
        foreach ($finding in $response.findings) {
            Write-Host "- [$($finding.rule_id)] [$($finding.severity)] $($finding.adapter) -> $($finding.message)"
            Write-Host "  hint: $($finding.hint)"
        }
    }
}

if ($response.status -eq "blocked") {
    exit 2
}
exit 0
