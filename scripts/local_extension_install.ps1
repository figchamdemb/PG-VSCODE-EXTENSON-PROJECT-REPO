param(
    [string]$ExtensionDir = "",
    [switch]$SkipCompile,
    [switch]$SkipPackage,
    [switch]$SkipInstall,
    [switch]$SkipGlobalCliSync,
    [switch]$NoForce
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedExtensionDir = if ([string]::IsNullOrWhiteSpace($ExtensionDir)) {
    Join-Path $repoRoot "extension"
}
else {
    if ([System.IO.Path]::IsPathRooted($ExtensionDir)) { $ExtensionDir } else { Join-Path $repoRoot $ExtensionDir }
}
$resolvedExtensionDir = (Resolve-Path $resolvedExtensionDir).Path

function Invoke-Step([string]$Name, [scriptblock]$Action) {
    Write-Host ("[local-extension-install] " + $Name + " ...")
    & $Action
}

function Get-LatestVsix([string]$Dir) {
    return Get-ChildItem -Path $Dir -Filter "*.vsix" -File |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
}

function Ensure-Command([string]$CommandName, [string]$InstallHint) {
    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw ("Required command '" + $CommandName + "' was not found. " + $InstallHint)
    }
}

function Resolve-VsCodeCli() {
    $candidates = @(
        "code.cmd",
        "code"
    )
    foreach ($candidate in $candidates) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }

    $fallbacks = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\bin\code.cmd"),
        (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code Insiders\bin\code-insiders.cmd")
    )
    foreach ($path in $fallbacks) {
        if (Test-Path $path) {
            return $path
        }
    }

    throw "Required command 'code.cmd' was not found. Install VS Code and enable the 'code' shell command in PATH."
}

Ensure-Command -CommandName "npm" -InstallHint "Install Node.js and npm, then rerun."
$vsCodeCli = Resolve-VsCodeCli

if (-not $SkipCompile.IsPresent) {
    Invoke-Step "Compile extension" {
        Push-Location $resolvedExtensionDir
        try {
            & npm run compile
            if ($LASTEXITCODE -ne 0) {
                throw "npm run compile failed."
            }
        }
        finally {
            Pop-Location
        }
    }
}

if (-not $SkipPackage.IsPresent) {
    Invoke-Step "Package VSIX" {
        Push-Location $resolvedExtensionDir
        try {
            & npx @vscode/vsce package
            if ($LASTEXITCODE -ne 0) {
                throw "VSIX packaging failed."
            }
        }
        finally {
            Pop-Location
        }
    }
}

$vsix = Get-LatestVsix -Dir $resolvedExtensionDir
if (-not $vsix) {
    throw "No .vsix file found in extension directory. Run without -SkipPackage first."
}

if (-not $SkipInstall.IsPresent) {
    $installArgs = @("--install-extension", $vsix.FullName)
    if (-not $NoForce.IsPresent) {
        $installArgs += "--force"
    }
    Invoke-Step "Install VSIX into normal VS Code profile" {
        & $vsCodeCli @installArgs
        if ($LASTEXITCODE -ne 0) {
            throw "VSIX installation failed."
        }
    }
}

if (-not $SkipGlobalCliSync.IsPresent) {
    Invoke-Step "Sync global PG CLI payload" {
        & powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\sync_global_pg_cli.ps1")
        if ($LASTEXITCODE -ne 0) {
            throw "Global PG CLI sync failed."
        }
    }
}

Write-Host ""
Write-Host "[local-extension-install] DONE"
Write-Host ("VSIX: " + $vsix.FullName)
Write-Host ""
Write-Host "Verify in normal VS Code:"
Write-Host "  1) Open Extensions view (Ctrl+Shift+X)"
Write-Host "  2) Search: figchamdemb.narrate-vscode-extension"
Write-Host "  3) Reload window (Ctrl+Shift+P -> Developer: Reload Window)"
Write-Host "  4) Confirm status-bar controls appear: Narrate Reading/View/Pane/Source/Explain + Trust On/Off"
