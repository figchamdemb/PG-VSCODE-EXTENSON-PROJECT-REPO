param(
    [ValidateSet("login", "update", "doctor")]
    [string]$Action = "doctor",
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$Email = "",
    [string]$InstallId = "",
    [string]$OtpCode = "",
    [string]$AccessToken = "",
    [string]$StateFile = "",
    [switch]$Yes,
    [switch]$Json
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-DefaultStateFilePath {
    $repoRoot = Get-RepoRoot
    return Join-Path $repoRoot "Memory-bank\_generated\pg-cli-state.json"
}

function Read-State([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        return @{}
    }
    $raw = Get-Content -LiteralPath $path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return @{}
    }
    try {
        $parsed = ConvertFrom-Json -InputObject $raw
        if ($null -eq $parsed) {
            return @{}
        }
        $map = @{}
        foreach ($property in $parsed.PSObject.Properties) {
            $map[$property.Name] = $property.Value
        }
        return $map
    }
    catch {
        throw "Invalid JSON in state file '$path'. Delete or fix the file, then retry."
    }
}

function Write-State([string]$path, [hashtable]$state) {
    $directory = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -Path $directory -ItemType Directory -Force | Out-Null
    }
    $stateJson = $state | ConvertTo-Json -Depth 12
    Set-Content -LiteralPath $path -Value $stateJson -Encoding UTF8
}

function Resolve-ApiBase([hashtable]$state, [bool]$apiBaseProvided, [string]$apiBaseValue) {
    if ($apiBaseProvided -and -not [string]::IsNullOrWhiteSpace($apiBaseValue)) {
        return $apiBaseValue.TrimEnd("/")
    }
    if ($state.ContainsKey("api_base") -and -not [string]::IsNullOrWhiteSpace([string]$state["api_base"])) {
        return [string]$state["api_base"]
    }
    return "http://127.0.0.1:8787"
}

function Resolve-AccessToken([hashtable]$state, [string]$providedToken) {
    if (-not [string]::IsNullOrWhiteSpace($providedToken)) {
        return $providedToken
    }
    if (-not [string]::IsNullOrWhiteSpace($env:PG_ACCESS_TOKEN)) {
        return $env:PG_ACCESS_TOKEN
    }
    if ($state.ContainsKey("access_token") -and -not [string]::IsNullOrWhiteSpace([string]$state["access_token"])) {
        return [string]$state["access_token"]
    }
    return ""
}

function Invoke-JsonPost([string]$uri, [hashtable]$body, [hashtable]$headers = @{}) {
    $json = $body | ConvertTo-Json -Compress
    return Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Headers $headers -Body $json
}

function Invoke-JsonGet([string]$uri, [hashtable]$headers = @{}) {
    return Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
}

function Resolve-RecommendedProdProfile([string]$plan, [object[]]$modules) {
    $moduleSet = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($module in @($modules)) {
        if ($null -ne $module) {
            $null = $moduleSet.Add(([string]$module))
        }
    }

    $hasMemorybankEntitlement = $moduleSet.Contains("memorybank") -or $moduleSet.Contains("bundle")
    if (-not $hasMemorybankEntitlement) {
        return "legacy"
    }

    if ($plan -eq "enterprise" -or $plan -eq "team") {
        return "strict"
    }
    if ($plan -eq "pro") {
        return "standard"
    }
    return "legacy"
}

function Convert-BoolString([object]$value) {
    if ($null -eq $value) {
        return "false"
    }
    if ([bool]$value) {
        return "true"
    }
    return "false"
}

function Sync-DevProfile(
    [string]$apiBase,
    [object]$summary,
    [string]$recommendedProdProfile,
    [string]$statePath
) {
    $scriptPath = Join-Path $PSScriptRoot "dev_profile.ps1"
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        return @("dev_profile_script_missing")
    }

    $issues = @()
    try {
        $checkResult = & $scriptPath -Action check -Quiet
        if ($checkResult -and ($checkResult.ok -eq $false) -and $checkResult.missing -contains "profile_file") {
            & $scriptPath -Action init -Quiet | Out-Null
        }
    }
    catch {
        $issues += "dev_profile_check_failed"
    }

    $moduleList = @()
    foreach ($item in @($summary.modules)) {
        if ($null -ne $item) {
            $moduleList += [string]$item
        }
    }
    $moduleCsv = $moduleList -join ","
    $teamKeys = @()
    foreach ($team in @($summary.teams)) {
        if ($team -and $team.team_key) {
            $teamKeys += [string]$team.team_key
        }
    }

    $profileValues = [ordered]@{
        api_base = $apiBase
        pg_cli_state_file = $statePath
        pg_cli_last_sync_utc = [DateTime]::UtcNow.ToString("o")
        pg_cli_email = [string]$summary.account.email
        pg_cli_plan = [string]$summary.plan
        pg_cli_modules = $moduleCsv
        pg_cli_team_keys = ($teamKeys -join ",")
        pg_cli_governance_enabled = Convert-BoolString $summary.governance.enabled
        pg_cli_recommended_prod_profile = $recommendedProdProfile
    }

    foreach ($key in $profileValues.Keys) {
        try {
            & $scriptPath -Action set -Key $key -Value ([string]$profileValues[$key]) -Quiet | Out-Null
        }
        catch {
            $issues += ("set_failed:{0}" -f $key)
        }
    }

    return $issues
}

function Build-SummaryPayload([object]$summary, [string]$recommendedProdProfile, [string]$statePath, [string]$apiBase) {
    $modules = @()
    foreach ($module in @($summary.modules)) {
        if ($null -ne $module) {
            $modules += [string]$module
        }
    }
    $teamKeys = @()
    foreach ($team in @($summary.teams)) {
        if ($team -and $team.team_key) {
            $teamKeys += [string]$team.team_key
        }
    }

    return [ordered]@{
        api_base = $apiBase
        state_file = $statePath
        email = [string]$summary.account.email
        user_id = [string]$summary.account.user_id
        plan = [string]$summary.plan
        modules = $modules
        governance_enabled = [bool]$summary.governance.enabled
        team_keys = $teamKeys
        recommended_prod_profile = $recommendedProdProfile
    }
}

function Persist-State(
    [hashtable]$state,
    [string]$statePath,
    [string]$apiBase,
    [string]$email,
    [string]$installId,
    [string]$accessToken,
    [object]$summary,
    [string]$recommendedProdProfile,
    [string]$action
) {
    $nowIso = [DateTime]::UtcNow.ToString("o")
    $teamKeys = @()
    foreach ($team in @($summary.teams)) {
        if ($team -and $team.team_key) {
            $teamKeys += [string]$team.team_key
        }
    }
    $moduleList = @()
    foreach ($module in @($summary.modules)) {
        if ($null -ne $module) {
            $moduleList += [string]$module
        }
    }

    $state["api_base"] = $apiBase
    $state["email"] = $email
    $state["install_id"] = $installId
    $state["access_token"] = $accessToken
    $state["account_user_id"] = [string]$summary.account.user_id
    $state["plan"] = [string]$summary.plan
    $state["modules"] = $moduleList
    $state["governance_enabled"] = [bool]$summary.governance.enabled
    $state["team_keys"] = $teamKeys
    $state["recommended_prod_profile"] = $recommendedProdProfile
    $state["last_sync_at"] = $nowIso
    if ($action -eq "login") {
        $state["last_login_at"] = $nowIso
    }
    $state["summary_snapshot"] = @{
        plan = [string]$summary.plan
        modules = $moduleList
        governance_enabled = [bool]$summary.governance.enabled
        recommended_prod_profile = $recommendedProdProfile
    }

    Write-State -path $statePath -state $state
}

function Show-LifecycleResult([hashtable]$payload, [switch]$JsonOutput) {
    if ($JsonOutput.IsPresent) {
        $payload | ConvertTo-Json -Depth 10
        return
    }

    if ($payload.ContainsKey("title")) {
        Write-Host $payload["title"]
    }
    if ($payload.ContainsKey("status")) {
        Write-Host ("status: {0}" -f [string]$payload["status"])
    }
    foreach ($key in @("api_base", "state_file", "email", "user_id", "plan", "recommended_prod_profile")) {
        if ($payload.ContainsKey($key)) {
            Write-Host ("- {0}: {1}" -f $key, [string]$payload[$key])
        }
    }
    if ($payload.ContainsKey("modules")) {
        Write-Host ("- modules: {0}" -f ((@($payload["modules"]) -join ", ")))
    }
    if ($payload.ContainsKey("team_keys")) {
        Write-Host ("- team_keys: {0}" -f ((@($payload["team_keys"]) -join ", ")))
    }
    if ($payload.ContainsKey("governance_enabled")) {
        Write-Host ("- governance_enabled: {0}" -f (Convert-BoolString $payload["governance_enabled"]))
    }
    if ($payload.ContainsKey("profile_sync_issues")) {
        $issues = @($payload["profile_sync_issues"])
        if ($issues.Count -gt 0) {
            Write-Warning ("dev-profile sync issues: {0}" -f ($issues -join ", "))
        }
    }
}

function Build-DoctorCheck([string]$id, [string]$severity, [bool]$ok, [string]$message, [string]$hint) {
    return @{
        rule_id = $id
        severity = $severity
        ok = $ok
        message = $message
        hint = $hint
    }
}

function Run-Doctor(
    [hashtable]$state,
    [string]$statePath,
    [string]$apiBase,
    [string]$accessToken,
    [switch]$JsonOutput
) {
    $checks = @()
    $repoRoot = Get-RepoRoot
    $localPg = Join-Path $repoRoot "pg.ps1"
    $hasBlockers = $false

    if (Test-Path -LiteralPath $localPg) {
        $checks += Build-DoctorCheck "PG-DOC-001" "info" $true "Local pg.ps1 wrapper found." "Use .\\pg.ps1 from repo root."
    }
    else {
        $checks += Build-DoctorCheck "PG-DOC-001" "blocker" $false "Local pg.ps1 wrapper is missing." "Restore pg.ps1 in repo root."
        $hasBlockers = $true
    }

    $globalCommands = @(Get-Command pg.ps1 -All -ErrorAction SilentlyContinue)
    if ($globalCommands.Count -eq 0) {
        $checks += Build-DoctorCheck "PG-DOC-002" "warning" $false "No pg.ps1 command found in shell PATH." "Run local command directly: .\\pg.ps1 <command>."
    }
    else {
        $firstSource = [string]$globalCommands[0].Source
        if ($firstSource -and (Test-Path -LiteralPath $localPg) -and ($firstSource -ne (Resolve-Path -LiteralPath $localPg).Path)) {
            $checks += Build-DoctorCheck "PG-DOC-002" "warning" $false ("Global pg.ps1 shadows local wrapper: {0}" -f $firstSource) "Prefer .\\pg.ps1 to avoid command-set mismatch."
        }
        else {
            $checks += Build-DoctorCheck "PG-DOC-002" "info" $true "Shell resolves local pg.ps1 first (or compatible order)." "No action needed."
        }
    }

    if (Test-Path -LiteralPath $statePath) {
        $checks += Build-DoctorCheck "PG-DOC-003" "info" $true ("CLI state file found: {0}" -f $statePath) "No action needed."
    }
    else {
        $checks += Build-DoctorCheck "PG-DOC-003" "warning" $false ("CLI state file missing: {0}" -f $statePath) "Run .\\pg.ps1 login first."
    }

    $toolCommands = @(
        @{ name = "git"; hint = "Install Git and ensure it is in PATH." },
        @{ name = "node"; hint = "Install Node.js 20+ for extension/server tooling." },
        @{ name = "python"; hint = "Install Python 3 for memory-bank scripts." }
    )
    foreach ($tool in $toolCommands) {
        $resolved = Get-Command $tool.name -ErrorAction SilentlyContinue
        if ($resolved) {
            $checks += Build-DoctorCheck "PG-DOC-004" "info" $true ("Tool found: {0}" -f $tool.name) "No action needed."
        }
        else {
            $checks += Build-DoctorCheck "PG-DOC-004" "blocker" $false ("Missing required tool: {0}" -f $tool.name) $tool.hint
            $hasBlockers = $true
        }
    }

    $devProfileScript = Join-Path $PSScriptRoot "dev_profile.ps1"
    if (Test-Path -LiteralPath $devProfileScript) {
        try {
            $profileCheck = & $devProfileScript -Action check -Quiet
            if ($profileCheck -and $profileCheck.ok -eq $true) {
                $checks += Build-DoctorCheck "PG-DOC-005" "info" $true "Local dev profile check passed." "No action needed."
            }
            else {
                $missing = if ($profileCheck -and $profileCheck.missing) { (@($profileCheck.missing) -join ", ") } else { "unknown" }
                $checks += Build-DoctorCheck "PG-DOC-005" "warning" $false ("Local dev profile is incomplete: {0}" -f $missing) "Run .\\pg.ps1 dev-profile -DevProfileAction init/check/set."
            }
        }
        catch {
            $checks += Build-DoctorCheck "PG-DOC-005" "warning" $false "Local dev profile check failed." "Run .\\pg.ps1 dev-profile -DevProfileAction check."
        }
    }
    else {
        $checks += Build-DoctorCheck "PG-DOC-005" "warning" $false "dev_profile.ps1 is missing." "Restore scripts/dev_profile.ps1."
    }

    try {
        $health = Invoke-JsonGet -uri ("{0}/health" -f $apiBase) -headers @{}
        if ($health -and $health.ok -eq $true) {
            $checks += Build-DoctorCheck "PG-DOC-006" "info" $true ("Backend health OK at {0}/health" -f $apiBase) "No action needed."
        }
        else {
            $checks += Build-DoctorCheck "PG-DOC-006" "warning" $false ("Backend health endpoint returned non-ok at {0}/health" -f $apiBase) "Start backend: cd server && npm run start."
        }
    }
    catch {
        $checks += Build-DoctorCheck "PG-DOC-006" "warning" $false ("Backend health is unreachable at {0}/health" -f $apiBase) "Start backend: cd server && npm run start."
    }

    $entitlement = $null
    if (-not [string]::IsNullOrWhiteSpace($accessToken)) {
        try {
            $summary = Invoke-JsonGet -uri ("{0}/account/summary" -f $apiBase) -headers @{ Authorization = "Bearer $accessToken" }
            $recommended = Resolve-RecommendedProdProfile -plan ([string]$summary.plan) -modules @($summary.modules)
            $entitlement = Build-SummaryPayload -summary $summary -recommendedProdProfile $recommended -statePath $statePath -apiBase $apiBase
            $checks += Build-DoctorCheck "PG-DOC-007" "info" $true ("Auth token is valid (plan={0})" -f [string]$summary.plan) "No action needed."
        }
        catch {
            $checks += Build-DoctorCheck "PG-DOC-007" "blocker" $false "Auth token is invalid or expired for /account/summary." "Run .\\pg.ps1 login to refresh auth token."
            $hasBlockers = $true
        }
    }
    else {
        $checks += Build-DoctorCheck "PG-DOC-007" "blocker" $false "No access token found in args/env/state." "Run .\\pg.ps1 login first."
        $hasBlockers = $true
    }

    $warningCount = (@($checks | Where-Object { $_.ok -eq $false -and $_.severity -eq "warning" })).Count
    $blockerCount = (@($checks | Where-Object { $_.ok -eq $false -and $_.severity -eq "blocker" })).Count
    $passCount = (@($checks | Where-Object { $_.ok -eq $true })).Count

    $result = [ordered]@{
        title = "PG CLI doctor"
        status = if ($blockerCount -gt 0) { "blocked" } else { "pass" }
        api_base = $apiBase
        state_file = $statePath
        summary = @{
            total = $checks.Count
            passed = $passCount
            blockers = $blockerCount
            warnings = $warningCount
        }
        checks = $checks
        entitlement = $entitlement
    }

    if ($JsonOutput.IsPresent) {
        $result | ConvertTo-Json -Depth 12
    }
    else {
        Write-Host "PG CLI doctor status: $($result.status)"
        Write-Host ("checks: {0} | blockers: {1} | warnings: {2}" -f $checks.Count, $blockerCount, $warningCount)
        Write-Host ""
        foreach ($check in $checks) {
            $prefix = if ($check.ok) { "PASS" } else { "FAIL" }
            Write-Host ("[{0}] [{1}] {2} - {3}" -f $prefix, $check.rule_id, $check.severity, $check.message)
            if (-not $check.ok) {
                Write-Host ("  hint: {0}" -f $check.hint)
            }
        }
        if ($entitlement) {
            Write-Host ""
            Write-Host ("entitlement: plan={0} modules={1} recommended_prod_profile={2}" -f $entitlement.plan, (@($entitlement.modules) -join ","), $entitlement.recommended_prod_profile)
        }
    }

    if ($blockerCount -gt 0) {
        exit 2
    }
    exit 0
}

$statePath = if ([string]::IsNullOrWhiteSpace($StateFile)) { Get-DefaultStateFilePath } else { $StateFile }
$state = Read-State -path $statePath
$apiBaseWasProvided = $PSBoundParameters.ContainsKey("ApiBase")
$effectiveApiBase = Resolve-ApiBase -state $state -apiBaseProvided $apiBaseWasProvided -apiBaseValue $ApiBase

if ([string]::IsNullOrWhiteSpace($Email) -and $state.ContainsKey("email")) {
    $Email = [string]$state["email"]
}
if ([string]::IsNullOrWhiteSpace($InstallId) -and $state.ContainsKey("install_id")) {
    $InstallId = [string]$state["install_id"]
}
if ([string]::IsNullOrWhiteSpace($InstallId)) {
    $InstallId = "{0}-pg-cli" -f $env:COMPUTERNAME
}

switch ($Action) {
    "login" {
        $token = Resolve-AccessToken -state $state -providedToken $AccessToken
        if ([string]::IsNullOrWhiteSpace($token)) {
            if ([string]::IsNullOrWhiteSpace($Email)) {
                if ($Yes.IsPresent) {
                    throw "Email is required in non-interactive mode. Pass -Email or -AccessToken."
                }
                $Email = Read-Host "Enter account email"
            }
            if ([string]::IsNullOrWhiteSpace($Email)) {
                throw "Email is required."
            }

            $startUri = "{0}/auth/email/start" -f $effectiveApiBase
            $startResp = Invoke-JsonPost -uri $startUri -body @{ email = $Email }
            if ($startResp.PSObject.Properties.Name -contains "dev_code" -and -not [string]::IsNullOrWhiteSpace([string]$startResp.dev_code)) {
                $OtpCode = [string]$startResp.dev_code
                Write-Host "Using dev OTP code returned by server runtime."
            }
            if ([string]::IsNullOrWhiteSpace($OtpCode)) {
                if ($Yes.IsPresent) {
                    throw "OTP code is required in non-interactive mode. Pass -OtpCode or use -AccessToken."
                }
                $OtpCode = Read-Host "Enter OTP code from email"
            }
            if ([string]::IsNullOrWhiteSpace($OtpCode)) {
                throw "OTP code is required."
            }

            $verifyUri = "{0}/auth/email/verify" -f $effectiveApiBase
            $verifyResp = Invoke-JsonPost -uri $verifyUri -body @{
                email = $Email
                code = $OtpCode
                install_id = $InstallId
            }
            $token = [string]$verifyResp.access_token
        }

        if ([string]::IsNullOrWhiteSpace($token)) {
            throw "Server did not return an access token."
        }

        $summaryUri = "{0}/account/summary" -f $effectiveApiBase
        $summary = Invoke-JsonGet -uri $summaryUri -headers @{ Authorization = "Bearer $token" }
        $recommendedProdProfile = Resolve-RecommendedProdProfile -plan ([string]$summary.plan) -modules @($summary.modules)
        $resolvedEmail = if ($summary.account -and $summary.account.email) { [string]$summary.account.email } else { $Email }

        Persist-State -state $state -statePath $statePath -apiBase $effectiveApiBase -email $resolvedEmail -installId $InstallId -accessToken $token -summary $summary -recommendedProdProfile $recommendedProdProfile -action "login"
        $profileIssues = Sync-DevProfile -apiBase $effectiveApiBase -summary $summary -recommendedProdProfile $recommendedProdProfile -statePath $statePath

        $payload = Build-SummaryPayload -summary $summary -recommendedProdProfile $recommendedProdProfile -statePath $statePath -apiBase $effectiveApiBase
        $payload["title"] = "PG CLI login completed."
        $payload["status"] = "ok"
        $payload["profile_sync_issues"] = $profileIssues
        Show-LifecycleResult -payload $payload -JsonOutput:$Json
        exit 0
    }
    "update" {
        $token = Resolve-AccessToken -state $state -providedToken $AccessToken
        if ([string]::IsNullOrWhiteSpace($token)) {
            throw "No access token available. Run .\pg.ps1 login first."
        }
        if ([string]::IsNullOrWhiteSpace($Email) -and $state.ContainsKey("email")) {
            $Email = [string]$state["email"]
        }
        if ([string]::IsNullOrWhiteSpace($Email)) {
            $Email = "unknown"
        }

        $previousPlan = if ($state.ContainsKey("plan")) { [string]$state["plan"] } else { "" }
        $previousProfile = if ($state.ContainsKey("recommended_prod_profile")) { [string]$state["recommended_prod_profile"] } else { "" }
        $previousModules = if ($state.ContainsKey("modules")) { @($state["modules"]) } else { @() }

        $summaryUri = "{0}/account/summary" -f $effectiveApiBase
        $summary = Invoke-JsonGet -uri $summaryUri -headers @{ Authorization = "Bearer $token" }
        $recommendedProdProfile = Resolve-RecommendedProdProfile -plan ([string]$summary.plan) -modules @($summary.modules)
        $resolvedEmail = if ($summary.account -and $summary.account.email) { [string]$summary.account.email } else { $Email }

        Persist-State -state $state -statePath $statePath -apiBase $effectiveApiBase -email $resolvedEmail -installId $InstallId -accessToken $token -summary $summary -recommendedProdProfile $recommendedProdProfile -action "update"
        $profileIssues = Sync-DevProfile -apiBase $effectiveApiBase -summary $summary -recommendedProdProfile $recommendedProdProfile -statePath $statePath

        $currentModules = @($summary.modules | ForEach-Object { [string]$_ })
        $moduleChanged = ((@($previousModules) -join ",") -ne ($currentModules -join ","))
        $changes = @()
        if ($previousPlan -ne [string]$summary.plan) {
            $changes += ("plan:{0}->{1}" -f (if ($previousPlan) { $previousPlan } else { "(none)" }), [string]$summary.plan)
        }
        if ($moduleChanged) {
            $changes += ("modules:{0}->{1}" -f (@($previousModules) -join ","), ($currentModules -join ","))
        }
        if ($previousProfile -ne $recommendedProdProfile) {
            $changes += ("prod_profile:{0}->{1}" -f (if ($previousProfile) { $previousProfile } else { "(none)" }), $recommendedProdProfile)
        }

        $payload = Build-SummaryPayload -summary $summary -recommendedProdProfile $recommendedProdProfile -statePath $statePath -apiBase $effectiveApiBase
        $payload["title"] = "PG CLI profile update completed."
        $payload["status"] = "ok"
        $payload["changes"] = $changes
        $payload["profile_sync_issues"] = $profileIssues
        Show-LifecycleResult -payload $payload -JsonOutput:$Json
        if (-not $Json.IsPresent) {
            if ($changes.Count -gt 0) {
                Write-Host "- changes: $($changes -join "; ")"
            }
            else {
                Write-Host "- changes: none"
            }
        }
        exit 0
    }
    "doctor" {
        $token = Resolve-AccessToken -state $state -providedToken $AccessToken
        Run-Doctor -state $state -statePath $statePath -apiBase $effectiveApiBase -accessToken $token -JsonOutput:$Json
    }
    default {
        throw "Unsupported action '$Action'."
    }
}
