param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $PSScriptRoot "scripts\pg.ps1"

if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Missing command script: $scriptPath"
}

$pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
if ($pwsh) {
    & $pwsh.Source -NoProfile -ExecutionPolicy Bypass -File $scriptPath @Arguments
} else {
    & powershell -ExecutionPolicy Bypass -File $scriptPath @Arguments
}
exit $LASTEXITCODE
