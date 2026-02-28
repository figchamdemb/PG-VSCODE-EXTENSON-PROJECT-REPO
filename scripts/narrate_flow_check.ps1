param(
    [switch]$SkipCompile,
    [switch]$Json
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Ensure-Text([object]$value, [string]$fallback = "") {
    if ($null -eq $value) {
        return $fallback
    }
    return [string]$value
}

function Add-Result(
    [System.Collections.Generic.List[object]]$results,
    [string]$step,
    [bool]$ok,
    [string]$details
) {
    $results.Add([pscustomobject]@{
            step = $step
            ok = $ok
            details = $details
        })
}

function Resolve-ReportPath {
    return Join-Path (Get-RepoRoot) "Memory-bank\_generated\narrate-flow-check-latest.md"
}

function Write-MarkdownReport(
    [string]$path,
    [System.Collections.Generic.List[object]]$results
) {
    $passCount = @($results | Where-Object { $_.ok }).Count
    $failCount = @($results | Where-Object { -not $_.ok }).Count
    $lines = @()
    $lines += "# Narrate Flow Check"
    $lines += ""
    $lines += "UTC: $([DateTime]::UtcNow.ToString('o'))"
    $lines += ""
    $lines += "- PASS: $passCount"
    $lines += "- FAIL: $failCount"
    $lines += ""

    foreach ($result in $results) {
        $status = if ($result.ok) { "PASS" } else { "FAIL" }
        $lines += "## $status - $($result.step)"
        $lines += ""
        $lines += '```text'
        $lines += (Ensure-Text $result.details "(no details)")
        $lines += '```'
        $lines += ""
    }

    $dir = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
    }
    Set-Content -LiteralPath $path -Value ($lines -join "`n") -Encoding UTF8
}

$repoRoot = Get-RepoRoot
$extensionDir = Join-Path $repoRoot "extension"
$packageJsonPath = Join-Path $extensionDir "package.json"
$extensionTsPath = Join-Path $extensionDir "src\extension.ts"
$reportPath = Resolve-ReportPath
$results = New-Object System.Collections.Generic.List[object]

$requiredCommandIds = @(
    "narrate.toggleReadingModeDev",
    "narrate.toggleReadingModeEdu",
    "narrate.requestChangePrompt",
    "narrate.exportNarrationFile",
    "narrate.exportNarrationWorkspace",
    "narrate.generateChangeReport"
)

# Step 1: package command entries
try {
    if (-not (Test-Path -LiteralPath $packageJsonPath)) {
        throw "Missing package.json: $packageJsonPath"
    }
    $pkg = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
    $declared = @($pkg.contributes.commands | ForEach-Object { [string]$_.command })
    $activation = @($pkg.activationEvents | ForEach-Object { [string]$_ })
    $missingDeclared = @($requiredCommandIds | Where-Object { $_ -notin $declared })
    $missingActivation = @($requiredCommandIds | Where-Object { ("onCommand:" + $_) -notin $activation })
    if ($missingDeclared.Count -gt 0 -or $missingActivation.Count -gt 0) {
        $details = @(
            "Missing command declarations: " + ($(if ($missingDeclared.Count -gt 0) { ($missingDeclared -join ", ") } else { "(none)" })),
            "Missing activation events: " + ($(if ($missingActivation.Count -gt 0) { ($missingActivation -join ", ") } else { "(none)" }))
        ) -join "`n"
        Add-Result -results $results -step "Package command wiring" -ok $false -details $details
    } else {
        Add-Result -results $results -step "Package command wiring" -ok $true -details ("All required command IDs declared + activated: " + ($requiredCommandIds -join ", "))
    }
} catch {
    Add-Result -results $results -step "Package command wiring" -ok $false -details $_.Exception.Message
}

# Step 2: extension command registration
try {
    if (-not (Test-Path -LiteralPath $extensionTsPath)) {
        throw "Missing extension entry: $extensionTsPath"
    }
    $entry = Get-Content -LiteralPath $extensionTsPath -Raw
    $requiredMarkers = @(
        "narrate.toggleReadingModeDev",
        "narrate.toggleReadingModeEdu",
        "registerRequestChangePromptCommand(",
        "registerExportNarrationFileCommand(",
        "registerExportNarrationWorkspaceCommand(",
        "registerGenerateChangeReportCommand("
    )
    $missingRegistration = @($requiredMarkers | Where-Object { $entry -notmatch [regex]::Escape($_) })
    if ($entry -notmatch [regex]::Escape('registerTextDocumentContentProvider("narrate", schemeProvider)')) {
        $missingRegistration += 'registerTextDocumentContentProvider("narrate", schemeProvider)'
    }
    if ($missingRegistration.Count -gt 0) {
        Add-Result -results $results -step "Extension runtime registration" -ok $false -details ("Missing in extension.ts: " + ($missingRegistration -join ", "))
    } else {
        Add-Result -results $results -step "Extension runtime registration" -ok $true -details "Command registrations and narrate:// provider registration found."
    }
} catch {
    Add-Result -results $results -step "Extension runtime registration" -ok $false -details $_.Exception.Message
}

# Step 3: command implementation files
try {
    $requiredFiles = @(
        "src\commands\toggleReadingMode.ts",
        "src\commands\requestChangePrompt.ts",
        "src\commands\exportNarrationFile.ts",
        "src\commands\exportNarrationWorkspace.ts",
        "src\commands\generateChangeReport.ts",
        "src\readingView\renderNarration.ts",
        "src\narration\narrationEngine.ts"
    ) | ForEach-Object { Join-Path $extensionDir $_ }

    $missingFiles = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath $_) })
    if ($missingFiles.Count -gt 0) {
        Add-Result -results $results -step "Core flow source files" -ok $false -details ("Missing files:`n" + ($missingFiles -join "`n"))
    } else {
        Add-Result -results $results -step "Core flow source files" -ok $true -details "All core flow source files exist."
    }
} catch {
    Add-Result -results $results -step "Core flow source files" -ok $false -details $_.Exception.Message
}

# Step 4: compile extension
if ($SkipCompile.IsPresent) {
    Add-Result -results $results -step "Extension compile" -ok $true -details "Skipped by flag (-SkipCompile)."
} else {
    try {
        Push-Location $extensionDir
        $compileOutput = (& npm run compile 2>&1 | Out-String).Trim()
        $exitCode = $LASTEXITCODE
        Pop-Location
        if ($exitCode -ne 0) {
            Add-Result -results $results -step "Extension compile" -ok $false -details $compileOutput
        } else {
            Add-Result -results $results -step "Extension compile" -ok $true -details ($(if ([string]::IsNullOrWhiteSpace($compileOutput)) { "Compile passed." } else { $compileOutput }))
        }
    } catch {
        try { Pop-Location } catch {}
        Add-Result -results $results -step "Extension compile" -ok $false -details $_.Exception.Message
    }
}

$passCount = @($results | Where-Object { $_.ok }).Count
$failCount = @($results | Where-Object { -not $_.ok }).Count

$report = [pscustomobject]@{
    utc = [DateTime]::UtcNow.ToString("o")
    pass = $passCount
    fail = $failCount
    results = $results
    report_file = $reportPath
}

Write-MarkdownReport -path $reportPath -results $results

if ($Json.IsPresent) {
    $report | ConvertTo-Json -Depth 10
} else {
    Write-Host "Narrate flow check:"
    Write-Host ("- pass: {0}" -f $passCount)
    Write-Host ("- fail: {0}" -f $failCount)
    foreach ($item in $results) {
        $status = if ($item.ok) { "PASS" } else { "FAIL" }
        Write-Host ("[{0}] {1}" -f $status, $item.step)
    }
    Write-Host ("Report: {0}" -f $reportPath)
}

if ($failCount -gt 0) {
    exit 2
}
exit 0
