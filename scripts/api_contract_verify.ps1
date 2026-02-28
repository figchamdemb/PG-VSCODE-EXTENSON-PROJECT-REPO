param(
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string[]]$ScanPath = @(),
    [ValidateRange(1, 10000)]
    [int]$MaxFiles = 1200,
    [ValidateRange(1000, 2000000)]
    [int]$MaxFileBytes = 300000
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
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

function Should-IncludeFile {
    param(
        [string]$FullPath
    )
    $allowedExtensions = @(
        ".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs",
        ".json", ".yml", ".yaml"
    )
    $pathLower = $FullPath.ToLowerInvariant()
    $extension = [System.IO.Path]::GetExtension($pathLower)
    if (-not $allowedExtensions.Contains($extension)) {
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

if (-not $AccessToken) {
    if ($env:PG_ACCESS_TOKEN) {
        $AccessToken = $env:PG_ACCESS_TOKEN
    }
}
if (-not $AccessToken) {
    throw "Missing AccessToken. Pass -AccessToken or set PG_ACCESS_TOKEN."
}

$repoRoot = Get-RepoRoot
$scanRoots = Resolve-ScanPaths -RepoRoot $repoRoot -Requested $ScanPath
if (-not $scanRoots -or $scanRoots.Count -eq 0) {
    throw "No valid scan paths were found."
}

$collected = New-Object System.Collections.Generic.List[string]
foreach ($root in $scanRoots) {
    $files = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        if (Should-IncludeFile -FullPath $file.FullName) {
            $collected.Add($file.FullName)
        }
    }
}

$uniqueFiles = $collected | Sort-Object -Unique
if (-not $uniqueFiles -or $uniqueFiles.Count -eq 0) {
    throw "No source/spec files found in scan paths."
}

$selected = @($uniqueFiles | Select-Object -First $MaxFiles)
$payloadFiles = New-Object System.Collections.Generic.List[object]
foreach ($fullPath in $selected) {
    $content = Get-Content -LiteralPath $fullPath -Raw
    if ($content.Length -gt $MaxFileBytes) {
        Write-Host "Skipping oversized file payload: $fullPath ($($content.Length) chars)"
        continue
    }
    $relativePath = Convert-ToRelativePath -RepoRoot $repoRoot -FullPath $fullPath
    $payloadFiles.Add(@{
        path = $relativePath
        content = $content
    })
}

if ($payloadFiles.Count -eq 0) {
    throw "No files available to verify after size filtering."
}

$body = @{
    options = @{
        max_files = $MaxFiles
    }
    files = $payloadFiles
}

$headers = @{
    Authorization = "Bearer $AccessToken"
    "Content-Type" = "application/json"
}

$response = Invoke-RestMethod `
    -Method Post `
    -Uri "$ApiBase/account/policy/api-contract/verify" `
    -Headers $headers `
    -Body ($body | ConvertTo-Json -Depth 20)

Write-Host "API contract verification status: $($response.status)"
Write-Host "Checked files: $($response.summary.checked_files) | blockers: $($response.summary.blockers) | warnings: $($response.summary.warnings)"
Write-Host "Source mode: $($response.summary.source_mode) | endpoints: $($response.summary.backend_endpoints) | calls: $($response.summary.frontend_calls) | mismatches: $($response.summary.mismatches)"

if ($response.blockers -and $response.blockers.Count -gt 0) {
    Write-Host ""
    Write-Host "Blockers:"
    foreach ($item in $response.blockers) {
        $location = if ($item.file_path) { "$($item.file_path):$($item.line)" } else { "-" }
        Write-Host "- [$($item.rule_id)] $location -> $($item.message)"
        Write-Host "  hint: $($item.hint)"
    }
}

if ($response.warnings -and $response.warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "Warnings:"
    foreach ($item in $response.warnings) {
        $location = if ($item.file_path) { "$($item.file_path):$($item.line)" } else { "-" }
        Write-Host "- [$($item.rule_id)] $location -> $($item.message)"
    }
}

if ($response.status -eq "blocked") {
    exit 2
}
exit 0
