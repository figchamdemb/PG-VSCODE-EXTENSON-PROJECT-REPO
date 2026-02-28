param(
    [ValidateRange(1, 1000)]
    [int]$MaxCommits = 5,
    [ValidateRange(1, 168)]
    [int]$MaxHours = 12,
    [string]$Author = "agent",
    [switch]$Yes,
    [switch]$SkipRefresh,
    [switch]$SkipEnforcement,
    [ValidateSet("warn", "strict")]
    [string]$EnforcementMode = "warn",
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string]$StateFile = ""
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
    Write-Host "Mode: $EnforcementMode"
    Write-Host "Commit budget: $MaxCommits"
    Write-Host "Hour budget: $MaxHours"

    if (-not $SkipEnforcement.IsPresent) {
        Write-Host "Running start-session enforcement trigger..."
        $triggerArgs = @{
            Phase = "start-session"
            ApiBase = $ApiBase
            ProjectFramework = "unknown"
            AccessToken = $AccessToken
            StateFile = $StateFile
        }
        if ($EnforcementMode -eq "warn") {
            $triggerArgs["WarnOnly"] = $true
        }
        & (Join-Path $PSScriptRoot "enforcement_trigger.ps1") @triggerArgs
        if ($LASTEXITCODE -ne 0) {
            throw "Start-session enforcement trigger failed with exit code $LASTEXITCODE."
        }
    } else {
        Write-Host "Start-session enforcement trigger skipped."
    }

    $devProfileScript = Join-Path $PSScriptRoot "dev_profile.ps1"
    if (Test-Path -LiteralPath $devProfileScript) {
        try {
            $devProfileCheck = & $devProfileScript -Action check -Quiet
            if ($devProfileCheck -and ($devProfileCheck.ok -eq $false)) {
                Write-Warning "Local dev profile is missing required fields. This can cause agent/test loops."
                if ($devProfileCheck.missing) {
                    Write-Host "Missing:"
                    foreach ($entry in $devProfileCheck.missing) {
                        Write-Host ("  - {0}" -f [string]$entry)
                    }
                }
                Write-Host "Run:"
                Write-Host "  .\pg.ps1 dev-profile -DevProfileAction init"
                Write-Host "  .\pg.ps1 dev-profile -DevProfileAction check"
                Write-Host "Policy:"
                Write-Host "  dev-profile is local dev/test only; production credentials stay in .env/vault."
            }
        } catch {
            Write-Warning ("Dev profile check failed: {0}" -f $_.Exception.Message)
        }
    }
}
finally {
    Pop-Location
}
