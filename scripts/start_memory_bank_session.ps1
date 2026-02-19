param(
    [ValidateRange(1, 1000)]
    [int]$MaxCommits = 5,
    [ValidateRange(1, 168)]
    [int]$MaxHours = 12,
    [string]$Author = "agent",
    [switch]$Yes,
    [switch]$SkipRefresh
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repoRoot
try {
    if (-not $SkipRefresh.IsPresent) {
        & python "scripts/build_frontend_summary.py"
        if ($LASTEXITCODE -ne 0) {
            throw "build_frontend_summary.py failed. Aborting session start."
        }

        & python "scripts/generate_memory_bank.py" "--profile" "frontend" "--keep-days" "7"
        if ($LASTEXITCODE -ne 0) {
            throw "generate_memory_bank.py failed. Aborting session start."
        }
    }

    $argsList = @(
        "scripts/start_memory_bank_session.py",
        "--profile", "frontend",
        "--max-commits", "$MaxCommits",
        "--max-hours", "$MaxHours",
        "--author", "$Author"
    )
    if ($Yes.IsPresent) {
        $argsList += "--ack-read"
    }

    & python @argsList
    if ($LASTEXITCODE -ne 0) {
        throw "start_memory_bank_session.py failed."
    }

    Write-Host "Session bootstrap complete."
    Write-Host "Mode: warn"
    Write-Host "Commit budget: $MaxCommits"
    Write-Host "Hour budget: $MaxHours"
}
finally {
    Pop-Location
}