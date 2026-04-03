param(
    [ValidateSet("warn", "strict")]
    [string]$Mode = "strict",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$hooksDir = Join-Path $projectRoot ".githooks"
$preCommitPath = Join-Path $hooksDir "pre-commit"
$prePushPath = Join-Path $hooksDir "pre-push"
$guardScriptPath = Join-Path $projectRoot "scripts/memory_bank_guard.py"
$enforcementScriptPath = Join-Path $projectRoot "scripts/enforcement_trigger.ps1"
$agentsIntegrityScriptPath = Join-Path $projectRoot "scripts/agents_integrity.ps1"

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

$secretsGuardPath = Join-Path $projectRoot "scripts/secrets_guard.py"
$secretsGuardPathRelative = (Get-RelativePath -BasePath $gitTopLevel -TargetPath $secretsGuardPath).Replace("\", "/")

$hookTemplate = @"
#!/usr/bin/env bash
set -euo pipefail

repo_root="`$(git rev-parse --show-toplevel)"

# --- 100% enforcement: secret-leak guard (always blocks, no bypass) ---
python "`$repo_root/__SECRETS_GUARD_PATH__"
secrets_exit=`$?
if [ `$secrets_exit -ne 0 ]; then
  echo "[pre-commit] BLOCKED by secrets-guard. Remove secrets before committing."
  exit 1
fi

# --- Memory-bank policy guard ---
python "`$repo_root/__GUARD_PATH__"
"@
$hookContent = $hookTemplate.Replace("__GUARD_PATH__", $guardPathRelative).Replace("__SECRETS_GUARD_PATH__", $secretsGuardPathRelative)
$prePushTemplate = @"
#!/usr/bin/env bash
set -euo pipefail

# --- 100% enforcement: secret-leak guard on push (always blocks, no bypass) ---
repo_root="`$(git rev-parse --show-toplevel)"
python "`$repo_root/__SECRETS_GUARD_PATH__"
secrets_exit=`$?
if [ `$secrets_exit -ne 0 ]; then
  echo "[pre-push] BLOCKED by secrets-guard. Remove secrets before pushing."
  exit 1
fi

if [ "`${SKIP_PG_ENFORCEMENT:-0}" = "1" ]; then
  echo "[pre-push] skipped via SKIP_PG_ENFORCEMENT=1"
  exit 0
fi

if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoProfile -ExecutionPolicy Bypass -File "`$repo_root/__ENFORCEMENT_PATH__" -Phase pre-push
elif command -v powershell >/dev/null 2>&1; then
  powershell -ExecutionPolicy Bypass -File "`$repo_root/__ENFORCEMENT_PATH__" -Phase pre-push
else
  echo "[pre-push] PowerShell is required for enforcement trigger."
  exit 1
fi
"@
$prePushContent = $prePushTemplate.Replace("__ENFORCEMENT_PATH__", $enforcementPathRelative).Replace("__SECRETS_GUARD_PATH__", $secretsGuardPathRelative)

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

if (Test-Path -LiteralPath $agentsIntegrityScriptPath) {
    try {
        & $agentsIntegrityScriptPath -Action seal -Quiet | Out-Null
    }
    catch {
        throw "Failed to seal AGENTS.md protection state."
    }
    Write-Host "Sealed AGENTS.md integrity state and enforced read-only protection."
}

Write-Host "Configured core.hooksPath=$hooksPathRelative"
Write-Host "Configured memorybank.mode=$Mode"
