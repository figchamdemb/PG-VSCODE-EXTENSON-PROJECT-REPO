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
    "narrate.generateChangeReport",
    "narrate.switchNarrationMode",
    "narrate.switchReadingViewMode",
    "narrate.switchReadingPaneMode",
    "narrate.switchReadingSnippetMode",
    "narrate.switchEduDetailLevel",
    "narrate.refreshReadingView",
    "narrate.runFlowInteractionCheck"
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
        "registerGenerateChangeReportCommand(",
        "registerSwitchNarrationModeCommand(",
        "registerSwitchReadingViewModeCommand(",
        "registerSwitchReadingPaneModeCommand(",
        "registerSwitchReadingSnippetModeCommand(",
        "registerSwitchEduDetailLevelCommand(",
        "registerRunFlowInteractionCheckCommand("
    )
    $missingRegistration = @($requiredMarkers | Where-Object { $entry -notmatch [regex]::Escape($_) })
    if ($entry -notmatch [regex]::Escape('registerTextDocumentContentProvider("narrate",')) {
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
        "src\commands\switchNarrationMode.ts",
        "src\commands\switchReadingViewMode.ts",
        "src\commands\switchReadingPaneMode.ts",
        "src\commands\switchReadingSnippetMode.ts",
        "src\commands\switchEduDetailLevel.ts",
        "src\commands\runFlowInteractionCheck.ts",
        "src\readingView\renderNarration.ts",
        "src\narration\narrationEngine.ts",
        "src\commands\modeState.ts",
        "src\readingView\narrateSchemeProvider.ts"
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

# Step 5: runtime interaction surface validation
try {
    $modeStatePath = Join-Path $extensionDir "src\commands\modeState.ts"
    $schemePath    = Join-Path $extensionDir "src\readingView\narrateSchemeProvider.ts"
    $renderPath    = Join-Path $extensionDir "src\readingView\renderNarration.ts"
    $interactionPath = Join-Path $extensionDir "src\commands\runFlowInteractionCheck.ts"

    $surfaceErrors = @()

    # 5a: modeState must export all getter/setter pairs
    if (Test-Path -LiteralPath $modeStatePath) {
        $modeContent = Get-Content -LiteralPath $modeStatePath -Raw
        $modeExports = @(
            "getCurrentMode", "setCurrentMode",
            "getCurrentReadingViewMode", "setCurrentReadingViewMode",
            "getCurrentReadingPaneMode", "setCurrentReadingPaneMode",
            "getCurrentReadingSnippetMode", "setCurrentReadingSnippetMode",
            "getCurrentEduDetailLevel", "setCurrentEduDetailLevel"
        )
        $missingMode = @($modeExports | Where-Object { $modeContent -notmatch ("export\s+(async\s+)?function\s+" + [regex]::Escape($_)) })
        if ($missingMode.Count -gt 0) {
            $surfaceErrors += "modeState missing exports: " + ($missingMode -join ", ")
        }
    } else {
        $surfaceErrors += "modeState.ts not found"
    }

    # 5b: NarrateSchemeProvider must have provideTextDocumentContent
    if (Test-Path -LiteralPath $schemePath) {
        $schemeContent = Get-Content -LiteralPath $schemePath -Raw
        if ($schemeContent -notmatch "provideTextDocumentContent") {
            $surfaceErrors += "NarrateSchemeProvider missing provideTextDocumentContent"
        }
    } else {
        $surfaceErrors += "narrateSchemeProvider.ts not found"
    }

    # 5c: renderNarration must export renderNarrationDocument
    if (Test-Path -LiteralPath $renderPath) {
        $renderContent = Get-Content -LiteralPath $renderPath -Raw
        if ($renderContent -notmatch "export\s+(async\s+)?function\s+renderNarrationDocument") {
            $surfaceErrors += "renderNarration missing renderNarrationDocument export"
        }
    } else {
        $surfaceErrors += "renderNarration.ts not found"
    }

    # 5d: runtime interaction check command must exercise all 9 checks
    if (Test-Path -LiteralPath $interactionPath) {
        $interactionContent = Get-Content -LiteralPath $interactionPath -Raw
        $expectedChecks = @(
            "checkModeStateRoundTrip",
            "checkViewModeRoundTrip",
            "checkPaneModeRoundTrip",
            "checkSnippetModeRoundTrip",
            "checkEduDetailLevelRoundTrip",
            "checkRenderPipeline",
            "checkSchemeProvider",
            "checkExportUtility",
            "checkToggleCommandRegistration"
        )
        $missingChecks = @($expectedChecks | Where-Object { $interactionContent -notmatch [regex]::Escape($_) })
        if ($missingChecks.Count -gt 0) {
            $surfaceErrors += "runFlowInteractionCheck missing checks: " + ($missingChecks -join ", ")
        }
    } else {
        $surfaceErrors += "runFlowInteractionCheck.ts not found"
    }

    if ($surfaceErrors.Count -gt 0) {
        Add-Result -results $results -step "Runtime interaction surface" -ok $false -details ($surfaceErrors -join "`n")
    } else {
        Add-Result -results $results -step "Runtime interaction surface" -ok $true -details "All mode state exports, scheme provider, render pipeline, and interaction checks validated."
    }
} catch {
    Add-Result -results $results -step "Runtime interaction surface" -ok $false -details $_.Exception.Message
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
