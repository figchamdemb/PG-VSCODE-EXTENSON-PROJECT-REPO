param(
    [string]$ThreadId = "",
    [string]$ActionKey = "",
    [string]$StateFile = "",
    [string]$PlaybookPath = "",
    [switch]$Persistent,
    [switch]$Remove,
    [switch]$List
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-DefaultStateFilePath {
    $root = Get-RepoRoot
    return Join-Path $root "Memory-bank\_generated\governance-agent-state.json"
}

function Get-DefaultPlaybookPath {
    return Join-Path $PSScriptRoot "governance_action_playbook.json"
}

function Ensure-Text([object]$value, [string]$fallback = "") {
    if ($null -eq $value) {
        return $fallback
    }
    return [string]$value
}

function Resolve-AbsolutePath([string]$rawPath) {
    if ([string]::IsNullOrWhiteSpace($rawPath)) {
        return ""
    }
    if ([System.IO.Path]::IsPathRooted($rawPath)) {
        return $rawPath
    }
    $repoRoot = Get-RepoRoot
    return Join-Path $repoRoot $rawPath
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
        $parsed = ConvertFrom-Json -InputObject $raw
        if ($null -eq $parsed) {
            return @{}
        }
        $map = @{}
        foreach ($property in $parsed.PSObject.Properties) {
            $map[$property.Name] = $property.Value
        }
        return $map
    } catch {
        throw "State file is not valid JSON: $path"
    }
}

function Write-State([string]$path, [hashtable]$state) {
    $directory = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -Path $directory -ItemType Directory -Force | Out-Null
    }
    $json = $state | ConvertTo-Json -Depth 10
    Set-Content -LiteralPath $path -Value $json -Encoding UTF8
}

function Resolve-PlaybookPathFromState([hashtable]$state, [string]$override) {
    if (-not [string]::IsNullOrWhiteSpace($override)) {
        return Resolve-AbsolutePath $override
    }
    if ($state.ContainsKey("playbook_path")) {
        $candidate = Resolve-AbsolutePath (Ensure-Text $state["playbook_path"])
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            return $candidate
        }
    }
    $defaultPath = Get-DefaultPlaybookPath
    if (Test-Path -LiteralPath $defaultPath) {
        return $defaultPath
    }
    return ""
}

function Read-Playbook([string]$path) {
    if ([string]::IsNullOrWhiteSpace($path)) {
        return @{ path = ""; keys = @() }
    }
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Playbook was not found: $path"
    }
    $raw = Get-Content -LiteralPath $path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw "Playbook is empty: $path"
    }
    $parsed = ConvertFrom-Json -InputObject $raw
    if ($null -eq $parsed) {
        throw "Playbook is invalid JSON: $path"
    }
    $keys = @()
    foreach ($action in @($parsed.actions)) {
        $key = (Ensure-Text $action.key).Trim().ToLowerInvariant()
        if (-not [string]::IsNullOrWhiteSpace($key)) {
            $keys += $key
        }
    }
    return @{ path = $path; keys = $keys }
}

function Ensure-BindingCollection([hashtable]$state) {
    if (-not $state.ContainsKey("thread_action_bindings") -or $null -eq $state["thread_action_bindings"]) {
        $state["thread_action_bindings"] = @()
        return
    }
    $state["thread_action_bindings"] = @($state["thread_action_bindings"])
}

$statePath = if ([string]::IsNullOrWhiteSpace($StateFile)) { Get-DefaultStateFilePath } else { $StateFile }
$state = Read-State -path $statePath
Ensure-BindingCollection -state $state

$resolvedPlaybookPath = Resolve-PlaybookPathFromState -state $state -override $PlaybookPath
$playbook = Read-Playbook -path $resolvedPlaybookPath
if (-not [string]::IsNullOrWhiteSpace($resolvedPlaybookPath)) {
    $state["playbook_path"] = $resolvedPlaybookPath
}

if ($List.IsPresent) {
    Write-Host "Governance action bindings:"
    Write-Host ("- state_file: {0}" -f $statePath)
    $playbookDisplay = "(none)"
    if (-not [string]::IsNullOrWhiteSpace($playbook.path)) {
        $playbookDisplay = $playbook.path
    }
    Write-Host ("- playbook: {0}" -f $playbookDisplay)
    if ($playbook.keys.Count -gt 0) {
        Write-Host ("- action_keys: {0}" -f ($playbook.keys -join ", "))
    }
    $bindings = @($state["thread_action_bindings"])
    if ($bindings.Count -eq 0) {
        Write-Host "- bindings: (none)"
        exit 0
    }
    foreach ($binding in $bindings) {
        Write-Host ("- thread_id={0} action_key={1} one_shot={2} id={3}" -f `
            (Ensure-Text $binding.thread_id), `
            (Ensure-Text $binding.action_key), `
            ([bool]$binding.one_shot), `
            (Ensure-Text $binding.id))
    }
    exit 0
}

$normalizedThreadId = (Ensure-Text $ThreadId).Trim()
if ([string]::IsNullOrWhiteSpace($normalizedThreadId)) {
    throw "ThreadId is required."
}

if ($Remove.IsPresent) {
    $remaining = @()
    $removed = $false
    foreach ($binding in @($state["thread_action_bindings"])) {
        if ((Ensure-Text $binding.thread_id) -eq $normalizedThreadId) {
            $removed = $true
            continue
        }
        $remaining += $binding
    }
    $state["thread_action_bindings"] = $remaining
    Write-State -path $statePath -state $state
    if ($removed) {
        Write-Host ("Removed governance binding for thread {0}" -f $normalizedThreadId)
    } else {
        Write-Host ("No governance binding found for thread {0}" -f $normalizedThreadId)
    }
    exit 0
}

$normalizedActionKey = (Ensure-Text $ActionKey).Trim().ToLowerInvariant()
if ([string]::IsNullOrWhiteSpace($normalizedActionKey)) {
    throw "ActionKey is required when adding/updating a binding."
}
if ($playbook.keys.Count -eq 0) {
    throw "No action keys found in playbook. Update governance_action_playbook.json first."
}
if (-not ($playbook.keys -contains $normalizedActionKey)) {
    throw "ActionKey '$normalizedActionKey' is not present in playbook. Available keys: $($playbook.keys -join ', ')"
}

$nowIso = [DateTime]::UtcNow.ToString("o")
$bindings = @()
$updated = $false
foreach ($binding in @($state["thread_action_bindings"])) {
    if ((Ensure-Text $binding.thread_id) -ne $normalizedThreadId) {
        $bindings += $binding
        continue
    }
    $updatedBinding = [ordered]@{
        id = Ensure-Text $binding.id
        thread_id = $normalizedThreadId
        action_key = $normalizedActionKey
        one_shot = -not $Persistent.IsPresent
        created_at = if ([string]::IsNullOrWhiteSpace((Ensure-Text $binding.created_at))) { $nowIso } else { Ensure-Text $binding.created_at }
        updated_at = $nowIso
    }
    if ([string]::IsNullOrWhiteSpace($updatedBinding.id)) {
        $updatedBinding.id = [guid]::NewGuid().ToString()
    }
    $bindings += [pscustomobject]$updatedBinding
    $updated = $true
}

if (-not $updated) {
    $bindings += [pscustomobject]([ordered]@{
            id = [guid]::NewGuid().ToString()
            thread_id = $normalizedThreadId
            action_key = $normalizedActionKey
            one_shot = -not $Persistent.IsPresent
            created_at = $nowIso
            updated_at = $nowIso
        })
}

$state["thread_action_bindings"] = $bindings
Write-State -path $statePath -state $state

if ($updated) {
    Write-Host ("Updated governance binding: thread={0} action_key={1} one_shot={2}" -f $normalizedThreadId, $normalizedActionKey, (-not $Persistent.IsPresent))
} else {
    Write-Host ("Added governance binding: thread={0} action_key={1} one_shot={2}" -f $normalizedThreadId, $normalizedActionKey, (-not $Persistent.IsPresent))
}
Write-Host ("State file: {0}" -f $statePath)
Write-Host ("Playbook: {0}" -f $playbook.path)
Write-Host "Next:"
Write-Host "  .\pg.ps1 governance-worker -Once"
