param(
    [string]$ProjectRoot = "",
    [string]$WorkingDirectory = "",
    [int]$MaxRoutes = 12,
    [int]$MaxAccessibilityRoutes = 5
)

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $PSScriptRoot "playwright_author_suite.py"
if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "playwright_author_suite.py not found: $scriptPath"
}

$args = @($scriptPath)
if ($ProjectRoot) {
    $args += @("--project-root", $ProjectRoot)
}
if ($WorkingDirectory) {
    $args += @("--working-directory", $WorkingDirectory)
}
$args += @("--max-routes", [string]$MaxRoutes, "--max-accessibility-routes", [string]$MaxAccessibilityRoutes)

& python @args
exit $LASTEXITCODE
