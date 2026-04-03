param(
    [ValidateSet("verify", "seal", "status")]
    [string]$Action = "verify",
    [string]$RepoRoot = "",
    [switch]$Repair,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}

$agentsPath = Join-Path $RepoRoot "AGENTS.md"
$stateDir = Join-Path $RepoRoot "Memory-bank\_generated"
$statePath = Join-Path $stateDir "agents-integrity.json"

function Get-AgentsHash([string]$path) {
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Write-AgentsState([string]$hash, [bool]$isReadOnly) {
    if (-not (Test-Path -LiteralPath $stateDir)) {
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    }

    $payload = @{
        file = "AGENTS.md"
        sha256 = $hash
        read_only = $isReadOnly
        sealed_at_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    } | ConvertTo-Json -Depth 3

    [System.IO.File]::WriteAllText(
        $statePath,
        $payload,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Set-AgentsReadOnly([string]$path) {
    $item = Get-Item -LiteralPath $path
    if (-not $item.IsReadOnly) {
        $item.IsReadOnly = $true
    }
    return (Get-Item -LiteralPath $path).IsReadOnly
}

function Read-AgentsState() {
    if (-not (Test-Path -LiteralPath $statePath)) {
        return $null
    }
    return Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
}

function Write-Result([string]$status, [string]$message) {
    $result = [pscustomobject]@{
        ok = $true
        status = $status
        message = $message
        state_file = $statePath
    }
    if (-not $Quiet.IsPresent) {
        $result
    }
}

if (-not (Test-Path -LiteralPath $agentsPath)) {
    throw "AGENTS.md was not found at $agentsPath"
}

$hash = Get-AgentsHash -path $agentsPath
$item = Get-Item -LiteralPath $agentsPath
$state = Read-AgentsState

switch ($Action) {
    "seal" {
        $isReadOnly = Set-AgentsReadOnly -path $agentsPath
        Write-AgentsState -hash $hash -isReadOnly $isReadOnly
        Write-Result -status "sealed" -message "AGENTS.md hash recorded and file marked read-only."
        break
    }
    "status" {
        $stateOk = $null -ne $state -and $state.sha256 -eq $hash
        $status = if ($stateOk -and $item.IsReadOnly) { "protected" } elseif ($stateOk) { "writable" } else { "unsealed" }
        Write-Result -status $status -message "Reported current AGENTS.md protection state."
        break
    }
    "verify" {
        if ($null -eq $state) {
            if ($Repair.IsPresent) {
                $isReadOnly = Set-AgentsReadOnly -path $agentsPath
                Write-AgentsState -hash $hash -isReadOnly $isReadOnly
                Write-Result -status "initialized" -message "AGENTS.md protection state was missing and has been sealed."
                break
            }
            throw "AGENTS.md protection state is missing. Run scripts/agents_integrity.ps1 -Action seal."
        }

        if ([string]$state.sha256 -ne $hash) {
            throw "AGENTS.md integrity check failed. File contents differ from Memory-bank/_generated/agents-integrity.json."
        }

        if (-not $item.IsReadOnly) {
            if ($Repair.IsPresent) {
                $isReadOnly = Set-AgentsReadOnly -path $agentsPath
                Write-AgentsState -hash $hash -isReadOnly $isReadOnly
                Write-Result -status "repaired" -message "AGENTS.md read-only protection was restored."
                break
            }
            throw "AGENTS.md is writable. Restore protection with scripts/agents_integrity.ps1 -Action seal."
        }

        Write-Result -status "verified" -message "AGENTS.md integrity and read-only protection are valid."
        break
    }
}