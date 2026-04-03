param(
    [ValidateSet("init", "start-role", "stop-role", "status", "summary", "next", "ready", "complete", "watch", "export", "report", "respond", "open-page")]
    [string]$Action = "summary",
    [ValidateSet("", "backend", "frontend")]
    [string]$Role = "",
    [string]$StepId = "",
    [string]$PageId = "",
    [string]$Kind = "",
    [string]$Resolution = "",
    [string]$AgentId = "",
    [string]$AgentFamily = "copilot",
    [string]$ModelName = "GPT-5.4",
    [string]$SessionMode = "interactive",
    [string]$ApiBase = "http://127.0.0.1:8787",
    [string]$AccessToken = "",
    [string]$StateFile = "",
    [ValidateRange(2, 3600)]
    [int]$PollSeconds = 30,
    [string[]]$ChangedPath = @(),
    [string]$Title = "",
    [string]$Details = "",
    [switch]$Persistent,
    [switch]$Once,
    [switch]$Json,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$MemoryBankRoot = Join-Path $RepoRoot "Memory-bank"
$IntegrationDir = Join-Path $MemoryBankRoot "frontend-integration"
$PagesDir = Join-Path $IntegrationDir "pages"
$EvidenceDir = Join-Path $IntegrationDir "evidence"
$ExportsDir = Join-Path $IntegrationDir "exports"
$HandoffsDir = Join-Path $IntegrationDir "handoffs"
$SummaryPath = Join-Path $MemoryBankRoot "frontend-integration.md"
$StatePath = Join-Path $IntegrationDir "state.json"
$RuntimeStatePath = Join-Path $MemoryBankRoot "_generated\frontend-integration-runtime.json"
$SelfCheckSummaryPath = Join-Path $MemoryBankRoot "_generated\self-check-latest.json"
$MaxIntegrationPageLines = 500
$ResolvedApiBase = $ApiBase.TrimEnd('/')
$script:CurrentWorkerLease = $null
$script:CurrentIntegrationPolicy = $null

function Convert-PlainToProtected {
    param([string]$PlainText)

    $secure = ConvertTo-SecureString -String $PlainText -AsPlainText -Force
    return ConvertFrom-SecureString -SecureString $secure
}

function Convert-ProtectedToPlain {
    param([string]$CipherText)

    $secure = ConvertTo-SecureString -String $CipherText
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        if ($ptr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        }
    }
}

function Get-DefaultCliStateFilePath {
    return (Join-Path $MemoryBankRoot "_generated\pg-cli-state.json")
}

function ConvertFrom-JsonCompat {
    param([string]$JsonText)

    if ([string]::IsNullOrWhiteSpace($JsonText)) {
        return $null
    }
    return ($JsonText | ConvertFrom-Json)
}

function Copy-JsonObject {
    param([object]$Value)

    if ($null -eq $Value) {
        return $null
    }
    return (ConvertFrom-JsonCompat -JsonText ($Value | ConvertTo-Json -Depth 30))
}

function Resolve-AccessToken {
    param(
        [string]$Provided,
        [string]$ResolvedStateFile
    )

    if (-not [string]::IsNullOrWhiteSpace($Provided)) {
        return $Provided
    }
    if (-not [string]::IsNullOrWhiteSpace($env:PG_ACCESS_TOKEN)) {
        return [string]$env:PG_ACCESS_TOKEN
    }
    if (-not [string]::IsNullOrWhiteSpace($ResolvedStateFile) -and (Test-Path -LiteralPath $ResolvedStateFile)) {
        try {
            $state = ConvertFrom-JsonCompat -JsonText (Get-Content -LiteralPath $ResolvedStateFile -Raw -Encoding utf8)
            if ($state.access_token) {
                return [string]$state.access_token
            }
        }
        catch {
        }
    }
    return ""
}

function Get-RepoKey {
    $normalized = $RepoRoot.ToLowerInvariant()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
        $hash = $sha.ComputeHash($bytes)
        return ((-join ($hash | ForEach-Object { $_.ToString("x2") })).Substring(0, 16))
    }
    finally {
        $sha.Dispose()
    }
}

$ResolvedStateFile = if ($StateFile) { $StateFile } else { Get-DefaultCliStateFilePath }
$ResolvedAccessToken = Resolve-AccessToken -Provided $AccessToken -ResolvedStateFile $ResolvedStateFile
$UseServerMode = -not [string]::IsNullOrWhiteSpace($ResolvedAccessToken)
$RepoKey = Get-RepoKey

function Get-UtcNowString {
    return (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

function Get-UtcNowDisplayString {
    return (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm")
}

function ConvertTo-UtcDisplayValue {
    param([object]$Value)

    if ($null -eq $Value) {
        return ""
    }
    if ($Value -is [DateTime]) {
        return $Value.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
    return [string]$Value
}

function ConvertTo-RelativeRepoPath {
    param([string]$PathValue)

    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return ""
    }
    $resolved = $PathValue
    try {
        if (Test-Path -LiteralPath $PathValue) {
            $resolved = (Resolve-Path -LiteralPath $PathValue).Path
        }
    }
    catch {
        $resolved = $PathValue
    }

    if ($resolved.StartsWith($RepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $resolved.Substring($RepoRoot.Length).TrimStart(@('\', '/')).Replace("\\", "/")
    }
    return $resolved.Replace("\", "/")
}

function Ensure-Directory {
    param([string]$PathValue)

    if (-not (Test-Path -LiteralPath $PathValue)) {
        New-Item -ItemType Directory -Path $PathValue -Force | Out-Null
    }
}

function Test-IgnoredPath {
    param([string]$FullName)

    $normalized = $FullName.Replace("/", "\\")
    $ignoredSegments = @(
        "\\.git\\",
        "\\node_modules\\",
        "\\dist\\",
        "\\build\\",
        "\\coverage\\",
        "\\target\\",
        "\\.next\\",
        "\\.venv\\",
        "\\venv\\",
        "\\Memory-bank\\",
        "\\logs\\",
        "\\__pycache__\\"
    )
    foreach ($segment in $ignoredSegments) {
        if ($normalized -like "*$segment*") {
            return $true
        }
    }
    return $false
}

function ConvertTo-TitleCaseWords {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return "Integration"
    }
    $parts = ($Value -replace "[_\-.]+", " ").Trim() -split "\s+"
    $textInfo = [System.Globalization.CultureInfo]::InvariantCulture.TextInfo
    return ($parts | Where-Object { $_ } | ForEach-Object { $textInfo.ToTitleCase($_.ToLowerInvariant()) }) -join " "
}

function ConvertTo-PageSlug {
    param([string]$Name)

    $slug = ($Name.ToLowerInvariant() -replace "[^a-z0-9]+", "-").Trim("-")
    if ([string]::IsNullOrWhiteSpace($slug)) {
        return "integration"
    }
    return $slug
}

function Get-PageShortSlug {
    param([string]$Name)

    $slug = ConvertTo-PageSlug -Name $Name
    switch -Regex ($slug) {
        "(^|-)login$|(^|-)signin$|(^|-)auth($|-)" { return "login" }
        "dashboard|portal|app" { return "dashboard" }
        "profile|account" { return "profile" }
        "settings|preferences" { return "settings" }
        default { return $slug }
    }
}

function Get-PageId {
    param(
        [int]$Index,
        [string]$Name
    )

    $shortSlug = Get-PageShortSlug -Name $Name
    if ($shortSlug -eq "login") {
        return ("{0:D2}-auth-login" -f $Index)
    }
    return ("{0:D2}-{1}" -f $Index, $shortSlug)
}

function Get-PageFileRelativePath {
    param(
        [int]$Index,
        [string]$Name
    )

    $shortSlug = Get-PageShortSlug -Name $Name
    return ("Memory-bank/frontend-integration/pages/{0:D2}-{1}.md" -f $Index, $shortSlug)
}

function Get-PageDisplayNameFromFile {
    param([System.IO.FileInfo]$File)

    $baseName = $File.BaseName
    if ($baseName -ieq "page") {
        return (ConvertTo-TitleCaseWords -Value $File.Directory.Name)
    }
    if ($baseName -ieq "app") {
        return "Dashboard"
    }
    if ($baseName -match "login|signin|auth") {
        return "Login"
    }
    if ($baseName -match "dashboard|portal") {
        return "Dashboard"
    }
    return (ConvertTo-TitleCaseWords -Value $baseName)
}

function Get-PageSeedNames {
    $discovered = [System.Collections.Generic.Dictionary[string, string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $files = Get-ChildItem -Path $RepoRoot -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { -not (Test-IgnoredPath -FullName $_.FullName) }

    foreach ($file in $files) {
        $relative = ConvertTo-RelativeRepoPath -PathValue $file.FullName
        $lowerRelative = $relative.ToLowerInvariant()
        $include = $false
        if ($file.Extension -in @(".tsx", ".jsx", ".ts", ".js") -and $file.Name -match "^page\.(tsx|jsx|ts|js)$") {
            $include = $true
        }
        elseif ($file.Name -match "screen" -and $file.Extension -in @(".tsx", ".jsx", ".kt", ".swift", ".ts", ".js")) {
            $include = $true
        }
        elseif ($file.Extension -eq ".html" -and $lowerRelative.StartsWith("server/public/")) {
            $include = $true
        }

        if (-not $include) {
            continue
        }

        $displayName = Get-PageDisplayNameFromFile -File $file
        if ($displayName -in @("Terms", "Privacy", "Checkout Status", "Oauth Callback")) {
            continue
        }
        $key = (Get-PageShortSlug -Name $displayName)
        if (-not $discovered.ContainsKey($key)) {
            $discovered[$key] = $displayName
        }
    }

    if (-not $discovered.ContainsKey("login")) {
        $discovered["login"] = "Login"
    }
    if (-not $discovered.ContainsKey("dashboard")) {
        $discovered["dashboard"] = "Dashboard"
    }

    $ordered = $discovered.Values | Sort-Object {
        $slug = Get-PageShortSlug -Name $_
        switch ($slug) {
            "login" { 10 }
            "dashboard" { 20 }
            "profile" { 30 }
            "settings" { 40 }
            "help" { 50 }
            "pricing" { 60 }
            default { 100 }
        }
    }, { $_ }

    return @($ordered | Select-Object -First 12)
}

function Get-IntegrationSources {
    $openApiPatterns = @("openapi*.yml", "openapi*.yaml", "openapi*.json", "swagger*.yml", "swagger*.yaml", "swagger*.json")
    $postmanPatterns = @("*.postman_collection.json")
    $openApiFiles = [System.Collections.Generic.List[string]]::new()
    $postmanFiles = [System.Collections.Generic.List[string]]::new()

    foreach ($pattern in $openApiPatterns) {
        $matches = Get-ChildItem -Path $RepoRoot -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue |
            Where-Object { -not (Test-IgnoredPath -FullName $_.FullName) }
        foreach ($match in $matches) {
            $relative = ConvertTo-RelativeRepoPath -PathValue $match.FullName
            if (-not $openApiFiles.Contains($relative)) {
                $openApiFiles.Add($relative)
            }
        }
    }

    foreach ($pattern in $postmanPatterns) {
        $matches = Get-ChildItem -Path $RepoRoot -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue |
            Where-Object { -not (Test-IgnoredPath -FullName $_.FullName) }
        foreach ($match in $matches) {
            $relative = ConvertTo-RelativeRepoPath -PathValue $match.FullName
            if (-not $postmanFiles.Contains($relative)) {
                $postmanFiles.Add($relative)
            }
        }
    }

    return @{
        openapi_files = @($openApiFiles)
        postman_files = @($postmanFiles)
    }
}

function Get-SourceMode {
    param([hashtable]$Sources)

    if ($Sources.openapi_files.Count -gt 0) {
        return "openapi"
    }
    if ($Sources.postman_files.Count -gt 0) {
        return "postman"
    }
    return "backend-inference"
}

function New-AgentRecord {
    param([string]$AgentRole)

    $now = Get-UtcNowString
    $resolvedAgentId = $AgentId
    if ([string]::IsNullOrWhiteSpace($resolvedAgentId)) {
        $resolvedAgentId = "{0}-{1}-{2}-main" -f $AgentRole, $AgentFamily, ($ModelName.ToLowerInvariant() -replace "[^a-z0-9]+", "-")
        $resolvedAgentId = $resolvedAgentId.Trim("-")
    }

    return [ordered]@{
        agent_id = $resolvedAgentId
        role = $AgentRole
        agent_family = $AgentFamily
        model_name = $ModelName
        session_mode = $SessionMode
        status = "active"
        started_at_utc = $now
        last_heartbeat_utc = $now
        last_poll_utc = $now
    }
}

function New-PageRecord {
    param(
        [int]$Index,
        [string]$Name,
        [hashtable]$Sources
    )

    $now = Get-UtcNowString
    $pageId = Get-PageId -Index $Index -Name $Name
    $pageFile = Get-PageFileRelativePath -Index $Index -Name $Name
    $sourceMode = Get-SourceMode -Sources $Sources

    return [ordered]@{
        page_id = $pageId
        page_name = $Name
        page_file = $pageFile
        status = "planned"
        owner_role = ""
        owner_agent_id = ""
        source_mode = $sourceMode
        source_refs = @($Sources.openapi_files + $Sources.postman_files)
        backend = [ordered]@{
            summary = ""
            endpoints = @()
            auth_requirements = @()
            headers = @()
            query_params = @()
            request_examples = @()
            response_examples = @()
            error_examples = @()
            db_verification_note = ""
            smoke_status = "pending"
            smoke_note = ""
            frontend_instructions = ""
            ui_notes = ""
            credentials = [ordered]@{
                auth_mode = "unknown"
                test_accounts = @()
                headers = @()
                required_secrets_present = $false
                tested_successfully = $false
                notes = ""
            }
        }
        frontend = [ordered]@{
            summary = ""
            changed_files = @()
            route_mapping_confirmed = $false
            playwright_status = "pending"
            screenshot_paths = @()
            limitations = @()
        }
        handoff = [ordered]@{
            findings = @()
            responses = @()
            frontend_finding_status = "none"
            backend_response_status = "none"
            current_kind = ""
            resolution = ""
        }
        developer_actions = @()
        known_blockers = @()
        validation = [ordered]@{
            frontend_page_line_count = 0
            frontend_page_line_limit = $MaxIntegrationPageLines
            trust_status = "pending"
            self_check_status = "pending"
        }
        timestamps = [ordered]@{
            created_at_utc = $now
            updated_at_utc = $now
            ready_at_utc = ""
            completed_at_utc = ""
        }
    }
}

function Get-PageEvidenceSeed {
    param([object]$Page)

    $pageName = [string]$Page.page_name
    $pageSlug = Get-PageShortSlug -Name $pageName
    $sourceRefs = @($Page.source_refs | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
    $sourceNote = if ($sourceRefs.Count -gt 0) {
        "Primary source refs: {0}." -f (($sourceRefs | Select-Object -First 3) -join ", ")
    }
    else {
        "No OpenAPI or Postman refs were detected yet; start from the live backend route surface and captured responses."
    }

    switch ($pageSlug) {
        "login" {
            return [ordered]@{
                summary = "Login flow seeded from the local portal auth endpoints. $sourceNote"
                endpoints = @(
                    "POST /auth/email/start issues a login code for the submitted email address.",
                    "POST /auth/email/verify exchanges email, code, and install_id for a session token.",
                    "POST /auth/session/signout expires the current session token and clears the local sign-in state."
                )
                auth_requirements = @(
                    "Enable ENABLE_EMAIL_OTP=true for local email-login verification.",
                    "Enable EXPOSE_DEV_OTP_CODE=true only when you need the local dev_code shortcut for smoke or manual testing.",
                    "GitHub and Google sign-in still require provider credentials and callback configuration."
                )
                headers = @(
                    "Content-Type: application/json for email start and verify requests."
                )
                query_params = @()
                request_examples = @(
                    'POST /auth/email/start -> { "email": "smoke-auth@example.com" }',
                    'POST /auth/email/verify -> { "email": "smoke-auth@example.com", "code": "123456", "install_id": "web-smoke-auth" }'
                )
                response_examples = @(
                    '/auth/email/start returns { "status": "code_sent", "email": "...", "expires_at": "..." } and optional dev_code in local smoke mode.',
                    '/auth/email/verify returns { "access_token": "...", "expires_in_sec": ..., "user_id": "..." }.'
                )
                error_examples = @(
                    "/auth/email/start returns 400 when email is missing.",
                    "/auth/email/verify returns 400 for missing or expired codes and 401 for invalid codes."
                )
                db_verification_note = "Auth challenges are stored in auth_challenges; successful verification creates a sessions record and updates users.last_login_at."
                smoke_status = "pending"
                smoke_note = "Mandatory Playwright smoke now covers the local portal email-auth flow on the dedicated smoke server."
                frontend_instructions = "Wire the login UI to the existing email start and verify flow first, then preserve OAuth entry points as optional alternatives."
                ui_notes = "Keep distinct send-code, verify-code, signed-in, invalid-code, and expired-code states visible to the developer and user."
                credentials = [ordered]@{
                    auth_mode = "email-otp|oauth"
                    test_accounts = @(
                        "Use any local test email for the baseline auth smoke flow.",
                        "Use an email listed in SUPER_ADMIN_EMAILS or ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS when admin access also needs validation."
                    )
                    headers = @()
                    required_secrets_present = $false
                    tested_successfully = $false
                    notes = "Local smoke does not require external mail delivery when dev_code exposure is enabled."
                }
                developer_actions = @(
                    "Set ENABLE_EMAIL_OTP=true in server/.env before local auth verification.",
                    "Enable EXPOSE_DEV_OTP_CODE=true only for local-only shortcut testing when needed."
                )
            }
        }
        "dashboard" {
            return [ordered]@{
                summary = "Dashboard seed is based on the signed-in portal overview and account-summary routes. $sourceNote"
                endpoints = @(
                    "GET /account/summary returns account, plan, quota, governance, team, and admin-access data for the signed-in user.",
                    "GET /entitlement/status returns the signed entitlement claims for the active install.",
                    "POST /devices/list returns the device records associated with the signed-in account."
                )
                auth_requirements = @(
                    "Requires an active session cookie or bearer token from the login flow.",
                    "Admin and team controls appear conditionally based on account summary permissions."
                )
                headers = @(
                    "Authorization: Bearer <access_token> for direct API verification when not using the portal session cookie."
                )
                query_params = @()
                request_examples = @(
                    "GET /account/summary with the session created by /auth/email/verify.",
                    "GET /entitlement/status after sign-in to confirm plan and feature claims."
                )
                response_examples = @(
                    '/account/summary returns { "ok": true, "account": { "email": "..." }, "plan": "..." } plus quota, governance, team, and admin flags.',
                    '/entitlement/status returns { "entitlement_token": "...", "claims": { ... } }.'
                )
                error_examples = @(
                    "/account/summary returns 401 when the session or bearer token is missing.",
                    "Protected dashboard actions should surface permission-based 401 or 403 responses when the signed-in account lacks access."
                )
                db_verification_note = "Account summary reads from users, subscriptions, trials, project_quotas, devices, team_memberships, and related admin-access records."
                smoke_status = "pending"
                smoke_note = "Use the authenticated session created during smoke to validate the portal overview and summary payloads."
                frontend_instructions = "After sign-in, verify the overview panel, profile header, and conditional nav state against /account/summary before marking the page ready."
                ui_notes = "Capture signed-out, loading, signed-in, team-enabled, and admin-enabled states for the overview shell."
                credentials = [ordered]@{
                    auth_mode = "session-or-bearer"
                    test_accounts = @(
                        "Use the same local email auth account created during the login smoke flow.",
                        "For admin-nav coverage, sign in with a local email that is listed in SUPER_ADMIN_EMAILS or ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS."
                    )
                    headers = @(
                        "Authorization: Bearer <access_token> for direct API checks when bypassing the browser session."
                    )
                    required_secrets_present = $false
                    tested_successfully = $false
                    notes = "Dashboard smoke depends on a successful login flow first."
                }
                developer_actions = @(
                    "Complete the local login flow before validating dashboard and account-summary behavior."
                )
            }
        }
        default {
            return [ordered]@{
                summary = "$pageName seeded from the current integration scaffolding. $sourceNote"
                endpoints = @(
                    "Record the concrete routes this page calls before marking it ready_for_frontend."
                )
                auth_requirements = @(
                    "Confirm whether this page is public or requires an existing session before frontend wiring."
                )
                headers = @()
                query_params = @()
                request_examples = @(
                    "Capture at least one representative request payload for $pageName during backend verification."
                )
                response_examples = @(
                    "Capture at least one representative response payload for $pageName during backend verification."
                )
                error_examples = @(
                    "Capture the expected validation, empty, and server-error responses for $pageName during backend verification."
                )
                db_verification_note = "Add the tables or store records touched by $pageName when backend verification is complete."
                smoke_status = "pending"
                smoke_note = "Use the mandatory smoke suite as baseline, then attach page-specific browser proof when this page is handed off."
                frontend_instructions = "Map the UI route and API calls for $pageName, then attach smoke evidence before completion."
                ui_notes = "Record loading, empty, success, and error states for $pageName."
                credentials = [ordered]@{
                    auth_mode = "unknown"
                    test_accounts = @()
                    headers = @()
                    required_secrets_present = $false
                    tested_successfully = $false
                    notes = $sourceNote
                }
                developer_actions = @()
            }
        }
    }
}

function Apply-PageEvidenceSeed {
    param([object]$Page)

    if ($null -eq $Page.backend.error_examples) {
        $Page.backend | Add-Member -NotePropertyName error_examples -NotePropertyValue @()
    }
    if ($null -eq $Page.backend.credentials.headers) {
        $Page.backend.credentials | Add-Member -NotePropertyName headers -NotePropertyValue @()
    }

    $seed = Get-PageEvidenceSeed -Page $Page

    if ([string]::IsNullOrWhiteSpace([string]$Page.backend.summary)) { $Page.backend.summary = $seed.summary }
    if (@($Page.backend.endpoints).Count -eq 0) { $Page.backend.endpoints = @($seed.endpoints) }
    if (@($Page.backend.auth_requirements).Count -eq 0) { $Page.backend.auth_requirements = @($seed.auth_requirements) }
    if (@($Page.backend.headers).Count -eq 0) { $Page.backend.headers = @($seed.headers) }
    if (@($Page.backend.query_params).Count -eq 0) { $Page.backend.query_params = @($seed.query_params) }
    if (@($Page.backend.request_examples).Count -eq 0) { $Page.backend.request_examples = @($seed.request_examples) }
    if (@($Page.backend.response_examples).Count -eq 0) { $Page.backend.response_examples = @($seed.response_examples) }
    if (@($Page.backend.error_examples).Count -eq 0) { $Page.backend.error_examples = @($seed.error_examples) }
    if ([string]::IsNullOrWhiteSpace([string]$Page.backend.db_verification_note)) { $Page.backend.db_verification_note = $seed.db_verification_note }
    if ($Page.backend.smoke_status -eq "pending" -and -not [string]::IsNullOrWhiteSpace([string]$seed.smoke_status)) { $Page.backend.smoke_status = $seed.smoke_status }
    if ([string]::IsNullOrWhiteSpace([string]$Page.backend.smoke_note)) { $Page.backend.smoke_note = $seed.smoke_note }
    if ([string]::IsNullOrWhiteSpace([string]$Page.backend.frontend_instructions)) { $Page.backend.frontend_instructions = $seed.frontend_instructions }
    if ([string]::IsNullOrWhiteSpace([string]$Page.backend.ui_notes)) { $Page.backend.ui_notes = $seed.ui_notes }
    if ([string]::IsNullOrWhiteSpace([string]$Page.backend.credentials.auth_mode) -or [string]$Page.backend.credentials.auth_mode -eq "unknown") { $Page.backend.credentials.auth_mode = $seed.credentials.auth_mode }
    if (@($Page.backend.credentials.test_accounts).Count -eq 0) { $Page.backend.credentials.test_accounts = @($seed.credentials.test_accounts) }
    if (@($Page.backend.credentials.headers).Count -eq 0) { $Page.backend.credentials.headers = @($seed.credentials.headers) }
    if ([string]::IsNullOrWhiteSpace([string]$Page.backend.credentials.notes)) { $Page.backend.credentials.notes = $seed.credentials.notes }
    if (@($Page.developer_actions).Count -eq 0) { $Page.developer_actions = @($seed.developer_actions) }
}

function Apply-StateEvidenceSeeds {
    param([object]$State)

    foreach ($page in @($State.pages)) {
        Apply-PageEvidenceSeed -Page $page
    }
}

function New-InitialState {
    $sources = Get-IntegrationSources
    $pageNames = Get-PageSeedNames
    $pages = @()
    $index = 1
    foreach ($pageName in $pageNames) {
        $pages += New-PageRecord -Index $index -Name $pageName -Sources $sources
        $index += 1
    }

    $now = Get-UtcNowString
    return [ordered]@{
        version = 2
        project_root = $RepoRoot.Replace("\", "/")
        last_updated_utc = $now
        backend_agent = [ordered]@{
            agent_id = ""
            role = "backend"
            agent_family = ""
            model_name = ""
            session_mode = ""
            status = "idle"
            started_at_utc = ""
            last_heartbeat_utc = ""
            last_poll_utc = ""
        }
        frontend_agent = [ordered]@{
            agent_id = ""
            role = "frontend"
            agent_family = ""
            model_name = ""
            session_mode = ""
            status = "idle"
            started_at_utc = ""
            last_heartbeat_utc = ""
            last_poll_utc = ""
        }
        sources = [ordered]@{
            openapi_files = @($sources.openapi_files)
            postman_files = @($sources.postman_files)
        }
        summary = [ordered]@{
            poll_seconds = $PollSeconds
            pending_backend_corrections = 0
            pending_developer_actions = 0
            completed_pages = 0
            ready_for_frontend = 0
            latest_activity = @("[$(Get-UtcNowDisplayString)] integration-init scaffolded the shared frontend/backend ledger.")
        }
        pages = @($pages)
    }
}

function New-RuntimeState {
    return [ordered]@{
        version = 2
        backend = [ordered]@{
            stop_requested = $false
            final_status = "stopped"
            requested_at_utc = ""
            requested_by = ""
        }
        frontend = [ordered]@{
            stop_requested = $false
            final_status = "stopped"
            requested_at_utc = ""
            requested_by = ""
        }
    }
}

function Ensure-RuntimeDefaults {
    param([object]$RuntimeState)

    if ($null -eq $RuntimeState) {
        return New-RuntimeState
    }

    foreach ($runtimeRole in @("backend", "frontend")) {
        if ($null -eq $RuntimeState.$runtimeRole) {
            $RuntimeState | Add-Member -NotePropertyName $runtimeRole -NotePropertyValue ([ordered]@{
                stop_requested = $false
                final_status = "stopped"
                requested_at_utc = ""
                requested_by = ""
            })
        }
        if ($null -eq $RuntimeState.$runtimeRole.stop_requested) {
            $RuntimeState.$runtimeRole | Add-Member -NotePropertyName stop_requested -NotePropertyValue $false
        }
        if (-not $RuntimeState.$runtimeRole.PSObject.Properties.Name.Contains("final_status")) {
            $RuntimeState.$runtimeRole | Add-Member -NotePropertyName final_status -NotePropertyValue "stopped"
        }
        elseif ([string]::IsNullOrWhiteSpace([string]$RuntimeState.$runtimeRole.final_status)) {
            $RuntimeState.$runtimeRole.final_status = "stopped"
        }
        if (-not $RuntimeState.$runtimeRole.PSObject.Properties.Name.Contains("requested_at_utc")) {
            $RuntimeState.$runtimeRole | Add-Member -NotePropertyName requested_at_utc -NotePropertyValue ""
        }
        if (-not $RuntimeState.$runtimeRole.PSObject.Properties.Name.Contains("requested_by")) {
            $RuntimeState.$runtimeRole | Add-Member -NotePropertyName requested_by -NotePropertyValue ""
        }
    }

    return $RuntimeState
}

function New-RuntimeEnvelope {
    param([object]$RuntimeState)

    $normalizedRuntimeState = Ensure-RuntimeDefaults -RuntimeState $RuntimeState
    $payloadJson = $normalizedRuntimeState | ConvertTo-Json -Depth 10 -Compress
    return [ordered]@{
        version = 2
        state_kind = "frontend-integration-runtime"
        storage_mode = "dpapi-securestring"
        repo_key = $RepoKey
        updated_at_utc = Get-UtcNowString
        protected_payload = Convert-PlainToProtected -PlainText $payloadJson
    }
}

function Get-RedactedDetailNotice {
    return "Protected in authenticated server-backed mode. Use authenticated integration commands while connected to the local server to refresh or act on this detail."
}

function Get-RedactedListSummary {
    param(
        [object[]]$Items,
        [string]$Label
    )

    $count = @($Items).Count
    if ($count -le 0) {
        return @()
    }
    return @("Protected {0} count: {1}" -f $Label, $count)
}

function Get-LocalProjectionState {
    param([object]$State)

    $projection = Copy-JsonObject -Value $State
    if (-not $UseServerMode -or $null -eq $projection) {
        return $projection
    }

    $detailNotice = Get-RedactedDetailNotice
    foreach ($page in @($projection.pages)) {
        $page.source_refs = @()
        $page.backend.summary = "Protected server-backed detail exists for this page."
        $page.backend.endpoints = @()
        $page.backend.auth_requirements = @()
        $page.backend.headers = @()
        $page.backend.query_params = @()
        $page.backend.request_examples = @()
        $page.backend.response_examples = @()
        $page.backend.error_examples = @()
        $page.backend.db_verification_note = $detailNotice
        $page.backend.smoke_note = $detailNotice
        $page.backend.frontend_instructions = $detailNotice
        $page.backend.ui_notes = $detailNotice
        $page.backend.credentials.auth_mode = "protected"
        $page.backend.credentials.test_accounts = @()
        $page.backend.credentials.headers = @()
        $page.backend.credentials.notes = $detailNotice
        $page.developer_actions = Get-RedactedListSummary -Items @($page.developer_actions) -Label "developer action"
        $page.known_blockers = Get-RedactedListSummary -Items @($page.known_blockers) -Label "known blocker"
        $page.handoff.findings = Get-RedactedListSummary -Items @($page.handoff.findings) -Label "frontend finding"
        $page.handoff.responses = Get-RedactedListSummary -Items @($page.handoff.responses) -Label "backend response"
    }

    if (-not $projection.summary.PSObject.Properties.Name.Contains("local_detail_mode")) {
        $projection.summary | Add-Member -NotePropertyName local_detail_mode -NotePropertyValue "redacted"
    }
    else {
        $projection.summary.local_detail_mode = "redacted"
    }
    return $projection
}

function Ensure-StateDefaults {
    param([object]$State)

    if ($null -eq $State) {
        return New-InitialState
    }
    if ($null -eq $State.sources) {
        $State | Add-Member -NotePropertyName sources -NotePropertyValue ([ordered]@{ openapi_files = @(); postman_files = @() })
    }
    if ($null -eq $State.summary) {
        $State | Add-Member -NotePropertyName summary -NotePropertyValue ([ordered]@{})
    }
    if ($null -eq $State.summary.latest_activity) {
        $State.summary | Add-Member -NotePropertyName latest_activity -NotePropertyValue @()
    }
    if ($null -eq $State.pages -or $State.pages.Count -eq 0) {
        $newState = New-InitialState
        $State.pages = $newState.pages
        $State.sources = $newState.sources
    }
    Apply-StateEvidenceSeeds -State $State
    return $State
}

function Load-State {
    if (-not (Test-Path -LiteralPath $StatePath)) {
        return (New-InitialState)
    }
    $raw = Get-Content -LiteralPath $StatePath -Raw -Encoding utf8
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return (New-InitialState)
    }
    $state = ConvertFrom-JsonCompat -JsonText $raw
    return (Ensure-StateDefaults -State $state)
}

function Load-RuntimeState {
    if (-not (Test-Path -LiteralPath $RuntimeStatePath)) {
        return (New-RuntimeState)
    }
    $raw = Get-Content -LiteralPath $RuntimeStatePath -Raw -Encoding utf8
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return (New-RuntimeState)
    }
    $runtimeStateEnvelope = ConvertFrom-JsonCompat -JsonText $raw
    if ($null -ne $runtimeStateEnvelope -and $runtimeStateEnvelope.PSObject.Properties.Name.Contains("protected_payload")) {
        try {
            if ($runtimeStateEnvelope.repo_key -and [string]$runtimeStateEnvelope.repo_key -ne $RepoKey) {
                throw "Runtime state repo key mismatch."
            }
            $plainJson = Convert-ProtectedToPlain -CipherText ([string]$runtimeStateEnvelope.protected_payload)
            $runtimeState = ConvertFrom-JsonCompat -JsonText $plainJson
            return (Ensure-RuntimeDefaults -RuntimeState $runtimeState)
        }
        catch {
            throw "Frontend integration runtime control state is unreadable or has been tampered with. Remove $RuntimeStatePath only if you intend to reset worker control state."
        }
    }
    return (Ensure-RuntimeDefaults -RuntimeState $runtimeStateEnvelope)
}

function Save-RuntimeState {
    param([object]$RuntimeState)

    Ensure-Directory -PathValue $MemoryBankRoot
    Ensure-Directory -PathValue (Join-Path $MemoryBankRoot "_generated")
    $runtimeStateEnvelope = New-RuntimeEnvelope -RuntimeState $RuntimeState
    ($runtimeStateEnvelope | ConvertTo-Json -Depth 10) | Set-Content -LiteralPath $RuntimeStatePath -Encoding utf8
}

function Update-RuntimeStateForRole {
    param(
        [string]$AgentRole,
        [scriptblock]$Mutator
    )

    $mutexName = "PG-FrontendIntegrationRuntime-$RepoKey"
    $mutex = [System.Threading.Mutex]::new($false, $mutexName)
    $lockTaken = $false
    try {
        $lockTaken = $mutex.WaitOne(10000)
        if (-not $lockTaken) {
            throw "Timed out while waiting for the integration runtime-state lock."
        }
        $runtimeState = Load-RuntimeState
        & $Mutator $runtimeState $runtimeState.$AgentRole
        Save-RuntimeState -RuntimeState $runtimeState
        return $runtimeState
    }
    finally {
        if ($lockTaken) {
            $mutex.ReleaseMutex() | Out-Null
        }
        $mutex.Dispose()
    }
}

function Set-RoleStopRequest {
    param(
        [object]$RuntimeState,
        [string]$AgentRole,
        [string]$FinalStatus,
        [string]$RequestedBy
    )

    $RuntimeState.$AgentRole.stop_requested = $true
    $RuntimeState.$AgentRole.final_status = $FinalStatus
    $RuntimeState.$AgentRole.requested_at_utc = Get-UtcNowString
    $RuntimeState.$AgentRole.requested_by = $RequestedBy
}

function Clear-RoleStopRequest {
    param(
        [object]$RuntimeState,
        [string]$AgentRole
    )

    $RuntimeState.$AgentRole.stop_requested = $false
    $RuntimeState.$AgentRole.final_status = "stopped"
    $RuntimeState.$AgentRole.requested_at_utc = ""
    $RuntimeState.$AgentRole.requested_by = ""
}

function Get-RoleStopControl {
    param(
        [object]$RuntimeState,
        [string]$AgentRole
    )

    return $RuntimeState.$AgentRole
}

function Invoke-IntegrationApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null
    )

    if (-not $UseServerMode) {
        throw "Server mode is not enabled for frontend integration sync."
    }

    $headers = @{ Authorization = "Bearer $ResolvedAccessToken" }
    $params = @{
        Uri = ("{0}{1}" -f $ResolvedApiBase, $Endpoint)
        Headers = $headers
        Method = $Method
        ContentType = "application/json"
        ErrorAction = "Stop"
    }
    if ($null -ne $Body) {
        $params["Body"] = ($Body | ConvertTo-Json -Depth 30 -Compress)
    }

    try {
        return Invoke-RestMethod @params
    }
    catch {
        $statusCode = "unknown"
        try {
            $statusCode = $_.Exception.Response.StatusCode.value__
        }
        catch {
        }
        $detail = ""
        try {
            $detail = $_.ErrorDetails.Message
        }
        catch {
        }
        if ($statusCode -in @(401, 403, 409)) {
            throw "Frontend integration access was denied by the server. The session, subscription, or worker lease may have been revoked. $detail"
        }
        throw "Frontend integration server sync failed (HTTP $statusCode). $detail"
    }
}

function Test-ShouldFallbackToLocal {
    param([object]$ErrorRecord)

    $parts = @()
    if ($null -ne $ErrorRecord.Exception) {
        $parts += [string]$ErrorRecord.Exception.Message
    }
    if ($null -ne $ErrorRecord.ErrorDetails) {
        $parts += [string]$ErrorRecord.ErrorDetails.Message
    }
    $combined = ($parts -join " `n").ToLowerInvariant()
    return (
        $combined.Contains("actively refused") -or
        $combined.Contains("no connection could be made") -or
        $combined.Contains("unable to connect") -or
        $combined.Contains("connection refused") -or
        $combined.Contains("name or service not known")
    )
}

function Disable-ServerMode {
    param([string]$Reason)

    $script:UseServerMode = $false
    $script:CurrentWorkerLease = $null
    $script:CurrentIntegrationPolicy = $null
    if (-not [string]::IsNullOrWhiteSpace($Reason)) {
        Write-Warning $Reason
    }
}

function Update-ServerSyncContext {
    param([object]$Response)

    if ($null -eq $Response) {
        return
    }

    if ($null -ne $Response.policy) {
        $script:CurrentIntegrationPolicy = $Response.policy
    }
    if ($null -ne $Response.workflow -and $null -ne $Response.workflow.worker_lease) {
        $script:CurrentWorkerLease = $Response.workflow.worker_lease
        return
    }
    $script:CurrentWorkerLease = $null
}

function Load-ServerState {
    if (-not $UseServerMode) {
        return $null
    }

    try {
        $response = Invoke-IntegrationApiRequest -Method "GET" -Endpoint ("/account/integration/orchestration/state?repo_key={0}" -f $RepoKey)
    }
    catch {
        if (Test-ShouldFallbackToLocal -ErrorRecord $_) {
            Disable-ServerMode -Reason "Frontend integration server is unavailable. Falling back to local-only mode."
            return $null
        }
        throw
    }
    Update-ServerSyncContext -Response $response
    if ($null -eq $response.workflow -or $null -eq $response.workflow.state) {
        return $null
    }
    return (Ensure-StateDefaults -State $response.workflow.state)
}

function Add-Activity {
    param(
        [object]$State,
        [string]$Message
    )

    $timestamped = "[{0}] {1}" -f (Get-UtcNowDisplayString), $Message
    $entries = @($State.summary.latest_activity)
    $entries = @($timestamped) + $entries
    if ($entries.Count -gt 12) {
        $entries = $entries[0..11]
    }
    $State.summary.latest_activity = @($entries)
}

function Update-SummaryCounts {
    param([object]$State)

    $pages = @($State.pages)
    $State.summary.pending_backend_corrections = @($pages | Where-Object { $_.status -eq "pending_backend_correction" }).Count
    $State.summary.pending_developer_actions = @($pages | Where-Object { $_.status -eq "blocked_on_developer" }).Count
    $State.summary.completed_pages = @($pages | Where-Object { $_.status -eq "done" }).Count
    $State.summary.ready_for_frontend = @($pages | Where-Object { $_.status -eq "ready_for_frontend" }).Count
    $State.last_updated_utc = Get-UtcNowString
}

function Format-MarkdownList {
    param([object[]]$Items)

    if ($null -eq $Items -or $Items.Count -eq 0) {
        return "- none"
    }

    $lines = foreach ($item in $Items) {
        if ($item -is [string]) {
            "- $item"
        }
        elseif ($null -ne $item.title) {
            $detailParts = @()
            if ($item.kind) { $detailParts += "kind=$($item.kind)" }
            if ($item.status) { $detailParts += "status=$($item.status)" }
            if ($item.resolution) { $detailParts += "resolution=$($item.resolution)" }
            if ($item.timestamp_utc) { $detailParts += "time=$(ConvertTo-UtcDisplayValue -Value $item.timestamp_utc)" }
            $suffix = if ($detailParts.Count -gt 0) { " ({0})" -f ($detailParts -join ", ") } else { "" }
            "- $($item.title)$suffix"
            if ($item.details) {
                "  details: $($item.details)"
            }
        }
        else {
            "- $($item | ConvertTo-Json -Compress -Depth 8)"
        }
    }

    return ($lines -join "`n")
}

function Get-ValidationSnapshot {
    $snapshot = [ordered]@{
        trust_status = "pending"
        self_check_status = "pending"
    }

    if (-not (Test-Path -LiteralPath $SelfCheckSummaryPath)) {
        return $snapshot
    }

    try {
        $payload = ConvertFrom-JsonCompat -JsonText (Get-Content -LiteralPath $SelfCheckSummaryPath -Raw -Encoding utf8)
        if ($payload.status) {
            $snapshot.self_check_status = [string]$payload.status
        }
        if ($payload.check_results -and $payload.check_results.post_write_enforcement) {
            $snapshot.trust_status = [string]$payload.check_results.post_write_enforcement
        }
    }
    catch {
        $snapshot.self_check_status = "invalid"
        $snapshot.trust_status = "invalid"
    }

    return $snapshot
}

function Test-IsFrontendScreenFile {
    param([string]$RelativePath)

    $lower = $RelativePath.ToLowerInvariant()
    if ($lower.Contains("/screens/") -or $lower.Contains("/screen/") -or $lower.Contains("/pages/")) {
        return $true
    }
    if ($lower.EndsWith("page.tsx") -or $lower.EndsWith("page.jsx") -or $lower.EndsWith("page.ts") -or $lower.EndsWith("page.js")) {
        return $true
    }
    if ($lower.EndsWith("screen.tsx") -or $lower.EndsWith("screen.jsx") -or $lower.EndsWith("screen.kt") -or $lower.EndsWith("screen.swift")) {
        return $true
    }
    return $false
}

function Get-GitChangedPaths {
    $results = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $commands = @(
        @("diff", "--name-only", "--diff-filter=ACMR"),
        @("diff", "--cached", "--name-only", "--diff-filter=ACMR"),
        @("ls-files", "--others", "--exclude-standard")
    )

    foreach ($command in $commands) {
        $output = & git -C $RepoRoot @command 2>$null
        if ($LASTEXITCODE -ne 0) {
            continue
        }
        foreach ($line in ($output -split "`r?`n")) {
            $trimmed = $line.Trim()
            if (-not $trimmed) {
                continue
            }
            $normalized = $trimmed.Replace("\", "/")
            $null = $results.Add($normalized)
        }
    }

    return @($results)
}

function Get-FrontendScreenMetrics {
    param([string[]]$ExplicitChangedPaths)

    $candidatePaths = @()
    if ($ExplicitChangedPaths -and $ExplicitChangedPaths.Count -gt 0) {
        foreach ($pathValue in $ExplicitChangedPaths) {
            if ([string]::IsNullOrWhiteSpace($pathValue)) {
                continue
            }
            $candidatePaths += (ConvertTo-RelativeRepoPath -PathValue $pathValue)
        }
    }
    else {
        $candidatePaths = Get-GitChangedPaths
    }

    $screenFiles = @()
    $maxLines = 0
    foreach ($relativePath in $candidatePaths | Sort-Object -Unique) {
        if (-not (Test-IsFrontendScreenFile -RelativePath $relativePath)) {
            continue
        }
        $absolutePath = Join-Path $RepoRoot $relativePath
        if (-not (Test-Path -LiteralPath $absolutePath)) {
            continue
        }
        $lineCount = (Get-Content -LiteralPath $absolutePath -Encoding utf8 -ErrorAction SilentlyContinue).Count
        if ($lineCount -gt $maxLines) {
            $maxLines = $lineCount
        }
        $screenFiles += [ordered]@{
            path = $relativePath
            lines = $lineCount
        }
    }

    return [ordered]@{
        screen_files = @($screenFiles)
        max_lines = $maxLines
    }
}

function Get-PageLineCount {
    param([string]$RelativePagePath)

    $absolutePath = Join-Path $RepoRoot $RelativePagePath
    if (-not (Test-Path -LiteralPath $absolutePath)) {
        return 0
    }
    return (Get-Content -LiteralPath $absolutePath -Encoding utf8 -ErrorAction SilentlyContinue).Count
}

function Write-SummaryMarkdown {
    param([object]$State)

    $backendIdentity = if ($State.backend_agent.agent_id) {
        "{0} | model={1} | status={2} | heartbeat={3}" -f $State.backend_agent.agent_id, $State.backend_agent.model_name, $State.backend_agent.status, (ConvertTo-UtcDisplayValue -Value $State.backend_agent.last_heartbeat_utc)
    }
    else {
        "idle"
    }
    $frontendIdentity = if ($State.frontend_agent.agent_id) {
        "{0} | model={1} | status={2} | heartbeat={3}" -f $State.frontend_agent.agent_id, $State.frontend_agent.model_name, $State.frontend_agent.status, (ConvertTo-UtcDisplayValue -Value $State.frontend_agent.last_heartbeat_utc)
    }
    else {
        "idle"
    }
    $readyItems = @($State.pages | Where-Object { $_.status -eq "ready_for_frontend" } | ForEach-Object { "- {0} -> {1}" -f $_.page_name, $_.page_file })
    $pendingCorrections = @($State.pages | Where-Object { $_.status -eq "pending_backend_correction" } | ForEach-Object { "- {0} -> {1}" -f $_.page_name, $_.page_file })
    $pendingDeveloper = @($State.pages | Where-Object { $_.status -eq "blocked_on_developer" } | ForEach-Object { "- {0} -> {1}" -f $_.page_name, $_.page_file })
    $completedPages = @($State.pages | Where-Object { $_.status -eq "done" } | ForEach-Object { "- {0}" -f $_.page_name })
    $referenceIndex = foreach ($page in $State.pages) {
        $correctionFlag = if ($page.status -eq "pending_backend_correction") { " pending_backend_correction=yes" } else { "" }
        $developerFlag = if ($page.status -eq "blocked_on_developer") { " developer_action=yes" } else { "" }
        $ownerValue = if ($page.owner_agent_id) { $page.owner_agent_id } else { "unassigned" }
        "- [{0}]({1}) | status={2} | owner={3} | updated={4}{5}{6}" -f $page.page_name, $page.page_file.Replace("\\", "/"), $page.status, $ownerValue, (ConvertTo-UtcDisplayValue -Value $page.timestamps.updated_at_utc), $correctionFlag, $developerFlag
    }
    if ($referenceIndex.Count -eq 0) { $referenceIndex = @("- none") }

    $contentLines = @(
        "# Frontend Integration",
        "",
        "LAST_UPDATED_UTC: $(ConvertTo-UtcDisplayValue -Value $State.last_updated_utc)",
        "UPDATED_BY: frontend-integration-script",
        "",
        "## Orchestration Mode",
        "- mode: $(if ($UseServerMode) { "server-backed" } else { "local-only" })",
        "- local_detail_mode: $(if ($UseServerMode) { "redacted" } else { "full" })",
        $(if ($UseServerMode -and $null -ne $script:CurrentWorkerLease -and $script:CurrentWorkerLease.expires_at) { "- worker_lease_expires_at: $($script:CurrentWorkerLease.expires_at)" } else { "- worker_lease_expires_at: n/a" }),
        "",
        "## Agent Identities",
        "- Backend: $backendIdentity",
        "- Frontend: $frontendIdentity",
        "",
        "## Reference Index"
    )
    $contentLines += $referenceIndex
    $contentLines += @(
        "",
        "## Ready For Frontend"
    )
    $contentLines += $(if ($readyItems.Count -gt 0) { $readyItems } else { @("- none") })
    $contentLines += @(
        "",
        "## Pending Backend Corrections"
    )
    $contentLines += $(if ($pendingCorrections.Count -gt 0) { $pendingCorrections } else { @("- none") })
    $contentLines += @(
        "",
        "## Pending Developer Actions"
    )
    $contentLines += $(if ($pendingDeveloper.Count -gt 0) { $pendingDeveloper } else { @("- none") })
    $contentLines += @(
        "",
        "## Completed Pages"
    )
    $contentLines += $(if ($completedPages.Count -gt 0) { $completedPages } else { @("- none") })
    $contentLines += @(
        "",
        "## Latest Activity"
    )
    $contentLines += $(if (@($State.summary.latest_activity).Count -gt 0) { @($State.summary.latest_activity | ForEach-Object { "- $_" }) } else { @("- none") })
    $contentLines += @(
        "",
        "## Validation Snapshot",
        "- poll_seconds: $($State.summary.poll_seconds)",
        "- ready_for_frontend: $($State.summary.ready_for_frontend)",
        "- pending_backend_corrections: $($State.summary.pending_backend_corrections)",
        "- pending_developer_actions: $($State.summary.pending_developer_actions)",
        "- completed_pages: $($State.summary.completed_pages)"
    )

    $content = $contentLines -join "`n"

    Set-Content -LiteralPath $SummaryPath -Value $content -Encoding utf8
}

function Write-PageMarkdown {
    param([object]$Page)

    $content = @(
        "# $($Page.page_name)",
        "",
        "LAST_UPDATED_UTC: $(ConvertTo-UtcDisplayValue -Value $Page.timestamps.updated_at_utc)",
        "UPDATED_BY: frontend-integration-script",
        "",
        "## Page ID",
        "- $($Page.page_id)",
        "",
        "## Feature / Page Name",
        "- $($Page.page_name)",
        "",
        "## Owner",
        "- role: $(if ($Page.owner_role) { $Page.owner_role } else { "unassigned" })",
        "- agent_id: $(if ($Page.owner_agent_id) { $Page.owner_agent_id } else { "unassigned" })",
        "",
        "## Status",
        "- $($Page.status)",
        "",
        "## Backend Summary",
        $(if ($Page.backend.summary) { $Page.backend.summary } else { "- pending backend summary" }),
        "",
        "## Frontend Summary",
        $(if ($Page.frontend.summary) { $Page.frontend.summary } else { "- pending frontend summary" }),
        "",
        "## Endpoints",
        (Format-MarkdownList -Items @($Page.backend.endpoints)),
        "",
        "## Auth Requirements",
        (Format-MarkdownList -Items @($Page.backend.auth_requirements)),
        "",
        "## Headers",
        (Format-MarkdownList -Items @($Page.backend.headers)),
        "",
        "## Query Params",
        (Format-MarkdownList -Items @($Page.backend.query_params)),
        "",
        "## Request Payload Examples",
        (Format-MarkdownList -Items @($Page.backend.request_examples)),
        "",
        "## Response Payload Examples",
        (Format-MarkdownList -Items @($Page.backend.response_examples)),
        "",
        "## Error Payload Examples",
        (Format-MarkdownList -Items @($Page.backend.error_examples)),
        "",
        "## DB Verification Proof",
        $(if ($Page.backend.db_verification_note) { $Page.backend.db_verification_note } else { "- pending DB verification note" }),
        "",
        "## Backend Smoke Proof",
        "- status: $($Page.backend.smoke_status)",
        $(if ($Page.backend.smoke_note) { "- note: $($Page.backend.smoke_note)" } else { "- note: pending" }),
        "",
        "## Frontend Integration Instructions",
        $(if ($Page.backend.frontend_instructions) { $Page.backend.frontend_instructions } else { "- pending backend integration instructions" }),
        "",
        "## UI/UX Notes From Backend",
        $(if ($Page.backend.ui_notes) { $Page.backend.ui_notes } else { "- none" }),
        "",
        "## Frontend Smoke Proof",
        "- playwright: $($Page.frontend.playwright_status)",
        "- route_mapping_confirmed: $($Page.frontend.route_mapping_confirmed)",
        "",
        "## Screenshot Paths",
        (Format-MarkdownList -Items @($Page.frontend.screenshot_paths)),
        "",
        "## Known Blockers",
        (Format-MarkdownList -Items @($Page.known_blockers)),
        "",
        "## Timestamps",
        "- created_at_utc: $(ConvertTo-UtcDisplayValue -Value $Page.timestamps.created_at_utc)",
        "- updated_at_utc: $(ConvertTo-UtcDisplayValue -Value $Page.timestamps.updated_at_utc)",
        "- ready_at_utc: $(if ($Page.timestamps.ready_at_utc) { (ConvertTo-UtcDisplayValue -Value $Page.timestamps.ready_at_utc) } else { "pending" })",
        "- completed_at_utc: $(if ($Page.timestamps.completed_at_utc) { (ConvertTo-UtcDisplayValue -Value $Page.timestamps.completed_at_utc) } else { "pending" })",
        "",
        "## Credentials / Test Accounts",
        "- auth_mode: $($Page.backend.credentials.auth_mode)",
        "- required_secrets_present: $($Page.backend.credentials.required_secrets_present)",
        "- tested_successfully: $($Page.backend.credentials.tested_successfully)",
        (Format-MarkdownList -Items @($Page.backend.credentials.headers)),
        (Format-MarkdownList -Items @($Page.backend.credentials.test_accounts)),
        $(if ($Page.backend.credentials.notes) { "- notes: $($Page.backend.credentials.notes)" } else { "- notes: none" }),
        "",
        "## Developer Actions Required",
        (Format-MarkdownList -Items @($Page.developer_actions)),
        "",
        "## Frontend Findings For Backend",
        (Format-MarkdownList -Items @($Page.handoff.findings)),
        "",
        "## Backend Response To Frontend Findings",
        (Format-MarkdownList -Items @($Page.handoff.responses)),
        "",
        "## Return To Summary Instruction",
        "After updating this page, return to Memory-bank/frontend-integration.md and refresh the summary status.",
        "",
        "## Frontend Page Line-Count Check",
        "- frontend_page_line_count: $($Page.validation.frontend_page_line_count)",
        "- frontend_page_line_limit: $($Page.validation.frontend_page_line_limit)",
        "",
        "## Trust / Self-Check Validation Status",
        "- trust_status: $($Page.validation.trust_status)",
        "- self_check_status: $($Page.validation.self_check_status)",
        "",
        "## Source Refs",
        (Format-MarkdownList -Items @($Page.source_refs))
    ) -join "`n"

    $absolutePath = Join-Path $RepoRoot $Page.page_file
    Set-Content -LiteralPath $absolutePath -Value $content -Encoding utf8
}

function Save-State {
    param([object]$State)

    Ensure-Directory -PathValue $MemoryBankRoot
    Ensure-Directory -PathValue $IntegrationDir
    Ensure-Directory -PathValue $PagesDir
    Ensure-Directory -PathValue $EvidenceDir
    Ensure-Directory -PathValue $ExportsDir
    Ensure-Directory -PathValue $HandoffsDir
    Apply-StateEvidenceSeeds -State $State
    Update-SummaryCounts -State $State
    $localState = Get-LocalProjectionState -State $State
    ($localState | ConvertTo-Json -Depth 20) | Set-Content -LiteralPath $StatePath -Encoding utf8
    Write-SummaryMarkdown -State $localState
    foreach ($page in $localState.pages) {
        Write-PageMarkdown -Page $page
    }
}

function Sync-StateToServer {
    param(
        [object]$State,
        [string]$SyncAction,
        [string]$SyncRole = "",
        [string]$SyncPageId = ""
    )

    if (-not $UseServerMode) {
        return $State
    }

    $endpoint = if ($SyncAction -eq "init") { "/account/integration/orchestration/init" } else { "/account/integration/orchestration/sync" }
    $body = [ordered]@{
        repo_key = $RepoKey
        project_root = [string]$State.project_root
        action = $SyncAction
        role = $(if ($SyncRole) { $SyncRole } else { $Role })
        page_id = $SyncPageId
        lease_id = $(if ($null -ne $script:CurrentWorkerLease -and $script:CurrentWorkerLease.lease_id) { [string]$script:CurrentWorkerLease.lease_id } else { "" })
        state = $State
    }
    try {
        $response = Invoke-IntegrationApiRequest -Method "POST" -Endpoint $endpoint -Body $body
    }
    catch {
        if (Test-ShouldFallbackToLocal -ErrorRecord $_) {
            Disable-ServerMode -Reason "Frontend integration server sync is unavailable. Continuing in local-only mode."
            return $State
        }
        throw
    }
    Update-ServerSyncContext -Response $response
    if ($null -ne $response.workflow -and $null -ne $response.workflow.state) {
        return (Ensure-StateDefaults -State $response.workflow.state)
    }
    return $State
}

function Persist-State {
    param(
        [object]$State,
        [string]$SyncAction,
        [string]$SyncRole = "",
        [string]$SyncPageId = ""
    )

    $authoritativeState = if ($UseServerMode) {
        Sync-StateToServer -State $State -SyncAction $SyncAction -SyncRole $SyncRole -SyncPageId $SyncPageId
    }
    else {
        $State
    }
    Save-State -State $authoritativeState
    return $authoritativeState
}

function Resolve-PageRecord {
    param(
        [object]$State,
        [string]$InputId
    )

    if ([string]::IsNullOrWhiteSpace($InputId)) {
        throw "PageId or StepId is required for action '$Action'."
    }

    $normalizedInput = ($InputId.ToLowerInvariant() -replace "[^a-z0-9]+", "")
    foreach ($page in $State.pages) {
        $candidates = @(
            [string]$page.page_id,
            [string]$page.page_name,
            [System.IO.Path]::GetFileNameWithoutExtension([string]$page.page_file)
        )
        foreach ($candidate in $candidates) {
            if (-not $candidate) {
                continue
            }
            $normalizedCandidate = ($candidate.ToLowerInvariant() -replace "[^a-z0-9]+", "")
            if ($normalizedCandidate -eq $normalizedInput) {
                return $page
            }
            if ($normalizedInput.Contains($normalizedCandidate) -or $normalizedCandidate.Contains($normalizedInput)) {
                return $page
            }
        }
    }

    throw "Could not resolve page/step '$InputId'."
}

function Update-AgentStatus {
    param(
        [object]$AgentRecord,
        [string]$Status,
        [switch]$TouchHeartbeat
    )

    $now = Get-UtcNowString
    $AgentRecord.status = $Status
    $AgentRecord.last_poll_utc = $now
    if ($TouchHeartbeat.IsPresent) {
        $AgentRecord.last_heartbeat_utc = $now
    }
}

function Set-AgentHeartbeat {
    param(
        [object]$AgentRecord,
        [string]$Status
    )

    Update-AgentStatus -AgentRecord $AgentRecord -Status $Status -TouchHeartbeat
}

function Get-NextPageForRole {
    param(
        [object]$State,
        [string]$AgentRole
    )

    if ($AgentRole -eq "frontend") {
        return @($State.pages | Where-Object { $_.status -eq "ready_for_frontend" } | Select-Object -First 1)
    }

    $backendCorrection = @($State.pages | Where-Object { $_.status -eq "pending_backend_correction" } | Select-Object -First 1)
    if ($backendCorrection.Count -gt 0) {
        return $backendCorrection
    }
    return @($State.pages | Where-Object { $_.status -in @("planned", "claimed_by_backend", "backend_testing", "blocked_on_backend", "rejected_by_backend") } | Select-Object -First 1)
}

function Invoke-WatchLoop {
    param(
        [object]$State,
        [string]$WatchRole,
        [switch]$SingleRun
    )

    do {
        $runtimeState = Load-RuntimeState
        $State = if ($UseServerMode) {
            $loadedWatchState = Load-ServerState
            if ($null -ne $loadedWatchState) { $loadedWatchState } else { Load-State }
        }
        else {
            Load-State
        }
        $stopControl = Get-RoleStopControl -RuntimeState $runtimeState -AgentRole $WatchRole
        if ($stopControl.stop_requested) {
            $finalStatus = if ([string]$stopControl.final_status -eq "completed") { "completed" } else { "stopped" }
            $targetAgent = if ($WatchRole -eq "backend") { $State.backend_agent } else { $State.frontend_agent }
            Set-AgentHeartbeat -AgentRecord $targetAgent -Status $finalStatus
            $requestedBy = if ([string]::IsNullOrWhiteSpace([string]$stopControl.requested_by)) { "integration-stop" } else { [string]$stopControl.requested_by }
            $stopMessage = "${WatchRole} worker acknowledged stop request and exited with status '$finalStatus' (requested_by=$requestedBy)."
            Add-Activity -State $State -Message $stopMessage
            $State.summary.poll_seconds = $PollSeconds
            $State = Persist-State -State $State -SyncAction "stop-role" -SyncRole $WatchRole
            Update-RuntimeStateForRole -AgentRole $WatchRole -Mutator {
                param($currentRuntimeState, $currentRoleState)
                Clear-RoleStopRequest -RuntimeState $currentRuntimeState -AgentRole $WatchRole
            } | Out-Null
            if (-not $Quiet.IsPresent) {
                Write-Host $stopMessage
            }
            return (Get-ResultPayload -Status $finalStatus -State $State -Message $stopMessage)
        }
        if ($WatchRole -eq "backend") {
            Set-AgentHeartbeat -AgentRecord $State.backend_agent -Status "active"
        }
        else {
            Set-AgentHeartbeat -AgentRecord $State.frontend_agent -Status "waiting"
        }
        $State.summary.poll_seconds = $PollSeconds
        $nextPage = Get-NextPageForRole -State $State -AgentRole $WatchRole
        $message = if ($nextPage) { "Next page for ${WatchRole}: $($nextPage.page_id) [$($nextPage.status)]" } else { "No page ready for role '$WatchRole'." }
        Add-Activity -State $State -Message $message
        $State = Persist-State -State $State -SyncAction "watch" -SyncRole $WatchRole -SyncPageId $(if ($nextPage) { [string]$nextPage.page_id } else { "" })
        if ($nextPage) {
            $nextPage = Resolve-PageRecord -State $State -InputId $nextPage.page_id
        }
        if (-not $Quiet.IsPresent) {
            Write-Host $message
        }
        if ($SingleRun.IsPresent) {
            return (Get-ResultPayload -Status "watch" -State $State -Page $nextPage -Message $message)
        }
        Start-Sleep -Seconds $PollSeconds
    }
    while ($true)
}

function Get-ResultPayload {
    param(
        [string]$Status,
        [object]$State,
        [object]$Page = $null,
        [string]$Message = ""
    )

    return [ordered]@{
        ok = $true
        action = $Action
        status = $Status
        message = $Message
        mode = $(if ($UseServerMode) { "server" } else { "local" })
        detail_mode = $(if ($UseServerMode) { "redacted-local-server-authoritative" } else { "local-full" })
        summary_path = (ConvertTo-RelativeRepoPath -PathValue $SummaryPath)
        state_path = (ConvertTo-RelativeRepoPath -PathValue $StatePath)
        runtime_state_path = (ConvertTo-RelativeRepoPath -PathValue $RuntimeStatePath)
        worker_lease = $script:CurrentWorkerLease
        page = $Page
        summary = $State.summary
    }
}

$state = if ($UseServerMode) {
    $loadedServerState = Load-ServerState
    if ($null -ne $loadedServerState) {
        $loadedServerState
    }
    else {
        Load-State
    }
}
else {
    Load-State
}
$result = $null

switch ($Action) {
    "init" {
        $state = Persist-State -State $state -SyncAction "init"
        $result = Get-ResultPayload -Status "initialized" -State $state -Message "Frontend integration scaffold is ready."
    }
    "start-role" {
        if ($Role -notin @("backend", "frontend")) {
            throw "-Role backend|frontend is required for start-role."
        }
        $agentRecord = New-AgentRecord -AgentRole $Role
        if ($Role -eq "backend") {
            $state.backend_agent = $agentRecord
            $state.sources = Get-IntegrationSources
            foreach ($page in $state.pages) {
                $page.source_mode = Get-SourceMode -Sources $state.sources
                $page.source_refs = @($state.sources.openapi_files + $state.sources.postman_files)
                $page.timestamps.updated_at_utc = Get-UtcNowString
            }
        }
        else {
            $state.frontend_agent = $agentRecord
        }
        $state.summary.poll_seconds = if ($PSBoundParameters.ContainsKey("PollSeconds")) { $PollSeconds } else { 30 }
        Add-Activity -State $state -Message ("{0} agent '{1}' started the integration workflow." -f $Role, $agentRecord.agent_id)
        $state = Persist-State -State $state -SyncAction "start-role" -SyncRole $Role
        if ($Persistent.IsPresent) {
            Update-RuntimeStateForRole -AgentRole $Role -Mutator {
                param($currentRuntimeState, $currentRoleState)
                Clear-RoleStopRequest -RuntimeState $currentRuntimeState -AgentRole $Role
            } | Out-Null
            if (-not $Quiet.IsPresent) {
                Write-Host ("{0} role claimed. Starting persistent integration watch loop..." -f $Role)
            }
            $result = Invoke-WatchLoop -State $state -WatchRole $Role -SingleRun:$Once.IsPresent
        }
        else {
            $result = Get-ResultPayload -Status "started" -State $state -Message ("{0} role claimed." -f $Role)
        }
    }
    "stop-role" {
        if ($Role -notin @("backend", "frontend")) {
            throw "-Role backend|frontend is required for stop-role."
        }
        $targetAgent = if ($Role -eq "backend") { $state.backend_agent } else { $state.frontend_agent }
        $finalStatus = if ($Resolution -match "^(completed|complete|done|end|ended)$") { "completed" } else { "stopped" }
        $requester = if ($AgentId) { $AgentId } else { "manual-${Role}-${finalStatus}" }
        $hasWatchLikeStatus = ([string]$targetAgent.status) -in @("active", "waiting", "stop_requested")

        if ($hasWatchLikeStatus) {
            Update-RuntimeStateForRole -AgentRole $Role -Mutator {
                param($currentRuntimeState, $currentRoleState)
                Set-RoleStopRequest -RuntimeState $currentRuntimeState -AgentRole $Role -FinalStatus $finalStatus -RequestedBy $requester
            } | Out-Null
            Update-AgentStatus -AgentRecord $targetAgent -Status "stop_requested"
            Add-Activity -State $state -Message ("{0} stop requested. Worker will exit with status '{1}' on the next heartbeat cycle." -f $Role, $finalStatus)
            $state = Persist-State -State $state -SyncAction "stop-role" -SyncRole $Role
            $result = Get-ResultPayload -Status "stop_requested" -State $state -Message ("Stop requested for {0}. The persistent worker will exit on the next heartbeat cycle." -f $Role)
        }
        else {
            Update-RuntimeStateForRole -AgentRole $Role -Mutator {
                param($currentRuntimeState, $currentRoleState)
                Clear-RoleStopRequest -RuntimeState $currentRuntimeState -AgentRole $Role
            } | Out-Null
            Update-AgentStatus -AgentRecord $targetAgent -Status $finalStatus -TouchHeartbeat
            Add-Activity -State $state -Message ("{0} marked {1}." -f $Role, $finalStatus)
            $state = Persist-State -State $state -SyncAction "stop-role" -SyncRole $Role
            $result = Get-ResultPayload -Status $finalStatus -State $state -Message ("{0} marked {1}. No active persistent worker needed to be stopped." -f $Role, $finalStatus)
        }
    }
    "status" {
        $state = Persist-State -State $state -SyncAction "status" -SyncRole $Role
        $result = Get-ResultPayload -Status "status" -State $state -Message "Current integration status loaded."
    }
    "summary" {
        $state = Persist-State -State $state -SyncAction "summary" -SyncRole $Role
        $result = Get-ResultPayload -Status "summary" -State $state -Message "Summary refreshed."
    }
    "next" {
        $resolvedRole = $Role
        if ($resolvedRole -notin @("backend", "frontend")) {
            if ($state.frontend_agent.agent_id) {
                $resolvedRole = "frontend"
            }
            else {
                $resolvedRole = "backend"
            }
        }
        $nextPage = Get-NextPageForRole -State $state -AgentRole $resolvedRole
        $nextMessage = if ($nextPage) { "Next page for ${resolvedRole}: $($nextPage.page_id)" } else { "No pending page for role '$resolvedRole'." }
        $state = Persist-State -State $state -SyncAction "next" -SyncRole $resolvedRole -SyncPageId $(if ($nextPage) { [string]$nextPage.page_id } else { "" })
        if ($nextPage) {
            $nextPage = Resolve-PageRecord -State $state -InputId $nextPage.page_id
        }
        $result = Get-ResultPayload -Status "next" -State $state -Page $nextPage -Message $nextMessage
    }
    "ready" {
        $page = Resolve-PageRecord -State $state -InputId $(if ($StepId) { $StepId } else { $PageId })
        $pageIdValue = [string]$page.page_id
        $page.status = "ready_for_frontend"
        $page.owner_role = "backend"
        $page.owner_agent_id = $state.backend_agent.agent_id
        $page.backend.smoke_status = "pass"
        if ($Title) { $page.backend.summary = $Title }
        if ($Details) { $page.backend.frontend_instructions = $Details }
        if (-not $page.backend.summary) {
            $page.backend.summary = "Backend verified and ready for frontend integration."
        }
        $page.timestamps.ready_at_utc = Get-UtcNowString
        $page.timestamps.updated_at_utc = $page.timestamps.ready_at_utc
        Add-Activity -State $state -Message ("Backend marked $($page.page_id) ready_for_frontend.")
        $state = Persist-State -State $state -SyncAction "ready" -SyncRole "backend" -SyncPageId $pageIdValue
        $page = Resolve-PageRecord -State $state -InputId $pageIdValue
        $result = Get-ResultPayload -Status "ready_for_frontend" -State $state -Page $page -Message ("Marked $($page.page_id) ready for frontend.")
    }
    "complete" {
        $page = Resolve-PageRecord -State $state -InputId $(if ($StepId) { $StepId } else { $PageId })
        $pageIdValue = [string]$page.page_id
        $metrics = Get-FrontendScreenMetrics -ExplicitChangedPaths $ChangedPath
        if ($metrics.max_lines -gt $MaxIntegrationPageLines) {
            throw "Cannot mark '$($page.page_id)' complete because a frontend screen/page exceeds $MaxIntegrationPageLines lines."
        }
        $validationSnapshot = Get-ValidationSnapshot
        $page.status = "done"
        $page.owner_role = "frontend"
        $page.owner_agent_id = $state.frontend_agent.agent_id
        $page.frontend.playwright_status = "pass"
        $page.frontend.route_mapping_confirmed = $true
        $page.frontend.changed_files = @($metrics.screen_files | ForEach-Object { $_.path })
        $page.frontend.summary = if ($Details) { $Details } elseif ($Title) { $Title } else { "Frontend integrated and verified with smoke coverage." }
        $page.validation.frontend_page_line_count = $metrics.max_lines
        $page.validation.trust_status = $validationSnapshot.trust_status
        $page.validation.self_check_status = $validationSnapshot.self_check_status
        $page.timestamps.completed_at_utc = Get-UtcNowString
        $page.timestamps.updated_at_utc = $page.timestamps.completed_at_utc
        Add-Activity -State $state -Message ("Frontend marked $($page.page_id) done.")
        $state = Persist-State -State $state -SyncAction "complete" -SyncRole "frontend" -SyncPageId $pageIdValue
        $page = Resolve-PageRecord -State $state -InputId $pageIdValue
        $result = Get-ResultPayload -Status "done" -State $state -Page $page -Message ("Marked $($page.page_id) complete.")
    }
    "watch" {
        if ($Role -notin @("backend", "frontend")) {
            throw "-Role backend|frontend is required for watch."
        }
        $result = Invoke-WatchLoop -State $state -WatchRole $Role -SingleRun:$Once.IsPresent
    }
    "export" {
        $page = Resolve-PageRecord -State $state -InputId $(if ($StepId) { $StepId } else { $PageId })
        Ensure-Directory -PathValue $ExportsDir
        $exportPath = Join-Path $ExportsDir ("{0}-latest.json" -f $page.page_id)
        $pageExport = if ($UseServerMode) {
            (Get-LocalProjectionState -State ([ordered]@{ pages = @($page); summary = [ordered]@{} })).pages[0]
        }
        else {
            $page
        }
        ([ordered]@{
            exported_at_utc = Get-UtcNowString
            summary_path = (ConvertTo-RelativeRepoPath -PathValue $SummaryPath)
            detail_mode = $(if ($UseServerMode) { "redacted" } else { "full" })
            page = $pageExport
        } | ConvertTo-Json -Depth 20) | Set-Content -LiteralPath $exportPath -Encoding utf8
        Add-Activity -State $state -Message ("Exported evidence bundle for $($page.page_id).")
        $state = Persist-State -State $state -SyncAction "export" -SyncRole $Role -SyncPageId ([string]$page.page_id)
        $page = Resolve-PageRecord -State $state -InputId $page.page_id
        $result = Get-ResultPayload -Status "exported" -State $state -Page $page -Message ("Export written: $(ConvertTo-RelativeRepoPath -PathValue $exportPath)")
    }
    "report" {
        $page = Resolve-PageRecord -State $state -InputId $(if ($StepId) { $StepId } else { $PageId })
        $pageIdValue = [string]$page.page_id
        if ([string]::IsNullOrWhiteSpace($Kind)) {
            throw "-Kind is required for integration-report."
        }
        $finding = [ordered]@{
            title = $(if ($Title) { $Title } else { "Frontend reported $Kind for $($page.page_id)" })
            details = $Details
            kind = $Kind
            status = "open"
            timestamp_utc = Get-UtcNowString
        }
        $page.handoff.findings = @($page.handoff.findings) + @($finding)
        $page.handoff.frontend_finding_status = "open"
        $page.handoff.current_kind = $Kind
        $page.status = if ($Kind -match "developer") { "blocked_on_developer" } else { "pending_backend_correction" }
        $page.owner_role = "frontend"
        $page.owner_agent_id = $state.frontend_agent.agent_id
        $page.timestamps.updated_at_utc = $finding.timestamp_utc
        if ($Kind -match "developer") {
            $page.developer_actions = @($page.developer_actions) + @($(if ($Details) { $Details } else { $finding.title }))
        }
        else {
            $page.known_blockers = @($page.known_blockers) + @($(if ($Details) { $Details } else { $finding.title }))
        }
        Add-Activity -State $state -Message ("Frontend reported $Kind for $($page.page_id).")
        $state = Persist-State -State $state -SyncAction "report" -SyncRole "frontend" -SyncPageId $pageIdValue
        $page = Resolve-PageRecord -State $state -InputId $pageIdValue
        $result = Get-ResultPayload -Status $page.status -State $state -Page $page -Message ("Finding recorded for $($page.page_id).")
    }
    "respond" {
        $page = Resolve-PageRecord -State $state -InputId $(if ($StepId) { $StepId } else { $PageId })
        $pageIdValue = [string]$page.page_id
        if ([string]::IsNullOrWhiteSpace($Resolution)) {
            throw "-Resolution is required for integration-respond."
        }
        $response = [ordered]@{
            title = $(if ($Title) { $Title } else { "Backend response for $($page.page_id)" })
            details = $Details
            resolution = $Resolution
            status = "closed"
            timestamp_utc = Get-UtcNowString
        }
        $page.handoff.responses = @($page.handoff.responses) + @($response)
        $page.handoff.frontend_finding_status = "answered"
        $page.handoff.backend_response_status = "answered"
        $page.handoff.resolution = $Resolution
        $page.owner_role = "backend"
        $page.owner_agent_id = $state.backend_agent.agent_id
        switch -Regex ($Resolution.ToLowerInvariant()) {
            "fixed|ready" { $page.status = "ready_for_frontend" }
            "reject|rejected" { $page.status = "rejected_by_backend" }
            "developer" { $page.status = "blocked_on_developer" }
            default { $page.status = "pending_backend_correction" }
        }
        $page.timestamps.updated_at_utc = $response.timestamp_utc
        Add-Activity -State $state -Message ("Backend responded to $($page.page_id) with resolution '$Resolution'.")
        $state = Persist-State -State $state -SyncAction "respond" -SyncRole "backend" -SyncPageId $pageIdValue
        $page = Resolve-PageRecord -State $state -InputId $pageIdValue
        $result = Get-ResultPayload -Status $page.status -State $state -Page $page -Message ("Response recorded for $($page.page_id).")
    }
    "open-page" {
        $page = Resolve-PageRecord -State $state -InputId $(if ($PageId) { $PageId } else { $StepId })
        $state = Persist-State -State $state -SyncAction "open-page" -SyncRole $Role -SyncPageId ([string]$page.page_id)
        $page = Resolve-PageRecord -State $state -InputId $page.page_id
        $result = Get-ResultPayload -Status "open-page" -State $state -Page $page -Message ("Page file: $($page.page_file)")
    }
    default {
        throw "Unsupported action '$Action'."
    }
}

if ($Json.IsPresent) {
    $result | ConvertTo-Json -Depth 20
}
elseif (-not $Quiet.IsPresent) {
    Write-Host $result.message
    Write-Host ("- summary: {0}" -f $result.summary_path)
    Write-Host ("- state: {0}" -f $result.state_path)
    Write-Host ("- runtime-state: {0}" -f $result.runtime_state_path)
    if ($result.page) {
        Write-Host ("- page: {0} ({1})" -f $result.page.page_id, $result.page.page_file)
    }
}