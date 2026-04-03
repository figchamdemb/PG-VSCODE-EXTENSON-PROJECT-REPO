param(
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string[]]$ManifestPath = @(),
    [ValidateSet("npm")]
    [string]$PackageManager = "npm",
    [string]$ProjectFramework = "unknown",
    [string]$NodeVersion = "",
    [switch]$DependenciesOnly,
    [switch]$SkipRegistryFetch,
    [switch]$Json
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-MapEntries {
    param([object]$ObjectValue)
    if ($null -eq $ObjectValue) { return @() }
    if ($ObjectValue -is [hashtable]) {
        return $ObjectValue.GetEnumerator()
    }
    if ($ObjectValue -is [System.Management.Automation.PSCustomObject]) {
        return $ObjectValue.PSObject.Properties
    }
    return @()
}

function Resolve-Framework {
    param([array]$Candidates, [string]$Current)
    if ($Current -and $Current -ne "unknown") {
        return $Current
    }
    $names = @{}
    foreach ($candidate in $Candidates) {
        $names[$candidate.name] = $true
    }
    if ($names.ContainsKey("next")) { return "nextjs" }
    if ($names.ContainsKey("@nestjs/core")) { return "nestjs" }
    if ($names.ContainsKey("react")) { return "react" }
    return "unknown"
}

function Resolve-NodeVersion {
    param([object]$Manifest, [string]$Provided)
    if ($Provided) { return $Provided }
    $engines = $Manifest.engines
    if ($engines -and $engines.node) {
        return "$($engines.node)"
    }
    try {
        $nodeRaw = (& node -v).Trim()
        if ($nodeRaw) {
            return $nodeRaw.TrimStart("v")
        }
    }
    catch {
        return ""
    }
    return ""
}

function Add-ResolvedManifestPath {
    param(
        [System.Collections.Generic.List[string]]$Target,
        [string]$CandidatePath
    )
    if ([string]::IsNullOrWhiteSpace($CandidatePath)) {
        return
    }
    $resolved = (Resolve-Path -LiteralPath $CandidatePath).Path
    if (-not $Target.Contains($resolved)) {
        $Target.Add($resolved)
    }
}

function Resolve-ManifestPaths {
    param(
        [string[]]$Requested
    )
    $repoRoot = Get-RepoRoot
    $resolved = New-Object System.Collections.Generic.List[string]

    if ($Requested -and $Requested.Count -gt 0) {
        foreach ($item in $Requested) {
            if ([string]::IsNullOrWhiteSpace($item)) {
                continue
            }
            $rawCandidate = if ([System.IO.Path]::IsPathRooted($item)) {
                $item
            }
            else {
                Join-Path (Get-Location) $item
            }
            if (-not (Test-Path -LiteralPath $rawCandidate)) {
                continue
            }
            $candidate = $rawCandidate
            if (Test-Path -LiteralPath $candidate -PathType Container) {
                $candidate = Join-Path $candidate "package.json"
            }
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                Add-ResolvedManifestPath -Target $resolved -CandidatePath $candidate
            }
        }
        return $resolved
    }

    $defaultCandidates = New-Object System.Collections.Generic.List[string]
    $rootManifest = Join-Path $repoRoot "package.json"
    if (Test-Path -LiteralPath $rootManifest) {
        Add-ResolvedManifestPath -Target $defaultCandidates -CandidatePath $rootManifest
    }
    $serviceCandidates = @(
        (Join-Path $repoRoot "extension\package.json"),
        (Join-Path $repoRoot "server\package.json")
    )
    foreach ($candidate in $serviceCandidates) {
        if (Test-Path -LiteralPath $candidate) {
            Add-ResolvedManifestPath -Target $defaultCandidates -CandidatePath $candidate
        }
    }

    $topLevelDirectories = Get-ChildItem -LiteralPath $repoRoot -Directory -ErrorAction SilentlyContinue
    foreach ($directory in $topLevelDirectories) {
        $nameLower = $directory.Name.ToLowerInvariant()
        if ($nameLower -in @(".git", "node_modules", "memory-bank", "dist", "build", "out")) {
            continue
        }
        $candidate = Join-Path $directory.FullName "package.json"
        if (Test-Path -LiteralPath $candidate) {
            Add-ResolvedManifestPath -Target $defaultCandidates -CandidatePath $candidate
        }
    }
    return $defaultCandidates
}

function Build-DependencyCandidates {
    param(
        [object]$Manifest,
        [bool]$IncludeDevDependencies,
        [hashtable]$AuditSeverityMap
    )
    $candidates = New-Object System.Collections.Generic.List[object]
    foreach ($entry in (Get-MapEntries -ObjectValue $Manifest.dependencies)) {
        $name = "$($entry.Name)"
        $severity = Get-VulnerabilitySeverity -AuditSeverityMap $AuditSeverityMap -PackageName $name
        $candidates.Add(@{
                name = $name
                requested_version = "$($entry.Value)"
                group = "dependencies"
                vulnerability_max_severity = $severity
            })
    }
    if ($IncludeDevDependencies) {
        foreach ($entry in (Get-MapEntries -ObjectValue $Manifest.devDependencies)) {
            $name = "$($entry.Name)"
            $severity = Get-VulnerabilitySeverity -AuditSeverityMap $AuditSeverityMap -PackageName $name
            $candidates.Add(@{
                    name = $name
                    requested_version = "$($entry.Value)"
                    group = "devDependencies"
                    vulnerability_max_severity = $severity
                })
        }
    }
    return $candidates
}

function Get-SeverityRank {
    param([string]$Severity)
    $severityValue = if ($null -eq $Severity) { "" } else { [string]$Severity }
    switch ($severityValue.Trim().ToLowerInvariant()) {
        "critical" { return 4 }
        "high" { return 3 }
        "medium" { return 2 }
        "low" { return 1 }
        default { return 0 }
    }
}

function Merge-Severity {
    param(
        [string]$Current,
        [string]$Incoming
    )
    if ((Get-SeverityRank -Severity $Incoming) -gt (Get-SeverityRank -Severity $Current)) {
        return $Incoming
    }
    return $Current
}

function Normalize-Severity {
    param([string]$Severity)
    $severityValue = if ($null -eq $Severity) { "" } else { [string]$Severity }
    $normalized = $severityValue.Trim().ToLowerInvariant()
    if ($normalized -in @("critical", "high", "medium", "low")) {
        return $normalized
    }
    return ""
}

function Get-VulnerabilitySeverity {
    param(
        [hashtable]$AuditSeverityMap,
        [string]$PackageName
    )
    if ($null -eq $AuditSeverityMap -or [string]::IsNullOrWhiteSpace($PackageName)) {
        return $null
    }
    $key = $PackageName.ToLowerInvariant()
    if ($AuditSeverityMap.ContainsKey($key)) {
        return [string]$AuditSeverityMap[$key]
    }
    return $null
}

function Get-AuditSeverityMap {
    param(
        [string]$ManifestDirectory,
        [bool]$IncludeDevDependencies
    )
    $map = @{}
    $lockPath = Join-Path $ManifestDirectory "package-lock.json"
    if (-not (Test-Path -LiteralPath $lockPath -PathType Leaf)) {
        return $map
    }

    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($null -eq $npmCmd) {
        return $map
    }

    $auditArgs = @("audit", "--json", "--package-lock-only")
    if (-not $IncludeDevDependencies) {
        $auditArgs += "--omit=dev"
    }

    $auditRaw = ""
    try {
        Push-Location $ManifestDirectory
        $auditRaw = (& npm @auditArgs 2>$null) -join "`n"
    }
    catch {
        $auditRaw = ""
    }
    finally {
        Pop-Location
    }
    if ([string]::IsNullOrWhiteSpace($auditRaw)) {
        return $map
    }

    try {
        $audit = ConvertFrom-Json -InputObject $auditRaw -ErrorAction Stop
    }
    catch {
        return $map
    }

    if ($audit.vulnerabilities) {
        foreach ($property in $audit.vulnerabilities.PSObject.Properties) {
            $packageName = "$($property.Name)".Trim().ToLowerInvariant()
            if (-not $packageName) {
                continue
            }
            $entry = $property.Value
            $severity = Normalize-Severity -Severity ([string]$entry.severity)
            if (-not $severity) {
                continue
            }
            $map[$packageName] = Merge-Severity -Current ([string]$map[$packageName]) -Incoming $severity
        }
    }

    if ($audit.advisories) {
        foreach ($property in $audit.advisories.PSObject.Properties) {
            $advisory = $property.Value
            $packageName = "$($advisory.module_name)".Trim().ToLowerInvariant()
            if (-not $packageName) {
                continue
            }
            $severity = Normalize-Severity -Severity ([string]$advisory.severity)
            if (-not $severity) {
                continue
            }
            $map[$packageName] = Merge-Severity -Current ([string]$map[$packageName]) -Incoming $severity
        }
    }

    return $map
}

function Write-DependencyFindings {
    param(
        [object]$Response
    )
    if ($Response.blockers -and $Response.blockers.Count -gt 0) {
        Write-Host ""
        Write-Host "Blockers:"
        foreach ($item in $Response.blockers) {
            $pkg = if ($item.package_name) { $item.package_name } else { "-" }
            Write-Host "- [$($item.rule_id)] $pkg -> $($item.message)"
            Write-Host "  hint: $($item.hint)"
        }
    }
    if ($Response.warnings -and $Response.warnings.Count -gt 0) {
        Write-Host ""
        Write-Host "Warnings:"
        foreach ($item in $Response.warnings) {
            $pkg = if ($item.package_name) { $item.package_name } else { "-" }
            Write-Host "- [$($item.rule_id)] $pkg -> $($item.message)"
        }
    }
}

function Find-RequestedVersionForPackage {
    param(
        [array]$Candidates,
        [string]$PackageName
    )
    foreach ($candidate in $Candidates) {
        if ($candidate.name -eq $PackageName) {
            return [string]$candidate.requested_version
        }
    }
    return $null
}

function Get-DependencyReviewTargets {
    param(
        [object]$Response,
        [array]$Candidates
    )
    $targets = New-Object System.Collections.Generic.List[object]
    foreach ($item in @($Response.warnings)) {
        $ruleId = [string]$item.rule_id
        if ($ruleId -notlike "DEP-FRESHNESS-*" -and $ruleId -notlike "DEP-MAINT-*") {
            continue
        }
        $packageName = [string]$item.package_name
        if ([string]::IsNullOrWhiteSpace($packageName)) {
            continue
        }
        $targets.Add([ordered]@{
                package_name = $packageName
                requested_version = Find-RequestedVersionForPackage -Candidates $Candidates -PackageName $packageName
                warning_rule_id = $ruleId
                warning_message = [string]$item.message
            }) | Out-Null
    }
    return $targets.ToArray()
}

function Invoke-DependencyReview {
    param(
        [string]$ResolvedApiBase,
        [hashtable]$ResolvedHeaders,
        [array]$Targets
    )
    if (-not $Targets -or $Targets.Count -eq 0) {
        return $null
    }
    $body = @{
        package_manager = $PackageManager
        targets = $Targets
    }
    return Invoke-RestMethod `
        -Method Post `
        -Uri "$ResolvedApiBase/account/policy/dependency/review" `
        -Headers $ResolvedHeaders `
        -Body ($body | ConvertTo-Json -Depth 12)
}

function Write-DependencyReviewFindings {
    param(
        [object]$ReviewResponse
    )
    if (-not $ReviewResponse -or -not $ReviewResponse.results) {
        return
    }
    Write-Host ""
    Write-Host "Review guidance:"
    foreach ($item in @($ReviewResponse.results)) {
        Write-Host "- $($item.package_name) -> $($item.action) [$($item.status)]"
        Write-Host "  reason: $($item.summary_message)"
        $sourceUrls = @($item.official_sources | Select-Object -First 2 | ForEach-Object { $_.url })
        if ($sourceUrls.Count -gt 0) {
            Write-Host "  official_sources: $($sourceUrls -join ' | ')"
        }
    }
}

if (-not $AccessToken) {
    if ($env:PG_ACCESS_TOKEN) {
        $AccessToken = $env:PG_ACCESS_TOKEN
    }
}
if (-not $AccessToken) {
    throw "Missing AccessToken. Pass -AccessToken or set PG_ACCESS_TOKEN."
}

$manifestPaths = Resolve-ManifestPaths -Requested $ManifestPath
if (-not $manifestPaths -or $manifestPaths.Count -eq 0) {
    throw "Could not find package.json. Provide -ManifestPath explicitly."
}

$headers = @{
    Authorization = "Bearer $AccessToken"
    "Content-Type" = "application/json"
}

$checkedManifests = 0
$skippedManifests = 0
$totalDependencies = 0
$totalBlockers = 0
$totalWarnings = 0
$totalRegistryLookupFailures = 0
$hasBlockedManifest = $false
$manifestReports = New-Object System.Collections.Generic.List[object]

foreach ($currentManifestPath in $manifestPaths) {
    Write-Host ""
    Write-Host "Manifest: $currentManifestPath"

    $manifestRaw = Get-Content -LiteralPath $currentManifestPath -Raw
    $manifest = $manifestRaw | ConvertFrom-Json
    $manifestDirectory = Split-Path -Parent $currentManifestPath
    $auditSeverityMap = Get-AuditSeverityMap -ManifestDirectory $manifestDirectory -IncludeDevDependencies (-not $DependenciesOnly.IsPresent)
    if ($auditSeverityMap.Count -gt 0) {
        Write-Host "Local npm audit metadata loaded for $($auditSeverityMap.Count) package(s)."
    }
    $candidates = Build-DependencyCandidates `
        -Manifest $manifest `
        -IncludeDevDependencies (-not $DependenciesOnly.IsPresent) `
        -AuditSeverityMap $auditSeverityMap
    if (-not $candidates -or $candidates.Count -eq 0) {
        Write-Host "Dependency verification skipped: no dependencies found in manifest."
        $skippedManifests += 1
        continue
    }

    $resolvedFramework = Resolve-Framework -Candidates $candidates -Current $ProjectFramework
    $resolvedNodeVersion = Resolve-NodeVersion -Manifest $manifest -Provided $NodeVersion

    $body = @{
        package_manager = $PackageManager
        project_framework = $resolvedFramework
        runtime = @{
            node_version = $resolvedNodeVersion
        }
        options = @{
            skip_registry_fetch = $SkipRegistryFetch.IsPresent
        }
        dependencies = $candidates
    }

    $response = Invoke-RestMethod `
        -Method Post `
        -Uri "$ApiBase/account/policy/dependency/verify" `
        -Headers $headers `
        -Body ($body | ConvertTo-Json -Depth 12)
    $reviewTargets = Get-DependencyReviewTargets -Response $response -Candidates $candidates
    $reviewResponse = Invoke-DependencyReview -ResolvedApiBase $ApiBase -ResolvedHeaders $headers -Targets $reviewTargets

    $checkedManifests += 1
    $totalDependencies += [int]$response.summary.checked_dependencies
    $totalBlockers += [int]$response.summary.blockers
    $totalWarnings += [int]$response.summary.warnings
    $totalRegistryLookupFailures += [int]$response.summary.registry_lookup_failures
    if ($response.status -eq "blocked") {
        $hasBlockedManifest = $true
    }
    $manifestReports.Add([ordered]@{
            manifest_path = $currentManifestPath
            status = $response.status
            summary = $response.summary
            blockers = @($response.blockers)
            warnings = @($response.warnings)
            review_summary = if ($reviewResponse) { $reviewResponse.summary } else { $null }
            review_results = if ($reviewResponse) { $reviewResponse.results } else { @() }
        }) | Out-Null

    Write-Host "Dependency verification status: $($response.status)"
    Write-Host "Checked: $($response.summary.checked_dependencies) | blockers: $($response.summary.blockers) | warnings: $($response.summary.warnings)"
    Write-DependencyFindings -Response $response
    Write-DependencyReviewFindings -ReviewResponse $reviewResponse
}

if ($checkedManifests -eq 0) {
    throw "Dependency verification skipped all manifests because no dependencies were found."
}

Write-Host ""
$aggregateStatus = if ($hasBlockedManifest) { "blocked" } else { "pass" }
Write-Host "Dependency verification aggregate status: $aggregateStatus"
Write-Host "Manifests checked: $checkedManifests | skipped: $skippedManifests | dependencies checked: $totalDependencies | blockers: $totalBlockers | warnings: $totalWarnings | registry failures: $totalRegistryLookupFailures"

if ($Json.IsPresent) {
    $jsonPayload = [ordered]@{
        status = $aggregateStatus
        summary = [ordered]@{
            manifests_checked = $checkedManifests
            manifests_skipped = $skippedManifests
            checked_dependencies = $totalDependencies
            blockers = $totalBlockers
            warnings = $totalWarnings
            registry_lookup_failures = $totalRegistryLookupFailures
        }
        manifests = $manifestReports.ToArray()
    }
    Write-Output ("PG_DEPENDENCY_VERIFY_JSON:{0}" -f ($jsonPayload | ConvertTo-Json -Depth 20 -Compress))
}

if ($hasBlockedManifest) {
    exit 2
}
exit 0
