param(
    [ValidateSet("init", "check", "set", "get", "list", "remove")]
    [string]$Action = "check",
    [string]$ProfilePath = "",
    [string]$Key = "",
    [string]$Value = "",
    [switch]$Secret,
    [switch]$Prompt,
    [switch]$Reveal,
    [switch]$Json,
    [switch]$Force,
    [switch]$Quiet,
    [switch]$EnsureExists
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-DefaultProfilePath {
    return Join-Path (Get-RepoRoot) ".narrate\dev-profile.local.json"
}

function Test-IsGitIgnored([string]$candidatePath) {
    try {
        $repoRoot = Get-RepoRoot
        $resolvedCandidate = Resolve-Path -LiteralPath $candidatePath -ErrorAction SilentlyContinue
        if (-not $resolvedCandidate) {
            return $false
        }
        $resolvedPath = $resolvedCandidate.Path
        if (-not $resolvedPath.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
        $relative = $resolvedPath.Substring($repoRoot.Length).TrimStart("\", "/")
        if ([string]::IsNullOrWhiteSpace($relative)) {
            return $false
        }
        & git -C $repoRoot check-ignore $relative | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function ConvertTo-HashtableRecursive([object]$obj) {
    if ($null -eq $obj) {
        return $null
    }
    if ($obj -is [hashtable]) {
        $copy = @{}
        foreach ($k in $obj.Keys) {
            $copy[$k] = ConvertTo-HashtableRecursive $obj[$k]
        }
        return $copy
    }
    if ($obj -is [System.Management.Automation.PSCustomObject]) {
        $map = @{}
        foreach ($prop in $obj.PSObject.Properties) {
            $map[$prop.Name] = ConvertTo-HashtableRecursive $prop.Value
        }
        return $map
    }
    if ($obj -is [System.Collections.IEnumerable] -and -not ($obj -is [string])) {
        $list = @()
        foreach ($item in $obj) {
            $list += ConvertTo-HashtableRecursive $item
        }
        return $list
    }
    return $obj
}

function Read-Profile([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        return $null
    }
    $raw = Get-Content -LiteralPath $path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }
    try {
        $obj = ConvertFrom-Json -InputObject $raw
        return ConvertTo-HashtableRecursive $obj
    } catch {
        throw "Invalid JSON in dev profile: $path"
    }
}

function Write-Profile([string]$path, [hashtable]$profile) {
    $dir = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
    }
    $profile["_meta"]["last_updated_utc"] = [DateTime]::UtcNow.ToString("o")
    $json = $profile | ConvertTo-Json -Depth 20
    Set-Content -LiteralPath $path -Value $json -Encoding UTF8
}

function New-DefaultProfile {
    return @{
        _meta = @{
            schema_version = 1
            mode = "local-dev-only"
            warning = "DEV TEST PROFILE ONLY. NEVER use for production secrets."
            created_utc = [DateTime]::UtcNow.ToString("o")
            last_updated_utc = [DateTime]::UtcNow.ToString("o")
        }
        values = @{
            api_base = "http://127.0.0.1:8787"
            shell = "powershell"
            project_framework = "unknown"
            node_version = ""
            java_version = ""
            maven_version = ""
            docker_runtime = "desktop"
            kafka_enabled = "false"
            db_host = ""
            db_port = "5432"
            db_name = ""
            db_user = ""
        }
        secret_values = @{
            db_password = ""
        }
    }
}

function Ensure-Shape([hashtable]$profile) {
    if (-not $profile.ContainsKey("_meta")) { $profile["_meta"] = @{} }
    if (-not $profile.ContainsKey("values")) { $profile["values"] = @{} }
    if (-not $profile.ContainsKey("secret_values")) { $profile["secret_values"] = @{} }
}

function Convert-PlainToProtected([string]$plain) {
    $secure = ConvertTo-SecureString -String $plain -AsPlainText -Force
    return ConvertFrom-SecureString -SecureString $secure
}

function Convert-ProtectedToPlain([string]$cipher) {
    $secure = ConvertTo-SecureString -String $cipher
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        if ($ptr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        }
    }
}

function Get-RequiredNonSecretKeys {
    return @(
        "api_base",
        "shell",
        "db_host",
        "db_port",
        "db_name",
        "db_user"
    )
}

function Get-RequiredSecretKeys {
    return @("db_password")
}

$path = if ([string]::IsNullOrWhiteSpace($ProfilePath)) { Get-DefaultProfilePath } else { $ProfilePath }
$profile = Read-Profile -path $path

if ($Action -eq "init") {
    if ((Test-Path -LiteralPath $path) -and -not $Force.IsPresent) {
        throw "Dev profile already exists at '$path'. Use -Force to overwrite."
    }
    $profile = New-DefaultProfile
    Write-Profile -path $path -profile $profile
    if (-not $Quiet.IsPresent) {
        Write-Host "Initialized local dev profile:"
        Write-Host "- path: $path"
        if (-not (Test-IsGitIgnored -candidatePath $path)) {
            Write-Warning "Profile path is not currently ignored by git. Add it to .gitignore before storing local secrets."
        }
        Write-Host "Next:"
        Write-Host "  .\pg.ps1 dev-profile -DevProfileAction set -ProfileKey db_host -ProfileValue 127.0.0.1"
        Write-Host "  .\pg.ps1 dev-profile -DevProfileAction set -ProfileKey db_password -Secret -Prompt"
    }
    return @{
        ok = $true
        action = "init"
        path = $path
    }
}

if ($null -eq $profile) {
    if ($Action -eq "check") {
        $result = @{
            ok = $false
            action = "check"
            path = $path
            missing = @("profile_file")
            message = "Dev profile file not found. Run '.\pg.ps1 dev-profile -DevProfileAction init'."
        }
        if (-not $Quiet.IsPresent) {
            Write-Warning $result.message
        }
        return $result
    }
    throw "Dev profile file not found at '$path'. Run '.\pg.ps1 dev-profile -DevProfileAction init'."
}

Ensure-Shape -profile $profile

switch ($Action) {
    "check" {
        $missing = @()
        foreach ($k in Get-RequiredNonSecretKeys) {
            $v = ""
            if ($profile["values"].ContainsKey($k)) {
                $v = [string]$profile["values"][$k]
            }
            if ([string]::IsNullOrWhiteSpace($v)) {
                $missing += "values.$k"
            }
        }
        foreach ($k in Get-RequiredSecretKeys) {
            $v = ""
            if ($profile["secret_values"].ContainsKey($k)) {
                $v = [string]$profile["secret_values"][$k]
            }
            if ([string]::IsNullOrWhiteSpace($v)) {
                $missing += "secret_values.$k"
            }
        }

        $isIgnored = Test-IsGitIgnored -candidatePath $path
        if (-not $isIgnored) {
            $missing += "_policy.gitignore_entry"
        }

        $ok = ($missing.Count -eq 0)
        if (-not $Quiet.IsPresent) {
            if ($ok) {
                Write-Host "Dev profile check: OK"
                Write-Host "- path: $path"
                Write-Host "- gitignored: true"
            } else {
                Write-Warning "Dev profile check: missing required fields."
                Write-Host "- path: $path"
                Write-Host "- gitignored: $(if ($isIgnored) { "true" } else { "false" })"
                foreach ($m in $missing) {
                    Write-Host "  - $m"
                }
                if (-not $isIgnored) {
                    Write-Host "Hint: keep this file local-only by adding it to .gitignore."
                }
            }
        }
        return @{
            ok = $ok
            action = "check"
            path = $path
            missing = $missing
            gitignored = $isIgnored
        }
    }
    "set" {
        if ([string]::IsNullOrWhiteSpace($Key)) {
            throw "Profile key is required for set. Use -ProfileKey <name>."
        }
        $resolved = $Value
        if ($Prompt.IsPresent -and [string]::IsNullOrWhiteSpace($resolved)) {
            if ($Secret.IsPresent) {
                $secureInput = Read-Host "Enter value for $Key" -AsSecureString
                $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureInput)
                try {
                    $resolved = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
                } finally {
                    if ($ptr -ne [IntPtr]::Zero) {
                        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
                    }
                }
            } else {
                $resolved = Read-Host "Enter value for $Key"
            }
        }
        if ([string]::IsNullOrWhiteSpace($resolved)) {
            throw "Profile value is empty for '$Key'. Use -ProfileValue or -ProfilePrompt."
        }

        if ($Secret.IsPresent) {
            $profile["secret_values"][$Key] = Convert-PlainToProtected -plain $resolved
            if ($profile["values"].ContainsKey($Key)) {
                $profile["values"].Remove($Key) | Out-Null
            }
        } else {
            $profile["values"][$Key] = $resolved
            if ($profile["secret_values"].ContainsKey($Key)) {
                $profile["secret_values"].Remove($Key) | Out-Null
            }
        }
        Write-Profile -path $path -profile $profile
        if (-not $Quiet.IsPresent) {
            Write-Host "Saved '$Key' to local dev profile."
            Write-Host "- path: $path"
            Write-Host "- mode: $(if ($Secret.IsPresent) { "secret (user/machine protected)" } else { "plain value" })"
        }
        return @{
            ok = $true
            action = "set"
            path = $path
            key = $Key
            secret = $Secret.IsPresent
        }
    }
    "get" {
        if ([string]::IsNullOrWhiteSpace($Key)) {
            throw "Profile key is required for get. Use -ProfileKey <name>."
        }
        if ($profile["values"].ContainsKey($Key)) {
            $v = [string]$profile["values"][$Key]
            Write-Output $v
            return @{
                ok = $true
                action = "get"
                path = $path
                key = $Key
                secret = $false
            }
        }
        if ($profile["secret_values"].ContainsKey($Key)) {
            if ($Reveal.IsPresent) {
                $plain = Convert-ProtectedToPlain -cipher ([string]$profile["secret_values"][$Key])
                Write-Output $plain
            } else {
                Write-Output "***"
            }
            return @{
                ok = $true
                action = "get"
                path = $path
                key = $Key
                secret = $true
                revealed = $Reveal.IsPresent
            }
        }
        throw "Key '$Key' not found in dev profile."
    }
    "list" {
        $mask = "***"
        $out = [ordered]@{
            path = $path
            values = $profile["values"]
            secret_values = @{}
        }
        foreach ($k in $profile["secret_values"].Keys) {
            if ($Reveal.IsPresent) {
                $out["secret_values"][$k] = Convert-ProtectedToPlain -cipher ([string]$profile["secret_values"][$k])
            } else {
                $out["secret_values"][$k] = $mask
            }
        }
        if ($Json.IsPresent) {
            $out | ConvertTo-Json -Depth 20
        } else {
            Write-Host "Dev profile values:"
            foreach ($k in ($out["values"].Keys | Sort-Object)) {
                Write-Host ("- {0}: {1}" -f $k, [string]$out["values"][$k])
            }
            Write-Host "Dev profile secret values:"
            foreach ($k in ($out["secret_values"].Keys | Sort-Object)) {
                Write-Host ("- {0}: {1}" -f $k, [string]$out["secret_values"][$k])
            }
            Write-Host "- path: $path"
        }
        return @{
            ok = $true
            action = "list"
            path = $path
        }
    }
    "remove" {
        if ([string]::IsNullOrWhiteSpace($Key)) {
            throw "Profile key is required for remove. Use -ProfileKey <name>."
        }
        $removed = $false
        if ($profile["values"].ContainsKey($Key)) {
            $profile["values"].Remove($Key) | Out-Null
            $removed = $true
        }
        if ($profile["secret_values"].ContainsKey($Key)) {
            $profile["secret_values"].Remove($Key) | Out-Null
            $removed = $true
        }
        Write-Profile -path $path -profile $profile
        if (-not $Quiet.IsPresent) {
            if ($removed) {
                Write-Host "Removed '$Key' from local dev profile."
            } else {
                Write-Warning "Key '$Key' was not present."
            }
        }
        return @{
            ok = $removed
            action = "remove"
            path = $path
            key = $Key
        }
    }
    default {
        throw "Unsupported action '$Action'."
    }
}
