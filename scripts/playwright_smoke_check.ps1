param(
    [string]$WorkingDirectory = "",
    [string]$ConfigPath = "",
    [string]$SmokeTag = "@smoke",
    [ValidateSet("minimal", "desktop", "full")]
    [string]$BrowserMatrix = "minimal",
    [ValidateSet("auto", "smoke", "full")]
    [string]$RunMode = "auto",
    [switch]$InstallBrowsers
)

$ErrorActionPreference = "Stop"
function RepoRoot { (Resolve-Path (Join-Path $PSScriptRoot "..")).Path }
function Rel([string]$p) {
    if ([string]::IsNullOrWhiteSpace($p) -or -not (Test-Path -LiteralPath $p)) { return "" }
    $root = RepoRoot
    $resolved = (Resolve-Path -LiteralPath $p).Path
    if ($resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { return $resolved.Substring($root.Length).TrimStart("\\") -replace "\\", "/" }
    return $resolved
}
function ResolveWd([string]$p) {
    if ([string]::IsNullOrWhiteSpace($p)) { return RepoRoot }
    $candidate = if ([IO.Path]::IsPathRooted($p)) { $p } else { Join-Path (RepoRoot) $p }
    if (-not (Test-Path -LiteralPath $candidate)) { throw "WorkingDirectory not found: $candidate" }
    (Resolve-Path -LiteralPath $candidate).Path
}
function ResolveConfig([string]$base, [string]$requested) {
    $candidates = if ([string]::IsNullOrWhiteSpace($requested)) {
        @("playwright.config.ts", "playwright.config.js", "playwright.config.mjs", "playwright.config.cjs") | ForEach-Object { Join-Path $base $_ }
    } else {
        @($(if ([IO.Path]::IsPathRooted($requested)) { $requested } else { Join-Path $base $requested }))
    }
    foreach ($candidate in $candidates) { if (Test-Path -LiteralPath $candidate) { return (Resolve-Path -LiteralPath $candidate).Path } }
    ""
}
function HasPwDep([string]$base) {
    $manifestPath = Join-Path $base "package.json"
    if (-not (Test-Path -LiteralPath $manifestPath)) { return $false }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json -Depth 20
    foreach ($sectionName in @("dependencies", "devDependencies")) {
        $section = $manifest.$sectionName
        if ($section -and ($section.PSObject.Properties.Name -contains "@playwright/test")) { return $true }
    }
    $false
}
function GetTests([string]$base) {
    $patterns = @("*.spec.ts","*.spec.tsx","*.spec.js","*.spec.jsx","*.test.ts","*.test.tsx","*.test.js","*.test.jsx")
    $all = foreach ($pattern in $patterns) { Get-ChildItem -LiteralPath $base -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue }
    $all | Where-Object {
        $lower = $_.FullName.ToLowerInvariant()
        $lower -notmatch '\\node_modules\\|\\dist\\|\\build\\|\\out\\|\\coverage\\|\\memory-bank\\|\\.git\\'
    } | Sort-Object -Property FullName -Unique
}
function HasTag($files, [string]$tag) {
    foreach ($file in $files) { if (Select-String -LiteralPath $file.FullName -Pattern ([regex]::Escape($tag)) -Quiet) { return $true } }
    $false
}
function InstallList([string]$matrix) { if ($matrix -eq "minimal") { @("chromium") } else { @("chromium","firefox","webkit") } }
function StripAnsi([string]$text) { if ([string]::IsNullOrWhiteSpace($text)) { return "" } return ([regex]::Replace($text, "`e\[[0-9;]*m", "")).Trim() }
function ShortMessage([string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return "" }
    $clean = StripAnsi $text
    $lines = @($clean -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 12)
    return (($lines -join "`n").Trim())
}
function Failures([string]$jsonPath) {
    $collected = New-Object System.Collections.Generic.List[object]
    if (-not (Test-Path -LiteralPath $jsonPath)) { return @() }
    try {
        $report = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json -Depth 50
    } catch {
        return @()
    }
    function Add-SuiteFailures {
        param([object]$Suite, [string[]]$Parents)
        $nextParents = @($Parents)
        if ($Suite.title) { $nextParents += [string]$Suite.title }
        foreach ($spec in @($Suite.specs)) {
            $specParts = @($nextParents)
            if ($spec.title) { $specParts += [string]$spec.title }
            foreach ($test in @($spec.tests)) {
                foreach ($result in @($test.results)) {
                    if ($result.status -in @("passed", "skipped")) { continue }
                    $errorObject = @($result.errors | Select-Object -First 1)
                    $firstError = if ($errorObject.Count -gt 0) { $errorObject[0] } else { $null }
                    $location = if ($firstError -and $firstError.location) { $firstError.location } else { $null }
                    $attachments = @(foreach ($attachment in @($result.attachments)) { [pscustomobject][ordered]@{ name = [string]$attachment.name; content_type = [string]$attachment.contentType; path = (Rel ([string]$attachment.path)) } })
                    $collected.Add([pscustomobject][ordered]@{
                        title = [string]$spec.title
                        full_title = (@($specParts) -join " > ")
                        project_name = [string]$test.projectName
                        status = [string]$result.status
                        duration_ms = [int]$result.duration
                        file = $(if ($location -and $location.file) { Rel ([string]$location.file) } elseif ($spec.file) { [string]$spec.file } else { "" })
                        line = $(if ($location -and $location.line) { [int]$location.line } elseif ($spec.line) { [int]$spec.line } else { 0 })
                        column = $(if ($location -and $location.column) { [int]$location.column } elseif ($spec.column) { [int]$spec.column } else { 0 })
                        error_summary = $(if ($firstError -and $firstError.message) { ShortMessage ([string]$firstError.message) } else { "Playwright result reported a non-passing status without an error message." })
                        attachments = $attachments
                    }) | Out-Null
                }
            }
        }
        foreach ($child in @($Suite.suites)) { Add-SuiteFailures -Suite $child -Parents $nextParents }
    }
    foreach ($suite in @($report.suites)) { Add-SuiteFailures -Suite $suite -Parents @() }
    return @($collected)
}
function WriteFailureMarkdown([string]$path, $failures, [string]$matrix, [string]$requestedMode, [string]$effectiveMode) {
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("# Playwright Failure List") | Out-Null
    $lines.Add("") | Out-Null
    $lines.Add(("- Generated: {0}" -f (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"))) | Out-Null
    $lines.Add(("- Browser matrix: {0}" -f $matrix)) | Out-Null
    $lines.Add(("- Requested run mode: {0}" -f $requestedMode)) | Out-Null
    $lines.Add(("- Effective run mode: {0}" -f $effectiveMode)) | Out-Null
    $lines.Add(("- Failure count: {0}" -f @($failures).Count)) | Out-Null
    $lines.Add("") | Out-Null
    if (@($failures).Count -eq 0) {
        $lines.Add("No non-passing Playwright tests were recorded in this run.") | Out-Null
    } else {
        $index = 1
        foreach ($failure in @($failures)) {
            $lines.Add("## " + $index + ". " + $failure.full_title) | Out-Null
            $lines.Add("- Project: " + $failure.project_name) | Out-Null
            $lines.Add("- Status: " + $failure.status) | Out-Null
            if ($failure.file) {
                $lines.Add("- Location: " + $failure.file + ":" + $failure.line + ":" + $failure.column) | Out-Null
            }
            if ($failure.error_summary) {
                $lines.Add("- Error:") | Out-Null
                $lines.Add('```text') | Out-Null
                $lines.Add($failure.error_summary) | Out-Null
                $lines.Add('```') | Out-Null
            }
            foreach ($attachment in @($failure.attachments)) {
                $attachmentLabel = [string]$attachment.name
                $attachmentPath = [string]$attachment.path
                $attachmentLine = "- " + $attachmentLabel + " => " + $attachmentPath
                $lines.Add($attachmentLine) | Out-Null
            }
            $lines.Add("") | Out-Null
            $index += 1
        }
    }
    Set-Content -LiteralPath $path -Value ($lines -join "`r`n") -Encoding utf8
}
function Stats([string]$jsonPath) {
    $stats = [ordered]@{ expected = 0; unexpected = 0; flaky = 0; skipped = 0; duration_ms = 0; total = 0 }
    if (-not (Test-Path -LiteralPath $jsonPath)) { return $stats }
    try {
        $report = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json -Depth 30
        if ($report.stats) {
            foreach ($name in @("expected","unexpected","flaky","skipped")) { if ($report.stats.PSObject.Properties.Name -contains $name) { $stats[$name] = [int]$report.stats.$name } }
            if ($report.stats.PSObject.Properties.Name -contains "duration") { $stats.duration_ms = [int]$report.stats.duration }
        }
    } catch {}
    $stats.total = [int]$stats.expected + [int]$stats.unexpected + [int]$stats.flaky + [int]$stats.skipped
    $stats
}
function SummaryPath {
    $dir = Join-Path (RepoRoot) "Memory-bank\_generated\playwright-smoke"
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Join-Path $dir "playwright-smoke-latest.json"
}
function RemoveRunDirectories([string]$artifactRoot) {
    if (-not (Test-Path -LiteralPath $artifactRoot)) { return }
    Get-ChildItem -LiteralPath $artifactRoot -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
}
function Emit([hashtable]$payload) {
    ($payload | ConvertTo-Json -Depth 20) | Set-Content -LiteralPath (SummaryPath) -Encoding utf8
    Write-Host ("- playwright_summary: {0}" -f (Rel (SummaryPath)))
    if ($payload.html_report_path) { Write-Host ("- playwright_html_report: {0}" -f $payload.html_report_path) }
    if ($payload.json_report_path) { Write-Host ("- playwright_json_report: {0}" -f $payload.json_report_path) }
    if ($payload.results_directory) { Write-Host ("- playwright_results_dir: {0}" -f $payload.results_directory) }
    if ($payload.failures_markdown_path) { Write-Host ("- playwright_failure_list: {0}" -f $payload.failures_markdown_path) }
    Write-Host ("PG_PLAYWRIGHT_SMOKE_JSON:{0}" -f ($payload | ConvertTo-Json -Compress -Depth 20))
}

$wd = ResolveWd $WorkingDirectory
$config = ResolveConfig $wd $ConfigPath
$artifactRoot = Join-Path (RepoRoot) "Memory-bank\_generated\playwright-smoke"
if (-not (Test-Path -LiteralPath $artifactRoot)) { New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null }
RemoveRunDirectories $artifactRoot
$runDir = Join-Path $artifactRoot ((Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ"))
New-Item -ItemType Directory -Path $runDir -Force | Out-Null
$reportDir = Join-Path $runDir "html-report"
$resultsDir = Join-Path $runDir "test-results"
$jsonPath = Join-Path $runDir "report.json"
$failuresJsonPath = Join-Path $runDir "failures.json"
$failuresMarkdownPath = Join-Path $runDir "failures.md"
$basePayload = @{ generated_at_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"); repo_root = RepoRoot; working_directory = $wd; config_path = $config; browser_matrix = $BrowserMatrix; requested_run_mode = $RunMode; run_directory = (Rel $runDir); html_report_path = (Rel $reportDir); json_report_path = (Rel $jsonPath); results_directory = (Rel $resultsDir); failures_json_path = (Rel $failuresJsonPath); failures_markdown_path = (Rel $failuresMarkdownPath); failure_count = 0; failures = @(); auto_installed_browsers = $false; run_mode = "not-run"; stats = [ordered]@{ expected = 0; unexpected = 0; flaky = 0; skipped = 0; duration_ms = 0; total = 0 } }

if ([string]::IsNullOrWhiteSpace($config)) { $payload = $basePayload.Clone(); $payload.status = "blocked"; Emit $payload; Write-Host "Playwright smoke check blocked: playwright config not found."; exit 2 }
if (-not (HasPwDep $wd)) { $payload = $basePayload.Clone(); $payload.status = "blocked"; Emit $payload; Write-Host "Playwright smoke check blocked: '@playwright/test' is not declared in package.json."; exit 2 }
$tests = @(GetTests $wd)
if ($tests.Count -eq 0) { $payload = $basePayload.Clone(); $payload.status = "blocked"; Emit $payload; Write-Host "Playwright smoke check blocked: no playwright test files were found."; exit 2 }
$npx = Get-Command "npx" -ErrorAction SilentlyContinue
if ($null -eq $npx) { $payload = $basePayload.Clone(); $payload.status = "blocked"; Emit $payload; Write-Host "Playwright smoke check blocked: 'npx' was not found in PATH."; exit 2 }
$hasSmokeTag = HasTag $tests $SmokeTag
$runSmokeOnly = if ($RunMode -eq "smoke") { $true } elseif ($RunMode -eq "full") { $false } else { $hasSmokeTag }
$basePayload.run_mode = if ($runSmokeOnly) { "smoke-tagged" } else { "full-suite" }
$prevMatrix = $env:PG_SMOKE_BROWSER_MATRIX; $prevReport = $env:PG_SMOKE_REPORT_DIR; $prevResults = $env:PG_SMOKE_RESULTS_DIR; $prevJson = $env:PG_SMOKE_JSON_REPORT_PATH
$prevTraceMode = $env:PG_PLAYWRIGHT_TRACE_MODE; $prevScreenshotMode = $env:PG_PLAYWRIGHT_SCREENSHOT_MODE; $prevVideoMode = $env:PG_PLAYWRIGHT_VIDEO_MODE
$env:PG_SMOKE_BROWSER_MATRIX = $BrowserMatrix; $env:PG_SMOKE_REPORT_DIR = $reportDir; $env:PG_SMOKE_RESULTS_DIR = $resultsDir; $env:PG_SMOKE_JSON_REPORT_PATH = $jsonPath
$env:PG_PLAYWRIGHT_TRACE_MODE = "off"; $env:PG_PLAYWRIGHT_SCREENSHOT_MODE = "off"; $env:PG_PLAYWRIGHT_VIDEO_MODE = "off"
$installRequested = $InstallBrowsers.IsPresent
if ($installRequested) {
    Push-Location $wd
    try { & $npx.Source "playwright" "install" @(InstallList $BrowserMatrix) 2>&1 | Out-Host; if ($LASTEXITCODE -ne 0) { throw "install failed" } } finally { Pop-Location }
    $basePayload.auto_installed_browsers = $true
}
$runArgs = @("playwright","test","--config",$config,"--max-failures","1")
if ($runSmokeOnly) {
    $runArgs += @("--grep",$SmokeTag)
    Write-Host ("Playwright smoke check: running smoke-tagged tests ({0}) with matrix '{1}'." -f $SmokeTag, $BrowserMatrix)
} else {
    if ($RunMode -eq "full") {
        Write-Host ("Playwright smoke check: full suite requested; running the entire Playwright suite with matrix '{0}'." -f $BrowserMatrix)
    } else {
        Write-Host ("Playwright smoke check: no '{0}' tag found, running full Playwright test suite with matrix '{1}'." -f $SmokeTag, $BrowserMatrix)
    }
}
Push-Location $wd
try {
    $runOutput = & $npx.Source @runArgs 2>&1
    $exitCode = $LASTEXITCODE
    if ($runOutput) { $runOutput | Out-Host }
    $runText = ($runOutput | Out-String)
    if ($exitCode -ne 0 -and -not $installRequested -and ($runText -match "Executable doesn't exist" -or $runText -match "download new browsers" -or $runText -match "playwright install")) {
        & $npx.Source "playwright" "install" @(InstallList $BrowserMatrix) 2>&1 | Out-Host
        if ($LASTEXITCODE -eq 0) {
            $basePayload.auto_installed_browsers = $true
            $runOutput = & $npx.Source @runArgs 2>&1
            $exitCode = $LASTEXITCODE
            if ($runOutput) { $runOutput | Out-Host }
        }
    }
} finally {
    Pop-Location
    $env:PG_SMOKE_BROWSER_MATRIX = $prevMatrix; $env:PG_SMOKE_REPORT_DIR = $prevReport; $env:PG_SMOKE_RESULTS_DIR = $prevResults; $env:PG_SMOKE_JSON_REPORT_PATH = $prevJson
    $env:PG_PLAYWRIGHT_TRACE_MODE = $prevTraceMode; $env:PG_PLAYWRIGHT_SCREENSHOT_MODE = $prevScreenshotMode; $env:PG_PLAYWRIGHT_VIDEO_MODE = $prevVideoMode
}
$basePayload.run_directory = Rel $runDir
$basePayload.html_report_path = Rel $reportDir
$basePayload.json_report_path = Rel $jsonPath
$basePayload.results_directory = Rel $resultsDir
$basePayload.stats = Stats $jsonPath
$summaryScript = Join-Path $PSScriptRoot "playwright_report_summary.py"
if (-not (Test-Path -LiteralPath $summaryScript)) { throw "playwright_report_summary.py not found: $summaryScript" }
$summaryOutput = & python $summaryScript --report-json $jsonPath --repo-root (RepoRoot) --failures-json $failuresJsonPath --failures-markdown $failuresMarkdownPath --browser-matrix $BrowserMatrix --requested-run-mode $RunMode --effective-run-mode $basePayload.run_mode
if ($LASTEXITCODE -ne 0) { throw "playwright_report_summary.py failed." }
$failureSummary = if ([string]::IsNullOrWhiteSpace(($summaryOutput | Out-String))) { $null } else { ($summaryOutput | Out-String) | ConvertFrom-Json -Depth 20 }
$failures = if ($failureSummary -and $null -ne $failureSummary.failures) { @($failureSummary.failures) } else { @() }
$basePayload.failures_json_path = Rel $failuresJsonPath
$basePayload.failures_markdown_path = Rel $failuresMarkdownPath
$basePayload.failure_count = $failures.Count
$basePayload.failures = @($failures)
$basePayload.status = if ($exitCode -eq 0) { "pass" } else { "blocked" }
Emit $basePayload
if ($exitCode -ne 0) { Write-Host "Playwright smoke check blocked: Playwright tests failed."; exit 2 }
Write-Host "Playwright smoke check passed."
exit 0
