<#!
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
    [string]$ProjectRoot = "",
    [string]$InstallChannel = "project-setup",
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    (Get-Location).Path
} else {
    [System.IO.Path]::GetFullPath($ProjectRoot)
}
$scaffoldVersion = "2026.03.20.2"

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

function Ensure-GeneratedScaffoldVersion {
    $versionPayload = [ordered]@{
        scaffold_version = $scaffoldVersion
        installed_at_utc = [DateTime]::UtcNow.ToString("o")
        installed_by_command = $InstallChannel
        install_channel = $InstallChannel
        managed_manifest_version = $scaffoldVersion
    } | ConvertTo-Json -Depth 4
    Ensure-File "Memory-bank/_generated/pg-scaffold-version.json" $versionPayload
}

$script:packageManifestLoaded = $false
$script:packageManifestCache = $null

function Get-PackageManifestObject {
    if ($script:packageManifestLoaded) {
        return $script:packageManifestCache
    }
    $manifestPath = Join-Path $projectRoot "package.json"
    $script:packageManifestLoaded = $true
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        return $null
    }
    try {
        $script:packageManifestCache = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json -Depth 20
    }
    catch {
        $script:packageManifestCache = $null
    }
    return $script:packageManifestCache
}

function Test-LooksLikeFrontendNodeProject {
    $manifest = Get-PackageManifestObject
    if ($null -eq $manifest) {
        return $false
    }
    $dependencyNames = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($sectionName in @("dependencies", "devDependencies", "peerDependencies", "optionalDependencies")) {
        $section = $manifest.$sectionName
        if ($null -eq $section) {
            continue
        }
        foreach ($prop in $section.PSObject.Properties) {
            $null = $dependencyNames.Add($prop.Name)
        }
    }
    foreach ($hint in @("react", "react-dom", "next", "vue", "nuxt", "svelte", "@sveltejs/kit", "@angular/core", "solid-js", "preact", "astro", "vite", "react-scripts")) {
        if ($dependencyNames.Contains($hint)) {
            return $true
        }
    }
    if ($manifest.scripts) {
        foreach ($prop in $manifest.scripts.PSObject.Properties) {
            $name = [string]$prop.Name
            $value = [string]$prop.Value
            if ($name -in @("dev", "start", "preview") -and $value -match "vite|next|nuxt|svelte|astro|react-scripts|webpack|parcel") {
                return $true
            }
        }
    }
    return $false
}

function Ensure-PlaywrightFrontendBaseline {
    $configContent = @"
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PG_PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const startCommand = process.env.PG_PLAYWRIGHT_START_COMMAND ?? "npm run dev";
const browserMatrix = (process.env.PG_PLAYWRIGHT_BROWSER_MATRIX ?? "minimal").toLowerCase();

function resolveProjects() {
  const desktopProjects = [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } }
  ];
  if (browserMatrix === "full") {
    return [...desktopProjects, { name: "mobile-chrome", use: { ...devices["Pixel 5"] } }, { name: "mobile-safari", use: { ...devices["iPhone 12"] } }];
  }
  if (browserMatrix === "desktop") {
    return desktopProjects;
  }
  return [desktopProjects[0]];
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: resolveProjects(),
  webServer: {
    command: startCommand,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120 * 1000
  }
});
"@
    $specContent = @"
import { expect, test } from "@playwright/test";

test("@smoke homepage renders visible content", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("body")).toContainText(/\S+/);
});
"@
    Ensure-File "playwright.config.ts" $configContent
    Ensure-File "tests/smoke/homepage.spec.ts" $specContent
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
        enforcement_mode       = "strict"
    }
    ui = @{
        design_guardrails_required       = $true
        design_similarity_mode           = "similar-not-copy"
        user_design_guide_precedence     = $true
        major_surface_consistency_needed = $true
    }
} | ConvertTo-Json -Depth 4
Ensure-File ".narrate/config.json" $configJson

# .narrate/policy.json
$policyJson = @{
    domains          = $domains
    enforcement      = "strict"
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
playwright-report/
test-results/
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
Ensure-GeneratedScaffoldVersion

# Frontend integration scaffold
$integrationScript = Join-Path $PSScriptRoot "frontend_integration.ps1"
if (Test-Path -LiteralPath $integrationScript) {
    $integrationOutput = & $integrationScript -Action init -Json
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace(($integrationOutput | Out-String))) {
        try {
            $integrationResult = $integrationOutput | ConvertFrom-Json -Depth 10
            $created += "Memory-bank/frontend-integration.md"
            $created += "Memory-bank/frontend-integration/state.json"
            $created += "Memory-bank/frontend-integration/pages/*"
        }
        catch {
            $created += "Memory-bank/frontend-integration.*"
        }
    }
}

if ($detected -eq "node" -and (Test-LooksLikeFrontendNodeProject)) {
    Ensure-PlaywrightFrontendBaseline
    $playwrightAuthorScript = Join-Path $PSScriptRoot "playwright_author_suite.ps1"
    if (Test-Path -LiteralPath $playwrightAuthorScript) {
        & $playwrightAuthorScript -ProjectRoot $projectRoot -WorkingDirectory $projectRoot | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $created += "tests/pg-generated/*"
            $created += "Memory-bank/_generated/playwright-authoring/playwright-authoring-latest.json"
        }
    }
}

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
