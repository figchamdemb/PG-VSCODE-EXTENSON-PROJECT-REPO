param(
    [string]$Author = "agent",
    [string]$Note = "",
    [switch]$SkipRefresh,
    [switch]$KeepState
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repoRoot
try {
    if (-not $SkipRefresh.IsPresent) {
        & python "scripts/build_frontend_summary.py"
        if ($LASTEXITCODE -ne 0) {
            throw "build_frontend_summary.py failed. Aborting session end."
        }

        & python "scripts/generate_memory_bank.py" "--profile" "frontend" "--keep-days" "7"
        if ($LASTEXITCODE -ne 0) {
            throw "generate_memory_bank.py failed. Aborting session end."
        }
    }

    $argsList = @(
        "scripts/end_memory_bank_session.py",
        "--author", "$Author"
    )
    if ($Note -ne "") {
        $argsList += @("--note", "$Note")
    }
    if ($KeepState.IsPresent) {
        $argsList += "--keep-state"
    }

    & python @argsList
    if ($LASTEXITCODE -ne 0) {
        throw "end_memory_bank_session.py failed."
    }
}
finally {
    Pop-Location
}