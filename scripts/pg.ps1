param(
    [Parameter(Position = 0)]
    [ValidateSet("install", "start", "end", "status", "governance-login", "governance-worker", "help")]
    [string]$Command = "help",

    [ValidateRange(1, 1000)]
    [int]$MaxCommits = 5,

    [ValidateRange(1, 168)]
    [int]$MaxHours = 12,

    [string]$Author = "agent",
    [string]$Note = "",
    [switch]$Yes,
    [switch]$SkipRefresh,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

$ErrorActionPreference = "Stop"

function Show-Help {
    Write-Host "pg command usage:"
    Write-Host "  .\pg.ps1 install backend"
    Write-Host "  .\pg.ps1 start -Yes"
    Write-Host "  .\pg.ps1 end -Note ""finished for today"""
    Write-Host "  .\pg.ps1 status"
    Write-Host "  .\pg.ps1 governance-login -Email user@company.com"
    Write-Host "  .\pg.ps1 governance-worker -Once"
    Write-Host "  .\pg.ps1 governance-worker -PollSeconds 15 -ApproveCommand "".\scripts\apply_approved_work.ps1"""
    Write-Host ""
    Write-Host "Note: install delegates to global CLI if available (~\.pg-cli\pg.ps1)."
}

$scriptDir = $PSScriptRoot

switch ($Command) {
    "install" {
        $globalPg = Join-Path $HOME ".pg-cli\pg.ps1"
        if (-not (Test-Path -LiteralPath $globalPg)) {
            throw "Install command requires global pg CLI. Run pg-install.ps1 once on this machine."
        }
        Write-Host "Delegating install to global pg CLI..."
        & powershell -ExecutionPolicy Bypass -File $globalPg "install" @Rest
        exit $LASTEXITCODE
    }
    "start" {
        $args = @{
            MaxCommits = $MaxCommits
            MaxHours = $MaxHours
            Author = $Author
            SkipRefresh = $SkipRefresh.IsPresent
        }
        if ($Yes.IsPresent) {
            $args["Yes"] = $true
        }
        & (Join-Path $scriptDir "start_memory_bank_session.ps1") @args
        exit $LASTEXITCODE
    }
    "end" {
        $args = @{
            Author = $Author
            Note = $Note
            SkipRefresh = $SkipRefresh.IsPresent
        }
        & (Join-Path $scriptDir "end_memory_bank_session.ps1") @args
        exit $LASTEXITCODE
    }
    "status" {
        & python (Join-Path $scriptDir "session_status.py")
        exit $LASTEXITCODE
    }
    "governance-login" {
        & (Join-Path $scriptDir "governance_login.ps1") @Rest
        exit $LASTEXITCODE
    }
    "governance-worker" {
        & (Join-Path $scriptDir "governance_worker.ps1") @Rest
        exit $LASTEXITCODE
    }
    default {
        Show-Help
        exit 0
    }
}
