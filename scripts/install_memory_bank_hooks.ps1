param(
    [ValidateSet("warn", "strict")]
    [string]$Mode = "warn",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$hooksDir = Join-Path $projectRoot ".githooks"
$preCommitPath = Join-Path $hooksDir "pre-commit"
$guardScriptPath = Join-Path $projectRoot "scripts/memory_bank_guard.py"

function Get-RelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$BasePath,
        [Parameter(Mandatory = $true)][string]$TargetPath
    )

    $baseFull = [System.IO.Path]::GetFullPath($BasePath)
    if (-not $baseFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $baseFull += [System.IO.Path]::DirectorySeparatorChar
    }

    $targetFull = [System.IO.Path]::GetFullPath($TargetPath)
    $baseUri = New-Object System.Uri($baseFull)
    $targetUri = New-Object System.Uri($targetFull)
    $relativeUri = $baseUri.MakeRelativeUri($targetUri)
    return [System.Uri]::UnescapeDataString($relativeUri.ToString())
}

$gitTopLevel = & git -C $projectRoot rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($gitTopLevel)) {
    throw "Could not resolve git top-level from: $projectRoot"
}
$gitTopLevel = $gitTopLevel.Trim()

$hooksPathRelative = (Get-RelativePath -BasePath $gitTopLevel -TargetPath $hooksDir).Replace("\", "/")
$guardPathRelative = (Get-RelativePath -BasePath $gitTopLevel -TargetPath $guardScriptPath).Replace("\", "/")
if ([string]::IsNullOrWhiteSpace($hooksPathRelative) -or $hooksPathRelative -eq ".") {
    $hooksPathRelative = ".githooks"
}

New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null

$hookTemplate = @"
#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
python "$repo_root/__GUARD_PATH__"
"@
$hookContent = $hookTemplate.Replace("__GUARD_PATH__", $guardPathRelative)

if (-not (Test-Path -LiteralPath $preCommitPath) -or $Force) {
    [System.IO.File]::WriteAllText($preCommitPath, ($hookContent -replace "`r`n", "`n"), [System.Text.UTF8Encoding]::new($false))
    Write-Host "Wrote pre-commit hook: $preCommitPath"
} else {
    $existing = [System.IO.File]::ReadAllText($preCommitPath, [System.Text.Encoding]::UTF8)
    if (($existing -replace "`r`n", "`n") -ne ($hookContent -replace "`r`n", "`n")) {
        [System.IO.File]::WriteAllText($preCommitPath, ($hookContent -replace "`r`n", "`n"), [System.Text.UTF8Encoding]::new($false))
        Write-Host "Updated pre-commit hook: $preCommitPath"
    } else {
        Write-Host "Pre-commit hook already up to date: $preCommitPath"
    }
}

& git -C $gitTopLevel config core.hooksPath $hooksPathRelative
if ($LASTEXITCODE -ne 0) {
    throw "Failed to set core.hooksPath to $hooksPathRelative"
}

& git -C $gitTopLevel config memorybank.mode $Mode
if ($LASTEXITCODE -ne 0) {
    throw "Failed to set memorybank.mode to $Mode"
}

Write-Host "Configured core.hooksPath=$hooksPathRelative"
Write-Host "Configured memorybank.mode=$Mode"