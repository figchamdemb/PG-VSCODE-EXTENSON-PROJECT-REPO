[CmdletBinding()]
param(
    [switch]$Json,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$globalRoot = Join-Path $HOME ".pg-cli"
$payloadRoot = Join-Path $globalRoot "payload\current"
$manifestPath = Join-Path $globalRoot "payload\manifest.json"
$templatePath = Join-Path $PSScriptRoot "global_pg_cli_template.ps1"
$globalScriptPath = Join-Path $globalRoot "pg.ps1"
$globalCmdPath = Join-Path $globalRoot "pg.cmd"
$scaffoldVersion = "2026.03.20.2"

function Ensure-Directory([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
}

function Write-Utf8File([string]$path, [string]$content) {
    $dir = Split-Path -Parent $path
    Ensure-Directory -path $dir
    [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
}

function Copy-ManagedFile([string]$relativePath) {
    $sourcePath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        return $false
    }
    $destinationPath = Join-Path $payloadRoot $relativePath
    $destinationDir = Split-Path -Parent $destinationPath
    Ensure-Directory -path $destinationDir
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    return $true
}

$payloadFiles = @(
    "pg.ps1",
    "pg.cmd",
    "AGENTS.md",
    "CLAUDE.md",
    "ANTIGRAVITY.md",
    "GEMINI.md",
    "scripts/pg.ps1",
    "scripts/project_setup.ps1",
    "scripts/scaffold_upgrade.ps1",
    "scripts/start_memory_bank_session.ps1",
    "scripts/start_memory_bank_session.py",
    "scripts/start_memory_bank_session.sh",
    "scripts/end_memory_bank_session.ps1",
    "scripts/end_memory_bank_session.py",
    "scripts/session_status.py",
    "scripts/install_memory_bank_hooks.ps1",
    "scripts/install_memory_bank_hooks.sh",
    "scripts/memory_bank_guard.py",
    "scripts/memory_bank_guard_daily.py",
    "scripts/memory_bank_guard_design.py",
    "scripts/memory_bank_guard_git.py",
    "scripts/memory_bank_guard_integration.py",
    "scripts/memory_bank_guard_milestones.py",
    "scripts/memory_bank_guard_self_check.py",
    "scripts/enforcement_trigger.ps1",
    "scripts/self_check.ps1",
    "scripts/build_frontend_summary.py",
    "scripts/generate_memory_bank.py",
    "scripts/map_structure.py",
    "scripts/map_structure_db.py",
    "scripts/agents_integrity.ps1",
    "scripts/dependency_verify.ps1",
    "scripts/coding_verify.ps1",
    "scripts/api_contract_verify.ps1",
    "scripts/db_index_maintenance_check.ps1",
    "scripts/db_index_fix_plan.ps1",
    "scripts/playwright_smoke_check.ps1",
    "scripts/dev_profile.ps1",
    "scripts/pg_lifecycle.ps1"
)

Ensure-Directory -path $globalRoot
Ensure-Directory -path $payloadRoot

$copied = @()
foreach ($relativePath in $payloadFiles) {
    if (Copy-ManagedFile -relativePath $relativePath) {
        $copied += $relativePath
    }
}

$templateContent = Get-Content -LiteralPath $templatePath -Raw
Write-Utf8File -path $globalScriptPath -content $templateContent
Write-Utf8File -path $globalCmdPath -content "@echo off`r`npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pg.ps1" %*`r`n"

$manifest = [ordered]@{
    synced_at_utc = [DateTime]::UtcNow.ToString("o")
    source_repo = $repoRoot
    scaffold_version = $scaffoldVersion
    payload_root = $payloadRoot
    files_copied = $copied
    global_script = $globalScriptPath
}

$manifestJson = $manifest | ConvertTo-Json -Depth 6
Write-Utf8File -path $manifestPath -content $manifestJson

if ($Json.IsPresent) {
    $manifest | ConvertTo-Json -Depth 6
} else {
    Write-Host "Global PG CLI synced."
    Write-Host "Global root: $globalRoot"
    Write-Host "Payload root: $payloadRoot"
    Write-Host "Files copied: $($copied.Count)"
}