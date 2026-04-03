param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $PSScriptRoot "scripts\pg.ps1"

if (-not (Test-Path -LiteralPath $scriptPath)) {
    $currentDir = (Get-Location).Path
    $message = @"
PG command cannot run from this folder.
Missing command script: $scriptPath
Current folder: $currentDir

Use a project root that contains both:
- pg.ps1
- scripts\pg.ps1

PowerShell:
  Set-Location "C:\real\project\root"
  .\pg.ps1 help

CMD:
  cd /d "C:\real\project\root"
    pg.cmd help
"@
    throw $message
}

$pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
if ($pwsh) {
    & $pwsh.Source -NoProfile -ExecutionPolicy Bypass -File $scriptPath @Arguments
} else {
    & powershell -ExecutionPolicy Bypass -File $scriptPath @Arguments
}
exit $LASTEXITCODE
