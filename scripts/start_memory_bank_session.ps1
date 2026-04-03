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
    [string]$EnforcementMode = "strict",
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string]$StateFile = "",
    [switch]$SkipMapStructureGate,
    [switch]$SkipDevProfileNotice
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$agentsIntegrityScript = Join-Path $PSScriptRoot "agents_integrity.ps1"

function Get-CodeLikeFiles([string]$rootPath) {
    $exts = @(".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".java", ".kt", ".go", ".rs", ".cs", ".php", ".rb", ".swift", ".sql", ".graphql", ".gql", ".yaml", ".yml")
    $nameHints = @("schema.prisma", "Dockerfile", "docker-compose.yml", "docker-compose.yaml")
    $results = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)

    $gitLists = @(
        @("ls-files"),
        @("ls-files", "--others", "--exclude-standard")
    )
    foreach ($gitCmd in $gitLists) {
        $output = & git -C $rootPath @gitCmd 2>$null
        if ($LASTEXITCODE -ne 0) {
            continue
        }
        foreach ($line in ($output -split "`r?`n")) {
            $rel = $line.Trim()
            if (-not $rel) {
                continue
            }
            $normalized = $rel.Replace("/", "\")
            if ($normalized.StartsWith("Memory-bank\") -or $normalized.StartsWith(".git\") -or $normalized.StartsWith("node_modules\") -or $normalized.StartsWith("dist\") -or $normalized.StartsWith("build\") -or $normalized.StartsWith("coverage\") -or $normalized.StartsWith("target\") -or $normalized.StartsWith(".next\") -or $normalized.StartsWith(".venv\") -or $normalized.StartsWith("venv\")) {
                continue
            }
            $abs = Join-Path $rootPath $rel
            if (-not (Test-Path -LiteralPath $abs)) {
                continue
            }
            $item = Get-Item -LiteralPath $abs -ErrorAction SilentlyContinue
            if ($null -eq $item -or $item.PSIsContainer) {
                continue
            }
            $ext = [System.IO.Path]::GetExtension($item.Name).ToLowerInvariant()
            if ($exts -contains $ext -or $nameHints -contains $item.Name) {
                $null = $results.Add($item.FullName)
            }
        }
    }
    return @($results)
}

function Parse-MapGeneratedAtUtc([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $null
    }
    try {
        $parsed = [DateTime]::ParseExact($value.Trim(), "yyyy-MM-dd HH:mm", [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AssumeUniversal)
        return $parsed.ToUniversalTime()
    }
    catch {
        return $null
    }
}

function Get-MapStructureGateState([string]$rootPath) {
    $summaryPath = Join-Path $rootPath "Memory-bank\_generated\map-structure-latest.json"
    $dbSchemaPath = Join-Path $rootPath "Memory-bank\db-schema\auto-discovered-schema.md"
    $autoTreeFiles = @()
    $codeTreeDir = Join-Path $rootPath "Memory-bank\code-tree"
    if (Test-Path -LiteralPath $codeTreeDir) {
        $autoTreeFiles = @(Get-ChildItem -LiteralPath $codeTreeDir -Filter "auto-*-tree.md" -File -ErrorAction SilentlyContinue)
    }

    $codeFiles = Get-CodeLikeFiles -rootPath $rootPath
    $codeFileCount = $codeFiles.Count
    $looksLikeLegacy = $codeFileCount -ge 25

    $latestInputUtc = $null
    foreach ($filePath in $codeFiles) {
        $item = Get-Item -LiteralPath $filePath -ErrorAction SilentlyContinue
        if ($null -eq $item) {
            continue
        }
        if ($null -eq $latestInputUtc -or $item.LastWriteTimeUtc -gt $latestInputUtc) {
            $latestInputUtc = $item.LastWriteTimeUtc
        }
    }

    $summaryExists = Test-Path -LiteralPath $summaryPath
    $summaryGeneratedAtUtc = $null
    if ($summaryExists) {
        try {
            $payload = Get-Content -LiteralPath $summaryPath -Raw | ConvertFrom-Json
            if ($payload -and $payload.generated_at_utc) {
                $summaryGeneratedAtUtc = Parse-MapGeneratedAtUtc -value ([string]$payload.generated_at_utc)
            }
        }
        catch {
            $summaryGeneratedAtUtc = $null
        }
    }

    $summaryMtimeUtc = if ($summaryExists) { (Get-Item -LiteralPath $summaryPath).LastWriteTimeUtc } else { $null }
    $effectiveSummaryUtc = if ($summaryGeneratedAtUtc) { $summaryGeneratedAtUtc } else { $summaryMtimeUtc }
    $missing = (-not $summaryExists) -or (-not (Test-Path -LiteralPath $dbSchemaPath)) -or ($autoTreeFiles.Count -lt 1)

    $stale = $false
    if (-not $missing -and $latestInputUtc -and $effectiveSummaryUtc) {
        $delta = ($latestInputUtc - $effectiveSummaryUtc).TotalSeconds
        if ($delta -gt 120) {
            $stale = $true
        }
    }

    return @{
        looks_like_legacy = $looksLikeLegacy
        code_file_count = $codeFileCount
        missing = $missing
        stale = $stale
        summary_path = $summaryPath
    }
}

function Invoke-MapStructureRefresh([string]$rootPath) {
    Write-Host "Map-structure gate: refreshing auto map files..."
    $args = @(
        "scripts/map_structure.py",
        "--profile", "auto",
        "--max-depth", "4",
        "--max-entries", "1400",
        "--max-components", "12"
    )
    & python @args
    if ($LASTEXITCODE -ne 0) {
        throw "Map-structure auto-refresh failed. Run .\pg.ps1 map-structure manually and then re-run session start."
    }
}

Push-Location $repoRoot
try {
    if (Test-Path -LiteralPath $agentsIntegrityScript) {
        try {
            & $agentsIntegrityScript -Action verify -Repair -Quiet | Out-Null
        }
        catch {
            throw "AGENTS.md integrity verification failed. Review AGENTS.md and reseal it only if the change was intentional."
        }
    }

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

    if (-not $SkipMapStructureGate.IsPresent) {
        $mapGate = Get-MapStructureGateState -rootPath $repoRoot
        if ($mapGate.looks_like_legacy -and ($mapGate.missing -or $mapGate.stale)) {
            $reason = if ($mapGate.missing) { "missing auto map files" } else { "auto map files are stale vs current source tree" }
            Write-Host "Map-structure gate detected: $reason. Auto-refreshing before continuing..."
            Invoke-MapStructureRefresh -rootPath $repoRoot

            $mapGate = Get-MapStructureGateState -rootPath $repoRoot
            if ($mapGate.looks_like_legacy -and ($mapGate.missing -or $mapGate.stale)) {
                $message = @(
                    "Map-structure gate remains unresolved after auto-refresh.",
                    "This repo looks like an existing/legacy project ($($mapGate.code_file_count) source/config artifacts detected).",
                    "Run now from project root:",
                    "  .\pg.ps1 map-structure",
                    "Then re-run session start.",
                    "Use -SkipMapStructureGate only for emergency bypass."
                ) -join [Environment]::NewLine

                if ($EnforcementMode -eq "strict") {
                    throw $message
                }
                Write-Warning $message
            }
        }
    } else {
        Write-Warning "Map-structure gate bypassed by -SkipMapStructureGate."
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
            MaxFiles = 120
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
    if ((-not $SkipDevProfileNotice.IsPresent) -and (Test-Path -LiteralPath $devProfileScript)) {
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
