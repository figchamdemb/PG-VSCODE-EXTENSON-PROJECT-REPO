[CmdletBinding()]
param(
    [string]$TargetPath = "",
    [switch]$DryRun,
    [switch]$Yes,
    [string]$BackupRoot = "",
    [switch]$SkipPostUpgradeHookInstall,
    [switch]$SkipPostUpgradeStart,
    [switch]$RunSelfCheck,
    [switch]$Json
)

$ErrorActionPreference = "Stop"

$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedTargetRoot = if ([string]::IsNullOrWhiteSpace($TargetPath)) {
    (Get-Location).Path
} else {
    [System.IO.Path]::GetFullPath($TargetPath)
}

if (-not (Test-Path -LiteralPath $resolvedTargetRoot)) {
    throw "Target path does not exist: $resolvedTargetRoot"
}

$scaffoldVersion = "2026.03.20.2"
$sessionId = Get-Date -Format "yyyyMMdd-HHmmss"
$previewOnly = $DryRun.IsPresent -or -not $Yes.IsPresent
$reportRoot = if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
    Join-Path $resolvedTargetRoot (Join-Path "Memory-bank\_generated\scaffold-upgrades" $sessionId)
} else {
    [System.IO.Path]::GetFullPath($BackupRoot)
}
$backupRootPath = Join-Path $reportRoot "backup"
$reportJsonPath = Join-Path $reportRoot "upgrade-report.json"
$reportMarkdownPath = Join-Path $reportRoot "upgrade-report.md"
$versionFileRelativePath = "Memory-bank/_generated/pg-scaffold-version.json"
$versionFilePath = Join-Path $resolvedTargetRoot $versionFileRelativePath

function New-DirectoryIfMissing([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
}

function Get-FileHashOrEmpty([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        return ""
    }
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
}

function Read-JsonObject([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        return $null
    }
    $raw = Get-Content -LiteralPath $path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }
    return ConvertFrom-Json -InputObject $raw
}

function Get-PreviousScaffoldVersion {
    $versionRecord = Read-JsonObject -path $versionFilePath
    if ($null -eq $versionRecord) {
        return "legacy_unversioned"
    }
    if ($versionRecord.PSObject.Properties.Name -contains "scaffold_version") {
        return [string]$versionRecord.scaffold_version
    }
    return "legacy_unversioned"
}

function Backup-TargetFile([string]$relativePath, [string]$fullPath) {
    if (-not (Test-Path -LiteralPath $fullPath)) {
        return $null
    }
    $destinationPath = Join-Path $backupRootPath $relativePath
    $destinationDir = Split-Path -Parent $destinationPath
    New-DirectoryIfMissing -path $destinationDir
    Copy-Item -LiteralPath $fullPath -Destination $destinationPath -Force
    return $destinationPath
}

function Write-JsonUtf8([string]$path, [object]$value) {
    $dir = Split-Path -Parent $path
    New-DirectoryIfMissing -path $dir
    $json = $value | ConvertTo-Json -Depth 12
    [System.IO.File]::WriteAllText($path, $json, [System.Text.UTF8Encoding]::new($false))
}

function Write-TextUtf8([string]$path, [string]$value) {
    $dir = Split-Path -Parent $path
    New-DirectoryIfMissing -path $dir
    [System.IO.File]::WriteAllText($path, $value, [System.Text.UTF8Encoding]::new($false))
}

function New-ScaffoldVersionPayload([string]$channel) {
    return [ordered]@{
        scaffold_version = $scaffoldVersion
        installed_at_utc = [DateTime]::UtcNow.ToString("o")
        installed_by_command = $channel
        install_channel = $channel
        managed_manifest_version = $scaffoldVersion
    }
}

function Ensure-GitIgnorePgSection {
    param([string]$targetFile)

    $pgSection = @"

# PG / Narrate
.narrate/secrets/
Memory-bank/_generated/session-state.json
Memory-bank/_generated/pg-cli-state.json
Memory-bank/_generated/pg-scaffold-version.json
Memory-bank/_generated/scaffold-upgrades/
*.yrp
"@

    if (-not (Test-Path -LiteralPath $targetFile)) {
        Write-TextUtf8 -path $targetFile -value ($pgSection.TrimStart())
        return "created"
    }

    $existing = Get-Content -LiteralPath $targetFile -Raw
    if ($existing -match "# PG / Narrate") {
        return "unchanged"
    }

    Write-TextUtf8 -path $targetFile -value ($existing.TrimEnd() + "`r`n" + $pgSection)
    return "merged"
}

function Ensure-MissingStrictConfig([string]$targetRoot) {
    $configPath = Join-Path $targetRoot ".narrate\config.json"
    $policyPath = Join-Path $targetRoot ".narrate\policy.json"
    $memoryBankReadmePath = Join-Path $targetRoot "Memory-bank\README.md"
    $targetName = Split-Path $targetRoot -Leaf
    $configPayload = [ordered]@{
        project = [ordered]@{
            name = $targetName
            framework = "auto"
            created = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        }
        governance = [ordered]@{
            memory_bank_required = $true
            self_check_on_batch = $true
            file_line_limit = 500
            enforcement_mode = "strict"
        }
        ui = [ordered]@{
            design_guardrails_required = $true
            design_similarity_mode = "similar-not-copy"
            user_design_guide_precedence = $true
            major_surface_consistency_needed = $true
        }
    }
    $policyPayload = [ordered]@{
        domains = @("coding-standards", "dependency")
        enforcement = "strict"
        auto_fix = $false
        prod_checklist = $false
        offline_pack = $false
        framework = "generic"
        profile_version = "1.0.0"
    }
    $memoryBankReadme = @"
# Memory-bank

Project memory for AI-assisted development sessions.
See AGENTS.md for workflow requirements.
"@

    $results = @()
    if (-not (Test-Path -LiteralPath $configPath)) {
        Write-JsonUtf8 -path $configPath -value $configPayload
        $results += ".narrate/config.json"
    }
    if (-not (Test-Path -LiteralPath $policyPath)) {
        Write-JsonUtf8 -path $policyPath -value $policyPayload
        $results += ".narrate/policy.json"
    }
    if (-not (Test-Path -LiteralPath $memoryBankReadmePath)) {
        Write-TextUtf8 -path $memoryBankReadmePath -value $memoryBankReadme
        $results += "Memory-bank/README.md"
    }
    return $results
}

$replaceRelativePaths = @(
    "pg.ps1",
    "pg.cmd",
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

$mergeRelativePaths = @(
    ".gitignore",
    "AGENTS.md",
    "CLAUDE.md",
    "ANTIGRAVITY.md",
    "GEMINI.md",
    ".narrate/config.json",
    ".narrate/policy.json"
)

$report = [ordered]@{
    ok = $true
    mode = $(if ($previewOnly) { "dry-run" } else { "apply" })
    session_id = $sessionId
    target_root = $resolvedTargetRoot
    source_root = $sourceRoot
    previous_scaffold_version = Get-PreviousScaffoldVersion
    target_scaffold_version = $scaffoldVersion
    replaced = @()
    created = @()
    merged = @()
    unchanged = @()
    preserved = @()
    manual_review_required = @()
    backups = @()
    post_upgrade = [ordered]@{
        hook_install = "skipped"
        start = "skipped"
        self_check = "skipped"
    }
}

New-DirectoryIfMissing -path $reportRoot
New-DirectoryIfMissing -path $backupRootPath

foreach ($relativePath in $replaceRelativePaths) {
    $sourcePath = Join-Path $sourceRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        continue
    }

    $targetPathFull = Join-Path $resolvedTargetRoot $relativePath
    $targetExistedBefore = Test-Path -LiteralPath $targetPathFull
    $sourceHash = Get-FileHashOrEmpty -path $sourcePath
    $targetHash = Get-FileHashOrEmpty -path $targetPathFull

    if ($sourceHash -eq $targetHash -and -not [string]::IsNullOrWhiteSpace($sourceHash)) {
        $report.unchanged += $relativePath
        continue
    }

    if (-not $previewOnly) {
        $backupPath = Backup-TargetFile -relativePath $relativePath -fullPath $targetPathFull
        if ($backupPath) {
            $report.backups += [ordered]@{ path = $relativePath; backup_path = $backupPath }
        }
        $targetDir = Split-Path -Parent $targetPathFull
        New-DirectoryIfMissing -path $targetDir
        Copy-Item -LiteralPath $sourcePath -Destination $targetPathFull -Force
    }

    if ($targetExistedBefore) {
        $report.replaced += $relativePath
    } else {
        $report.created += $relativePath
    }
}

foreach ($relativePath in $mergeRelativePaths) {
    $sourcePath = Join-Path $sourceRoot $relativePath
    $targetPathFull = Join-Path $resolvedTargetRoot $relativePath
    $sourceExists = Test-Path -LiteralPath $sourcePath
    $targetExists = Test-Path -LiteralPath $targetPathFull
    if (-not $sourceExists) {
        continue
    }

    if ($relativePath -eq ".gitignore") {
        if (-not $previewOnly) {
            $backupPath = Backup-TargetFile -relativePath $relativePath -fullPath $targetPathFull
            if ($backupPath) {
                $report.backups += [ordered]@{ path = $relativePath; backup_path = $backupPath }
            }
            $mergeResult = Ensure-GitIgnorePgSection -targetFile $targetPathFull
            if ($mergeResult -eq "created") {
                $report.created += $relativePath
            } elseif ($mergeResult -eq "merged") {
                $report.merged += $relativePath
            } else {
                $report.unchanged += $relativePath
            }
        } else {
            $existing = if ($targetExists) { Get-Content -LiteralPath $targetPathFull -Raw } else { "" }
            if ([string]::IsNullOrWhiteSpace($existing)) {
                $report.created += $relativePath
            } elseif ($existing -match "# PG / Narrate") {
                $report.unchanged += $relativePath
            } else {
                $report.merged += $relativePath
            }
        }
        continue
    }

    if (-not $targetExists) {
        if (-not $previewOnly) {
            $targetDir = Split-Path -Parent $targetPathFull
            New-DirectoryIfMissing -path $targetDir
            Copy-Item -LiteralPath $sourcePath -Destination $targetPathFull -Force
        }
        $report.created += $relativePath
        continue
    }

    $sourceHash = Get-FileHashOrEmpty -path $sourcePath
    $targetHash = Get-FileHashOrEmpty -path $targetPathFull
    if ($sourceHash -eq $targetHash) {
        $report.unchanged += $relativePath
        continue
    }

    $report.manual_review_required += $relativePath
}

if (-not $previewOnly) {
    $ensuredFiles = Ensure-MissingStrictConfig -targetRoot $resolvedTargetRoot
    foreach ($ensuredFile in $ensuredFiles) {
        if ($report.created -notcontains $ensuredFile) {
            $report.created += $ensuredFile
        }
    }
    $versionBackupPath = Backup-TargetFile -relativePath $versionFileRelativePath -fullPath $versionFilePath
    if ($versionBackupPath) {
        $report.backups += [ordered]@{ path = $versionFileRelativePath; backup_path = $versionBackupPath }
    }
    Write-JsonUtf8 -path $versionFilePath -value (New-ScaffoldVersionPayload -channel "upgrade-scaffold")
    if ($report.created -notcontains $versionFileRelativePath -and $report.replaced -notcontains $versionFileRelativePath) {
        if (Test-Path -LiteralPath $versionFilePath) {
            if ($versionBackupPath) {
                $report.replaced += $versionFileRelativePath
            } else {
                $report.created += $versionFileRelativePath
            }
        }
    }
}

$report.preserved = @(
    "Memory-bank/daily/*",
    "Memory-bank/agentsGlobal-memory.md",
    "Memory-bank/project-spec.md",
    "Memory-bank/project-details.md",
    "Memory-bank/structure-and-db.md",
    "Memory-bank/code-tree/*",
    "Memory-bank/db-schema/*",
    "Memory-bank/frontend-integration/*",
    "Memory-bank/review-workflow/*",
    "application source files"
)

if (-not $previewOnly -and -not $SkipPostUpgradeHookInstall.IsPresent) {
    $hookScript = Join-Path $resolvedTargetRoot "scripts\install_memory_bank_hooks.ps1"
    if (Test-Path -LiteralPath $hookScript) {
        try {
            Push-Location $resolvedTargetRoot
            & $hookScript -Mode strict -Force | Out-Null
            $report.post_upgrade.hook_install = "applied"
        }
        catch {
            $report.post_upgrade.hook_install = "failed: $($_.Exception.Message)"
            $report.ok = $false
        }
        finally {
            Pop-Location
        }
    }
}

if (-not $previewOnly -and -not $SkipPostUpgradeStart.IsPresent) {
    $targetPg = Join-Path $resolvedTargetRoot "pg.ps1"
    if (Test-Path -LiteralPath $targetPg) {
        try {
            Push-Location $resolvedTargetRoot
            & $targetPg start -Yes -SkipDevProfileNotice | Out-Null
            $report.post_upgrade.start = "applied"
        }
        catch {
            $report.post_upgrade.start = "failed: $($_.Exception.Message)"
        }
        finally {
            Pop-Location
        }
    }
}

if (-not $previewOnly -and $RunSelfCheck.IsPresent) {
    $targetPg = Join-Path $resolvedTargetRoot "pg.ps1"
    if (Test-Path -LiteralPath $targetPg) {
        try {
            Push-Location $resolvedTargetRoot
            & $targetPg self-check -EnableDbIndexMaintenanceCheck | Out-Null
            $report.post_upgrade.self_check = "applied"
        }
        catch {
            $report.post_upgrade.self_check = "failed: $($_.Exception.Message)"
        }
        finally {
            Pop-Location
        }
    }
}

$markdown = @(
    "# PG Scaffold Upgrade Report",
    "",
    "- session_id: $sessionId",
    "- mode: $($report.mode)",
    "- target_root: $resolvedTargetRoot",
    "- previous_scaffold_version: $($report.previous_scaffold_version)",
    "- target_scaffold_version: $scaffoldVersion",
    "",
    "## Summary",
    "- replaced: $($report.replaced.Count)",
    "- created: $($report.created.Count)",
    "- merged: $($report.merged.Count)",
    "- unchanged: $($report.unchanged.Count)",
    "- manual_review_required: $($report.manual_review_required.Count)",
    "",
    "## Manual Review Required",
    $(if ($report.manual_review_required.Count -gt 0) { ($report.manual_review_required | ForEach-Object { "- $_" }) } else { "- none" }),
    "",
    "## Post Upgrade",
    "- hook_install: $($report.post_upgrade.hook_install)",
    "- start: $($report.post_upgrade.start)",
    "- self_check: $($report.post_upgrade.self_check)"
) -join "`r`n"

Write-JsonUtf8 -path $reportJsonPath -value $report
Write-TextUtf8 -path $reportMarkdownPath -value $markdown

if ($Json.IsPresent) {
    $report | ConvertTo-Json -Depth 12
} else {
    Write-Host "PG scaffold upgrade report: $reportMarkdownPath"
    Write-Host "Mode: $($report.mode)"
    Write-Host "Target: $resolvedTargetRoot"
    Write-Host "Previous scaffold version: $($report.previous_scaffold_version)"
    Write-Host "Target scaffold version: $scaffoldVersion"
    Write-Host "Replaced: $($report.replaced.Count) | Created: $($report.created.Count) | Merged: $($report.merged.Count) | Manual review: $($report.manual_review_required.Count)"
    if ($previewOnly) {
        Write-Host "Preview only. Re-run with -Yes to apply changes." -ForegroundColor Yellow
    }
}