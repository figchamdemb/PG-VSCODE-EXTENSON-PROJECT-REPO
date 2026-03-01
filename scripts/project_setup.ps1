<#
.SYNOPSIS
  One-Click Project Setup — Framework-aware project bootstrapper.
  Called via: .\pg.ps1 init [-Framework <name>] [-Name <name>] [-Json]
.DESCRIPTION
  Detects (or accepts) a framework, then scaffolds:
    - .narrate/         policy & governance config folder
    - .narrate/config.json     base governance settings
    - .narrate/policy.json     policy domain defaults for detected framework
    - .editorconfig     if missing
    - .gitignore        append PG patterns if missing
    - Memory-bank/      stub if not present
  Does NOT overwrite existing files (idempotent).
#>
[CmdletBinding()]
param(
    [ValidateSet("auto", "node", "dotnet", "python", "java", "go", "rust", "generic")]
    [string]$Framework = "auto",
    [string]$Name = "",
    [switch]$Json,
    [switch]$DryRun,
    [switch]$Force,
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = (Get-Location).Path

# ── Framework detection ──────────────────────────────────────────────────

function Detect-Framework {
    if (Test-Path (Join-Path $projectRoot "package.json")) { return "node" }
    if (Test-Path (Join-Path $projectRoot "*.csproj")) { return "dotnet" }
    if (Test-Path (Join-Path $projectRoot "*.sln")) { return "dotnet" }
    if (Test-Path (Join-Path $projectRoot "requirements.txt")) { return "python" }
    if (Test-Path (Join-Path $projectRoot "pyproject.toml")) { return "python" }
    if (Test-Path (Join-Path $projectRoot "pom.xml")) { return "java" }
    if (Test-Path (Join-Path $projectRoot "build.gradle")) { return "java" }
    if (Test-Path (Join-Path $projectRoot "go.mod")) { return "go" }
    if (Test-Path (Join-Path $projectRoot "Cargo.toml")) { return "rust" }
    return "generic"
}

$detected = if ($Framework -eq "auto") { Detect-Framework } else { $Framework }
$projectName = if ($Name) { $Name } else { Split-Path $projectRoot -Leaf }

# ── Template data ────────────────────────────────────────────────────────

$policyDomainsByFramework = @{
    node    = @("coding-standards", "dependency", "api-contract", "observability", "scalability")
    dotnet  = @("coding-standards", "dependency", "api-contract", "cloud-score", "scalability")
    python  = @("coding-standards", "dependency", "prompt-guard", "observability")
    java    = @("coding-standards", "dependency", "api-contract", "scalability")
    go      = @("coding-standards", "dependency", "scalability")
    rust    = @("coding-standards", "dependency", "scalability")
    generic = @("coding-standards", "dependency")
}

$domains = $policyDomainsByFramework[$detected]

# ── File scaffolding ─────────────────────────────────────────────────────

$created = @()
$skipped = @()

function Ensure-File {
    param([string]$RelPath, [string]$Content)
    $full = Join-Path $projectRoot $RelPath
    $dir = Split-Path $full -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    if ((Test-Path $full) -and -not $Force.IsPresent) {
        $script:skipped += $RelPath
        return
    }
    if (-not $DryRun.IsPresent) {
        Set-Content -Path $full -Value $Content -Encoding utf8NoBOM
    }
    $script:created += $RelPath
}

# .narrate/config.json
$configJson = @{
    project = @{
        name      = $projectName
        framework = $detected
        created   = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    }
    governance = @{
        memory_bank_required   = $true
        self_check_on_batch    = $true
        file_line_limit        = 500
        enforcement_mode       = "warn"
    }
} | ConvertTo-Json -Depth 4
Ensure-File ".narrate/config.json" $configJson

# .narrate/policy.json
$policyJson = @{
    domains          = $domains
    enforcement      = "warn"
    auto_fix         = $false
    prod_checklist   = $false
    offline_pack     = $false
    framework        = $detected
    profile_version  = "1.0.0"
} | ConvertTo-Json -Depth 3
Ensure-File ".narrate/policy.json" $policyJson

# .editorconfig
$editorCfg = @"
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
"@
Ensure-File ".editorconfig" $editorCfg

# .gitignore PG section
$gitignorePath = Join-Path $projectRoot ".gitignore"
$pgSection = @"

# PG / Narrate
.narrate/secrets/
Memory-bank/_generated/session-state.json
Memory-bank/_generated/pg-cli-state.json
*.yrp
"@
if (Test-Path $gitignorePath) {
    $existing = Get-Content $gitignorePath -Raw -ErrorAction SilentlyContinue
    if ($existing -and $existing -notmatch "PG / Narrate") {
        if (-not $DryRun.IsPresent) {
            Add-Content -Path $gitignorePath -Value $pgSection -Encoding utf8NoBOM
        }
        $created += ".gitignore (appended)"
    } else {
        $skipped += ".gitignore"
    }
} else {
    Ensure-File ".gitignore" $pgSection.TrimStart()
}

# Memory-bank stub
$mbReadme = @"
# Memory-bank

Project memory for AI-assisted development sessions.
See AGENTS.md for workflow requirements.
"@
Ensure-File "Memory-bank/README.md" $mbReadme

# ── Output ───────────────────────────────────────────────────────────────

$result = @{
    ok        = $true
    project   = $projectName
    framework = $detected
    created   = $created
    skipped   = $skipped
    dry_run   = $DryRun.IsPresent
}

if ($Json.IsPresent) {
    $result | ConvertTo-Json -Depth 3
} else {
    Write-Host ""
    Write-Host "  PG Project Setup" -ForegroundColor Cyan
    Write-Host "  ────────────────────────────────────────"
    Write-Host "  Project:   $projectName"
    Write-Host "  Framework: $detected"
    Write-Host "  Domains:   $($domains -join ', ')"
    Write-Host ""
    if ($DryRun.IsPresent) {
        Write-Host "  [DRY RUN] No files written." -ForegroundColor Yellow
    }
    if ($created.Count -gt 0) {
        Write-Host "  Created:" -ForegroundColor Green
        foreach ($f in $created) { Write-Host "    + $f" }
    }
    if ($skipped.Count -gt 0) {
        Write-Host "  Skipped (already exist):" -ForegroundColor DarkGray
        foreach ($f in $skipped) { Write-Host "    - $f" }
    }
    Write-Host ""
}
