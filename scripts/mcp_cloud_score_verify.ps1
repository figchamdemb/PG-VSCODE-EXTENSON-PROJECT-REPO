param(
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string]$StateFile = "",
    [string[]]$ManifestPath = @(),
    [string[]]$ScanPath = @(),
    [string]$ProjectFramework = "",
    [string]$NodeVersion = "",
    [ValidateRange(1, 2000)]
    [int]$MaxFiles = 400,
    [ValidateRange(1000, 2000000)]
    [int]$MaxFileBytes = 300000,
    [switch]$IncludeDevDependencies,
    [switch]$SkipFunctionChecks,
    [switch]$SkipApiContractCheck,
    [ValidateSet("standard", "regulated")]
    [string]$WorkloadSensitivity = "standard",
    [ValidateRange(50, 50000)]
    [int]$MonthlyBudgetUsd = 300,
    [ValidateSet("unknown", "on", "off")]
    [string]$ProviderCloudflare = "on",
    [ValidateSet("unknown", "on", "off")]
    [string]$ProviderAws = "on",
    [ValidateSet("unknown", "on", "off")]
    [string]$ProviderHetzner = "on",
    [ValidateSet("unknown", "on", "off")]
    [string]$ProviderCloudfront = "off",
    [ValidateSet("unknown", "on", "off")]
    [string]$ProviderAwsShieldAdvanced = "off",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlCloudflareTunnel = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlCloudflareFullStrictTls = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlEc2PrivateSubnetOnly = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlDbPublicAccessDisabled = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlWireguardDbTunnel = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlSecretsManager = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlIamRoleNoAccessKeys = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlCloudTrailMultiRegion = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlBackupRestoreTested30d = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlImdsV2Enforced = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlSshPortClosedPublic = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlDbPortNotPublic = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlWafManagedRulesEnabled = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlAuthRateLimitsEnabled = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlCiSecretScanningEnabled = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlWireguardAlertEnabled = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlCloudTrailRootLoginAlert = "unknown",
    [ValidateSet("unknown", "pass", "fail")]
    [string]$ControlEc2MultiAz = "unknown",
    [switch]$Json
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-DefaultStateFilePath {
    $root = Get-RepoRoot
    return Join-Path $root "Memory-bank\_generated\governance-agent-state.json"
}

function Read-AccessTokenFromState([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        return ""
    }
    $raw = Get-Content -LiteralPath $path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return ""
    }
    try {
        $json = ConvertFrom-Json -InputObject $raw
        if ($null -eq $json) {
            return ""
        }
        return [string]$json.access_token
    }
    catch {
        return ""
    }
}

function Resolve-AccessToken([string]$provided, [string]$statePath) {
    if (-not [string]::IsNullOrWhiteSpace($provided)) {
        return $provided
    }
    if (-not [string]::IsNullOrWhiteSpace($env:PG_ACCESS_TOKEN)) {
        return [string]$env:PG_ACCESS_TOKEN
    }
    return Read-AccessTokenFromState -path $statePath
}

function Assert-ServerReachable([string]$base) {
    $uri = "{0}/health" -f $base.TrimEnd("/")
    try {
        $health = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 10
        if (-not $health.ok) {
            throw "Health endpoint did not return ok=true."
        }
    }
    catch {
        throw "Cannot reach API health endpoint at $uri. Start backend server and retry."
    }
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
        [string]$RepoRoot,
        [string[]]$Requested
    )
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

    $rootManifest = Join-Path $RepoRoot "package.json"
    if (Test-Path -LiteralPath $rootManifest) {
        Add-ResolvedManifestPath -Target $resolved -CandidatePath $rootManifest
    }
    $serviceCandidates = @(
        (Join-Path $RepoRoot "extension\package.json"),
        (Join-Path $RepoRoot "server\package.json")
    )
    foreach ($candidate in $serviceCandidates) {
        if (Test-Path -LiteralPath $candidate) {
            Add-ResolvedManifestPath -Target $resolved -CandidatePath $candidate
        }
    }
    $topLevelDirectories = Get-ChildItem -LiteralPath $RepoRoot -Directory -ErrorAction SilentlyContinue
    foreach ($directory in $topLevelDirectories) {
        $nameLower = $directory.Name.ToLowerInvariant()
        if ($nameLower -in @(".git", "node_modules", "memory-bank", "dist", "build", "out")) {
            continue
        }
        $candidate = Join-Path $directory.FullName "package.json"
        if (Test-Path -LiteralPath $candidate) {
            Add-ResolvedManifestPath -Target $resolved -CandidatePath $candidate
        }
    }
    return $resolved
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

function Get-MapEntries {
    param([object]$ObjectValue)
    if ($null -eq $ObjectValue) { return @() }
    if ($ObjectValue -is [hashtable]) { return $ObjectValue.GetEnumerator() }
    if ($ObjectValue -is [System.Management.Automation.PSCustomObject]) { return $ObjectValue.PSObject.Properties }
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

function Resolve-ScanPaths {
    param(
        [string]$RepoRoot,
        [string[]]$Requested
    )
    if ($Requested -and $Requested.Count -gt 0) {
        $resolved = @()
        foreach ($path in $Requested) {
            if ([string]::IsNullOrWhiteSpace($path)) {
                continue
            }
            $candidate = if ([System.IO.Path]::IsPathRooted($path)) { $path } else { Join-Path $RepoRoot $path }
            if (Test-Path -LiteralPath $candidate) {
                $resolved += (Resolve-Path -LiteralPath $candidate).Path
            }
        }
        return $resolved
    }
    $defaults = @(
        (Join-Path $RepoRoot "server\src"),
        (Join-Path $RepoRoot "server\prisma"),
        (Join-Path $RepoRoot "extension\src")
    )
    $existing = @()
    foreach ($candidate in $defaults) {
        if (Test-Path -LiteralPath $candidate) {
            $existing += (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    if ($existing.Count -gt 0) {
        return $existing
    }
    return @($RepoRoot)
}

function Should-IncludeCodingFile {
    param([string]$FullPath)
    $allowedExtensions = @(
        ".ts", ".tsx", ".js", ".jsx", ".java", ".kt", ".dart", ".py", ".go", ".sql", ".prisma"
    )
    return Should-IncludeFile -FullPath $FullPath -AllowedExtensions $allowedExtensions
}

function Should-IncludeApiFile {
    param([string]$FullPath)
    $allowedExtensions = @(
        ".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs", ".json", ".yml", ".yaml"
    )
    return Should-IncludeFile -FullPath $FullPath -AllowedExtensions $allowedExtensions
}

function Should-IncludeFile {
    param(
        [string]$FullPath,
        [string[]]$AllowedExtensions
    )
    $pathLower = $FullPath.ToLowerInvariant()
    $extension = [System.IO.Path]::GetExtension($pathLower)
    if (-not $AllowedExtensions.Contains($extension)) {
        return $false
    }
    $skipParts = @(
        "\node_modules\",
        "\.git\",
        "\dist\",
        "\build\",
        "\out\",
        "\coverage\",
        "\memory-bank\",
        "\logs\",
        "\.venv\",
        "\venv\",
        "\target\",
        "\.verificaton-before-production-folder\"
    )
    foreach ($part in $skipParts) {
        if ($pathLower.Contains($part)) {
            return $false
        }
    }
    return $true
}

function Convert-ToRelativePath {
    param(
        [string]$RepoRoot,
        [string]$FullPath
    )
    $rootWithSlash = if ($RepoRoot.EndsWith("\")) { $RepoRoot } else { "$RepoRoot\" }
    if ($FullPath.StartsWith($rootWithSlash, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $FullPath.Substring($rootWithSlash.Length).Replace("\", "/")
    }
    return $FullPath.Replace("\", "/")
}

function Build-FilePayload {
    param(
        [string]$RepoRoot,
        [string[]]$ScanRoots,
        [int]$MaxFiles,
        [int]$MaxFileBytes,
        [scriptblock]$IncludePredicate
    )
    $collected = New-Object System.Collections.Generic.List[string]
    foreach ($root in $ScanRoots) {
        $files = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            if (& $IncludePredicate $file.FullName) {
                $collected.Add($file.FullName)
            }
        }
    }
    $uniqueFiles = $collected | Sort-Object -Unique
    $selected = @($uniqueFiles | Select-Object -First $MaxFiles)
    $payloadFiles = New-Object System.Collections.Generic.List[object]
    foreach ($fullPath in $selected) {
        $content = Get-Content -LiteralPath $fullPath -Raw
        if ($content.Length -gt $MaxFileBytes) {
            continue
        }
        $relativePath = Convert-ToRelativePath -RepoRoot $RepoRoot -FullPath $fullPath
        $payloadFiles.Add(@{
                path = $relativePath
                content = $content
            })
    }
    return $payloadFiles
}

function Convert-ToNullableBool {
    param([string]$Value)
    $normalized = if ($null -eq $Value) { "" } else { [string]$Value }
    switch ($normalized.Trim().ToLowerInvariant()) {
        "on" { return $true }
        "off" { return $false }
        "pass" { return $true }
        "fail" { return $false }
        default { return $null }
    }
}

function Build-ScannerMetadata {
    param(
        [string]$ScannerId,
        [object]$Response
    )
    $summary = $Response.summary
    $checked = 0
    if ($summary) {
        if ($summary.PSObject.Properties.Name -contains "checked_dependencies") {
            $checked = [int]$summary.checked_dependencies
        }
        elseif ($summary.PSObject.Properties.Name -contains "checked_files") {
            $checked = [int]$summary.checked_files
        }
    }
    $blockers = if ($summary) { [int]$summary.blockers } else { 0 }
    $warnings = if ($summary) { [int]$summary.warnings } else { 0 }
    $status = "error"
    if ($Response.status -eq "pass") {
        $status = "pass"
    }
    elseif ($Response.status -eq "blocked") {
        $status = "blocked"
    }
    $blockerRuleIds = @($Response.blockers | ForEach-Object { "$($_.rule_id)" } | Where-Object { $_ } | Sort-Object -Unique)
    $warningRuleIds = @($Response.warnings | ForEach-Object { "$($_.rule_id)" } | Where-Object { $_ } | Sort-Object -Unique)
    return @{
        scanner_id = $ScannerId
        status = $status
        evaluator_version = "$($Response.evaluator_version)"
        summary = @{
            checked = $checked
            blockers = $blockers
            warnings = $warnings
        }
        blocker_rule_ids = $blockerRuleIds
        warning_rule_ids = $warningRuleIds
    }
}

function Invoke-VerifyOrRuntimeError {
    param(
        [scriptblock]$Invocation,
        [string]$FallbackEvaluatorVersion
    )
    try {
        return & $Invocation
    }
    catch {
        return @{
            status = "error"
            evaluator_version = $FallbackEvaluatorVersion
            summary = @{
                blockers = 1
                warnings = 0
            }
            blockers = @(
                @{
                    rule_id = "MCP-SCAN-RUNTIME"
                    message = $_.Exception.Message
                }
            )
            warnings = @()
        }
    }
}

$statePath = if ([string]::IsNullOrWhiteSpace($StateFile)) { Get-DefaultStateFilePath } else { $StateFile }
$token = Resolve-AccessToken -provided $AccessToken -statePath $statePath
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "No access token found. Pass -AccessToken, set PG_ACCESS_TOKEN, or run '.\pg.ps1 governance-login' first."
}

$repoRoot = Get-RepoRoot
$manifestPaths = Resolve-ManifestPaths -RepoRoot $repoRoot -Requested $ManifestPath
if (-not $manifestPaths -or $manifestPaths.Count -eq 0) {
    throw "Could not find package.json. Provide -ManifestPath explicitly."
}

Assert-ServerReachable -base $ApiBase

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

$dependencyCandidates = New-Object System.Collections.Generic.List[object]
$seenDependencyKeys = @{}
$resolvedNodeVersion = ""
foreach ($currentManifestPath in $manifestPaths) {
    $manifestRaw = Get-Content -LiteralPath $currentManifestPath -Raw
    $manifest = $manifestRaw | ConvertFrom-Json
    if (-not $NodeVersion -and -not $resolvedNodeVersion) {
        $candidateNodeVersion = Resolve-NodeVersion -Manifest $manifest -Provided ""
        if ($candidateNodeVersion) {
            $resolvedNodeVersion = $candidateNodeVersion
        }
    }
    $manifestDirectory = Split-Path -Parent $currentManifestPath
    $auditSeverityMap = Get-AuditSeverityMap -ManifestDirectory $manifestDirectory -IncludeDevDependencies $IncludeDevDependencies.IsPresent
    $manifestCandidates = Build-DependencyCandidates `
        -Manifest $manifest `
        -IncludeDevDependencies $IncludeDevDependencies.IsPresent `
        -AuditSeverityMap $auditSeverityMap
    foreach ($candidate in $manifestCandidates) {
        $key = (
            "$($candidate.name)|$($candidate.requested_version)|$($candidate.group)"
        ).ToLowerInvariant()
        if ($seenDependencyKeys.ContainsKey($key)) {
            continue
        }
        $seenDependencyKeys[$key] = $true
        $dependencyCandidates.Add($candidate)
    }
}
if ($NodeVersion) {
    $resolvedNodeVersion = $NodeVersion
}
if ($dependencyCandidates.Count -eq 0) {
    throw "No dependencies found in resolved manifests."
}

$resolvedFramework = Resolve-Framework -Candidates $dependencyCandidates -Current $ProjectFramework

$dependencyBody = @{
    package_manager = "npm"
    project_framework = $resolvedFramework
    runtime = @{
        node_version = $resolvedNodeVersion
    }
    options = @{
        skip_registry_fetch = $false
    }
    dependencies = $dependencyCandidates
}

Write-Host "MCP cloud score bridge:"
Write-Host "- step 1/5: dependency verification scan"
$dependencyResponse = Invoke-VerifyOrRuntimeError -FallbackEvaluatorVersion "dependency-verification-v1" -Invocation {
    Invoke-RestMethod `
        -Method Post `
        -Uri "$ApiBase/account/policy/dependency/verify" `
        -Headers $headers `
        -Body ($dependencyBody | ConvertTo-Json -Depth 20)
}

$scanRoots = Resolve-ScanPaths -RepoRoot $repoRoot -Requested $ScanPath
if (-not $scanRoots -or $scanRoots.Count -eq 0) {
    throw "No valid scan paths were found."
}

Write-Host "- step 2/5: coding standards scan"
$codingFiles = Build-FilePayload `
    -RepoRoot $repoRoot `
    -ScanRoots $scanRoots `
    -MaxFiles $MaxFiles `
    -MaxFileBytes $MaxFileBytes `
    -IncludePredicate ${function:Should-IncludeCodingFile}
if ($codingFiles.Count -eq 0) {
    throw "No coding files available after filtering."
}
$codingBody = @{
    project_framework = $resolvedFramework
    options = @{
        enforce_function_limits = (-not $SkipFunctionChecks.IsPresent)
        max_files = $MaxFiles
    }
    files = $codingFiles
}
$codingResponse = Invoke-VerifyOrRuntimeError -FallbackEvaluatorVersion "coding-standards-v1" -Invocation {
    Invoke-RestMethod `
        -Method Post `
        -Uri "$ApiBase/account/policy/coding/verify" `
        -Headers $headers `
        -Body ($codingBody | ConvertTo-Json -Depth 30)
}

$apiResponse = $null
if (-not $SkipApiContractCheck.IsPresent) {
    Write-Host "- step 3/5: API contract scan"
    $apiFiles = Build-FilePayload `
        -RepoRoot $repoRoot `
        -ScanRoots $scanRoots `
        -MaxFiles $MaxFiles `
        -MaxFileBytes $MaxFileBytes `
        -IncludePredicate ${function:Should-IncludeApiFile}
    $apiBody = @{
        options = @{
            max_files = $MaxFiles
        }
        files = $apiFiles
    }
    $apiResponse = Invoke-VerifyOrRuntimeError -FallbackEvaluatorVersion "api-contract-verification-v1" -Invocation {
        Invoke-RestMethod `
            -Method Post `
            -Uri "$ApiBase/account/policy/api-contract/verify" `
            -Headers $headers `
            -Body ($apiBody | ConvertTo-Json -Depth 30)
    }
}
else {
    Write-Host "- step 3/5: API contract scan skipped"
}

Write-Host "- step 4/5: build metadata-only MCP cloud payload"
$scannerResults = New-Object System.Collections.Generic.List[object]
$scannerResults.Add((Build-ScannerMetadata -ScannerId "dependency" -Response $dependencyResponse))
$scannerResults.Add((Build-ScannerMetadata -ScannerId "coding" -Response $codingResponse))
if ($apiResponse) {
    $scannerResults.Add((Build-ScannerMetadata -ScannerId "api-contract" -Response $apiResponse))
}

$architecture = @{
    workload_sensitivity = $WorkloadSensitivity
    monthly_budget_usd = $MonthlyBudgetUsd
    providers = @{
        cloudflare = (Convert-ToNullableBool -Value $ProviderCloudflare)
        aws = (Convert-ToNullableBool -Value $ProviderAws)
        hetzner = (Convert-ToNullableBool -Value $ProviderHetzner)
        cloudfront = (Convert-ToNullableBool -Value $ProviderCloudfront)
        aws_shield_advanced = (Convert-ToNullableBool -Value $ProviderAwsShieldAdvanced)
    }
    controls = @{
        cloudflare_tunnel_enabled = (Convert-ToNullableBool -Value $ControlCloudflareTunnel)
        cloudflare_full_strict_tls = (Convert-ToNullableBool -Value $ControlCloudflareFullStrictTls)
        ec2_private_subnet_only = (Convert-ToNullableBool -Value $ControlEc2PrivateSubnetOnly)
        db_public_access_disabled = (Convert-ToNullableBool -Value $ControlDbPublicAccessDisabled)
        wireguard_db_tunnel_enabled = (Convert-ToNullableBool -Value $ControlWireguardDbTunnel)
        secrets_manager_enabled = (Convert-ToNullableBool -Value $ControlSecretsManager)
        iam_role_no_access_keys = (Convert-ToNullableBool -Value $ControlIamRoleNoAccessKeys)
        cloudtrail_multi_region = (Convert-ToNullableBool -Value $ControlCloudTrailMultiRegion)
        backup_restore_tested_30d = (Convert-ToNullableBool -Value $ControlBackupRestoreTested30d)
        imdsv2_enforced = (Convert-ToNullableBool -Value $ControlImdsV2Enforced)
        ssh_port_closed_public = (Convert-ToNullableBool -Value $ControlSshPortClosedPublic)
        db_port_not_public = (Convert-ToNullableBool -Value $ControlDbPortNotPublic)
        waf_managed_rules_enabled = (Convert-ToNullableBool -Value $ControlWafManagedRulesEnabled)
        auth_rate_limits_enabled = (Convert-ToNullableBool -Value $ControlAuthRateLimitsEnabled)
        ci_secret_scanning_enabled = (Convert-ToNullableBool -Value $ControlCiSecretScanningEnabled)
        wireguard_alert_enabled = (Convert-ToNullableBool -Value $ControlWireguardAlertEnabled)
        cloudtrail_root_login_alert = (Convert-ToNullableBool -Value $ControlCloudTrailRootLoginAlert)
        ec2_multi_az = (Convert-ToNullableBool -Value $ControlEc2MultiAz)
    }
}

$scoreBody = @{
    runtime = @{
        source = "mcp-stdio"
        session_id = [guid]::NewGuid().ToString()
    }
    scanner_results = $scannerResults
    architecture = $architecture
}

Write-Host "- step 5/5: submit metadata to MCP cloud scoring endpoint"
$scoreResponse = $null
try {
    $scoreResponse = Invoke-RestMethod `
        -Method Post `
        -Uri "$ApiBase/account/policy/mcp/cloud-score" `
        -Headers $headers `
        -Body ($scoreBody | ConvertTo-Json -Depth 30) `
        -ErrorAction Stop
}
catch {
    $errorText = @(
        "$($_.Exception.Message)",
        "$($_.ErrorDetails.Message)",
        "$($_ | Out-String)"
    ) -join "`n"
    if ($errorText -match "mcp/cloud-score" -and $errorText -match "not found") {
        throw "MCP cloud scoring route is unavailable on current backend instance. Rebuild/restart server so /account/policy/mcp/cloud-score is loaded."
    }
    throw
}

if ($Json.IsPresent) {
    $scoreResponse | ConvertTo-Json -Depth 20
}
else {
    Write-Host ""
    Write-Host "MCP cloud scoring status: $($scoreResponse.status)"
    Write-Host ("Score: {0}/100 ({1})" -f $scoreResponse.score, $scoreResponse.grade)
    Write-Host (
        "Scanners: {0} | scanner blockers: {1} | scanner warnings: {2}" -f `
            $scoreResponse.summary.scanners, `
            $scoreResponse.summary.scanner_blockers, `
            $scoreResponse.summary.scanner_warnings
    )
    Write-Host (
        "Architecture blockers: {0} | architecture warnings: {1}" -f `
            $scoreResponse.summary.architecture_blockers, `
            $scoreResponse.summary.architecture_warnings
    )
    Write-Host ("Total blockers: {0} | warnings: {1}" -f $scoreResponse.summary.blockers, $scoreResponse.summary.warnings)
    if ($scoreResponse.findings -and $scoreResponse.findings.Count -gt 0) {
        Write-Host ""
        Write-Host "Findings:"
        foreach ($finding in $scoreResponse.findings) {
            $scope = if ($finding.scanner_id) { "$($finding.source):$($finding.scanner_id)" } else { "$($finding.source)" }
            Write-Host "- [$($finding.rule_id)] [$($finding.severity)] $scope -> $($finding.message)"
            Write-Host "  hint: $($finding.hint)"
        }
    }
}

if ($scoreResponse.status -eq "blocked") {
    exit 2
}
exit 0
