param(
    [ValidateSet("warn", "strict")]
    [string]$Mode = "warn",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$hooksDir = Join-Path $projectRoot ".githooks"
$preCommitPath = Join-Path $hooksDir "pre-commit"
$prePushPath = Join-Path $hooksDir "pre-push"
$guardScriptPath = Join-Path $projectRoot "scripts/memory_bank_guard.py"
$enforcementScriptPath = Join-Path $projectRoot "scripts/enforcement_trigger.ps1"

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

function Write-HookFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content,
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][bool]$ForceRewrite
    )

    if (-not (Test-Path -LiteralPath $Path) -or $ForceRewrite) {
        [System.IO.File]::WriteAllText($Path, ($Content -replace "`r`n", "`n"), [System.Text.UTF8Encoding]::new($false))
        Write-Host "Wrote $Label hook: $Path"
        return
    }

    $existing = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    if (($existing -replace "`r`n", "`n") -ne ($Content -replace "`r`n", "`n")) {
        [System.IO.File]::WriteAllText($Path, ($Content -replace "`r`n", "`n"), [System.Text.UTF8Encoding]::new($false))
        Write-Host "Updated $Label hook: $Path"
    } else {
        Write-Host "$Label hook already up to date: $Path"
    }
}

$gitTopLevel = & git -C $projectRoot rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($gitTopLevel)) {
    throw "Could not resolve git top-level from: $projectRoot"
}
$gitTopLevel = $gitTopLevel.Trim()

$hooksPathRelative = (Get-RelativePath -BasePath $gitTopLevel -TargetPath $hooksDir).Replace("\", "/")
$guardPathRelative = (Get-RelativePath -BasePath $gitTopLevel -TargetPath $guardScriptPath).Replace("\", "/")
$enforcementPathRelative = (Get-RelativePath -BasePath $gitTopLevel -TargetPath $enforcementScriptPath).Replace("\", "/")
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
$prePushTemplate = @"
#!/usr/bin/env bash
set -euo pipefail

if [ "${SKIP_PG_ENFORCEMENT:-0}" = "1" ]; then
  echo "[pre-push] skipped via SKIP_PG_ENFORCEMENT=1"
  exit 0
fi

repo_root="$(git rev-parse --show-toplevel)"
if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoProfile -ExecutionPolicy Bypass -File "$repo_root/__ENFORCEMENT_PATH__" -Phase pre-push
elif command -v powershell >/dev/null 2>&1; then
  powershell -ExecutionPolicy Bypass -File "$repo_root/__ENFORCEMENT_PATH__" -Phase pre-push
else
  echo "[pre-push] PowerShell is required for enforcement trigger."
  exit 1
fi
"@
$prePushContent = $prePushTemplate.Replace("__ENFORCEMENT_PATH__", $enforcementPathRelative)

Write-HookFile -Path $preCommitPath -Content $hookContent -Label "pre-commit" -ForceRewrite $Force.IsPresent
Write-HookFile -Path $prePushPath -Content $prePushContent -Label "pre-push" -ForceRewrite $Force.IsPresent

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
