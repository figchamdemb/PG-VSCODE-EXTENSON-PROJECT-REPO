param(
    [string]$WorkingDirectory = "",
    [string]$ConfigPath = "",
    [string]$SmokeTag = "@smoke"
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Resolve-WorkingDirectory {
    param([string]$RequestedPath)
    if ([string]::IsNullOrWhiteSpace($RequestedPath)) {
        return Get-RepoRoot
    }
    if ([System.IO.Path]::IsPathRooted($RequestedPath)) {
        if (-not (Test-Path -LiteralPath $RequestedPath)) {
            throw "WorkingDirectory not found: $RequestedPath"
        }
        return (Resolve-Path -LiteralPath $RequestedPath).Path
    }
    $resolved = Join-Path (Get-RepoRoot) $RequestedPath
    if (-not (Test-Path -LiteralPath $resolved)) {
        throw "WorkingDirectory not found: $resolved"
    }
    return (Resolve-Path -LiteralPath $resolved).Path
}

function Resolve-PlaywrightConfigPath {
    param(
        [string]$BaseDirectory,
        [string]$RequestedPath
    )
    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        $candidate = if ([System.IO.Path]::IsPathRooted($RequestedPath)) {
            $RequestedPath
        } else {
            Join-Path $BaseDirectory $RequestedPath
        }
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
        return ""
    }

    $candidates = @(
        (Join-Path $BaseDirectory "playwright.config.ts"),
        (Join-Path $BaseDirectory "playwright.config.js"),
        (Join-Path $BaseDirectory "playwright.config.mjs"),
        (Join-Path $BaseDirectory "playwright.config.cjs")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    return ""
}

function Has-PlaywrightDependency {
    param([string]$BaseDirectory)

    $manifestPath = Join-Path $BaseDirectory "package.json"
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        return $false
    }

    $raw = Get-Content -LiteralPath $manifestPath -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $false
    }

    $manifest = ConvertFrom-Json -InputObject $raw
    $dependencies = @{}
    if ($manifest.dependencies) {
        foreach ($item in $manifest.dependencies.PSObject.Properties) {
            $dependencies[$item.Name] = $true
        }
    }
    if ($manifest.devDependencies) {
        foreach ($item in $manifest.devDependencies.PSObject.Properties) {
            $dependencies[$item.Name] = $true
        }
    }
    return $dependencies.ContainsKey("@playwright/test")
}

function Get-PlaywrightTestFiles {
    param([string]$BaseDirectory)

    $patterns = @(
        "*.spec.ts", "*.spec.tsx", "*.spec.js", "*.spec.jsx", "*.spec.mts", "*.spec.mjs",
        "*.test.ts", "*.test.tsx", "*.test.js", "*.test.jsx", "*.test.mts", "*.test.mjs"
    )

    $all = @()
    foreach ($pattern in $patterns) {
        $all += Get-ChildItem -LiteralPath $BaseDirectory -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue
    }

    $skipParts = @(
        "\node_modules\",
        "\dist\",
        "\build\",
        "\out\",
        "\coverage\",
        "\memory-bank\",
        "\.git\",
        "\.verificaton-before-production-folder\"
    )

    $filtered = New-Object System.Collections.Generic.List[System.IO.FileInfo]
    foreach ($file in ($all | Sort-Object -Property FullName -Unique)) {
        $lower = $file.FullName.ToLowerInvariant()
        $skip = $false
        foreach ($part in $skipParts) {
            if ($lower.Contains($part)) {
                $skip = $true
                break
            }
        }
        if (-not $skip) {
            $filtered.Add($file)
        }
    }
    return $filtered
}

function Has-SmokeTag {
    param(
        [System.Collections.Generic.List[System.IO.FileInfo]]$Files,
        [string]$Tag
    )
    if ([string]::IsNullOrWhiteSpace($Tag)) {
        return $false
    }
    foreach ($file in $Files) {
        if (Select-String -LiteralPath $file.FullName -Pattern ([regex]::Escape($Tag)) -Quiet) {
            return $true
        }
    }
    return $false
}

$workingDir = Resolve-WorkingDirectory -RequestedPath $WorkingDirectory
$config = Resolve-PlaywrightConfigPath -BaseDirectory $workingDir -RequestedPath $ConfigPath

if ([string]::IsNullOrWhiteSpace($config)) {
    Write-Host "Playwright smoke check blocked: playwright config not found."
    Write-Host "Add playwright config (playwright.config.ts/js) or pass -ConfigPath explicitly."
    exit 2
}

if (-not (Has-PlaywrightDependency -BaseDirectory $workingDir)) {
    Write-Host "Playwright smoke check blocked: '@playwright/test' is not declared in package.json."
    Write-Host "Install it in $workingDir (for example: npm install -D @playwright/test)."
    exit 2
}

$tests = Get-PlaywrightTestFiles -BaseDirectory $workingDir
if ($tests.Count -eq 0) {
    Write-Host "Playwright smoke check blocked: no playwright test files were found."
    Write-Host "Add at least one '*.spec.*' or '*.test.*' Playwright test file."
    exit 2
}

$runSmokeOnly = Has-SmokeTag -Files $tests -Tag $SmokeTag

$npx = Get-Command "npx" -ErrorAction SilentlyContinue
if ($null -eq $npx) {
    Write-Host "Playwright smoke check blocked: 'npx' was not found in PATH."
    exit 2
}

$args = @("playwright", "test", "--config", $config, "--max-failures", "1")
if ($runSmokeOnly) {
    $args += @("--grep", $SmokeTag)
    Write-Host "Playwright smoke check: running smoke-tagged tests ($SmokeTag)."
}
else {
    Write-Host "Playwright smoke check: no '$SmokeTag' tag found, running full Playwright test suite."
}

Push-Location $workingDir
try {
    & $npx.Source @args
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($exitCode -ne 0) {
    Write-Host "Playwright smoke check blocked: Playwright tests failed."
    exit 2
}

Write-Host "Playwright smoke check passed."
exit 0
