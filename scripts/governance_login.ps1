param(
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$Email = "",
    [string]$InstallId = "",
    [string]$OtpCode = "",
    [string]$AccessToken = "",
    [string]$StateFile = ""
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-DefaultStateFilePath {
    $root = Get-RepoRoot
    return Join-Path $root "Memory-bank\_generated\governance-agent-state.json"
}

function Read-State([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        return @{}
    }
    $raw = Get-Content -LiteralPath $path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return @{}
    }
    try {
        $parsed = ConvertFrom-Json -InputObject $raw -AsHashtable
        if ($null -eq $parsed) {
            return @{}
        }
        return $parsed
    } catch {
        Write-Warning "State file exists but is not valid JSON. A new state file will be written."
        return @{}
    }
}

function Write-State([string]$path, [hashtable]$state) {
    $directory = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -Path $directory -ItemType Directory -Force | Out-Null
    }
    $stateJson = $state | ConvertTo-Json -Depth 8
    Set-Content -LiteralPath $path -Value $stateJson -Encoding UTF8
}

function Invoke-JsonPost([string]$uri, [hashtable]$body, [hashtable]$headers = @{}) {
    $json = $body | ConvertTo-Json -Compress
    return Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Headers $headers -Body $json
}

$statePath = if ([string]::IsNullOrWhiteSpace($StateFile)) { Get-DefaultStateFilePath } else { $StateFile }
$state = Read-State -path $statePath

if ([string]::IsNullOrWhiteSpace($Email) -and $state.ContainsKey("email")) {
    $Email = [string]$state["email"]
}
if ([string]::IsNullOrWhiteSpace($InstallId) -and $state.ContainsKey("install_id")) {
    $InstallId = [string]$state["install_id"]
}
if ([string]::IsNullOrWhiteSpace($InstallId)) {
    $InstallId = "{0}-governance-agent" -f $env:COMPUTERNAME
}

if ([string]::IsNullOrWhiteSpace($Email)) {
    $Email = Read-Host "Enter account email"
}
if ([string]::IsNullOrWhiteSpace($Email)) {
    throw "Email is required."
}

$token = $AccessToken
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "Starting email auth for governance worker..."
    $startUri = "{0}/auth/email/start" -f $ApiBase.TrimEnd("/")
    $startResp = Invoke-JsonPost -uri $startUri -body @{ email = $Email }
    if ($startResp.PSObject.Properties.Name -contains "dev_code" -and -not [string]::IsNullOrWhiteSpace([string]$startResp.dev_code)) {
        $OtpCode = [string]$startResp.dev_code
        Write-Host "Using dev OTP code returned by server runtime."
    }
    if ([string]::IsNullOrWhiteSpace($OtpCode)) {
        $OtpCode = Read-Host "Enter OTP code from email"
    }
    if ([string]::IsNullOrWhiteSpace($OtpCode)) {
        throw "OTP code is required."
    }
    $verifyUri = "{0}/auth/email/verify" -f $ApiBase.TrimEnd("/")
    $verifyResp = Invoke-JsonPost -uri $verifyUri -body @{
        email = $Email
        code = $OtpCode
        install_id = $InstallId
    }
    $token = [string]$verifyResp.access_token
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "Server did not return an access token."
    }
}

$summaryUri = "{0}/account/summary" -f $ApiBase.TrimEnd("/")
$summary = Invoke-RestMethod -Method Get -Uri $summaryUri -Headers @{ Authorization = "Bearer $token" }

if (-not $state.ContainsKey("cursor")) {
    $state["cursor"] = 0
}
$state["api_base"] = $ApiBase.TrimEnd("/")
$state["email"] = $Email
$state["install_id"] = $InstallId
$state["access_token"] = $token
$state["last_login_at"] = [DateTime]::UtcNow.ToString("o")
$state["account_user_id"] = [string]$summary.account.user_id
$state["team_keys"] = @($summary.teams | ForEach-Object { $_.team_key })

Write-State -path $statePath -state $state

Write-Host "Governance worker login saved."
Write-Host ("- state_file: {0}" -f $statePath)
Write-Host ("- email: {0}" -f $Email)
Write-Host ("- install_id: {0}" -f $InstallId)
Write-Host ("- plan: {0}" -f [string]$summary.plan)
Write-Host ("- teams: {0}" -f ((@($state["team_keys"]) -join ", ")))
Write-Host ""
Write-Host "Next:"
Write-Host "  .\pg.ps1 governance-worker -Once"
Write-Host "  .\pg.ps1 governance-worker -PollSeconds 15"
