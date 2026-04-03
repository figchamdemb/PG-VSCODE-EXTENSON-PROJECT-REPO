param(
    [ValidateSet("init", "start-role", "stop-role", "end", "status", "summary", "report", "respond", "approve", "open-page")]
    [string]$Action = "status",
    [ValidateSet("", "builder", "reviewer")]
    [string]$Role = "",
    [string]$PageId = "",
    [string]$Title = "",
    [string]$Details = "",
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
    [switch]$Persistent,
    [switch]$Once,
    [switch]$Json,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$MemoryBankRoot = Join-Path $RepoRoot "Memory-bank"
$ReviewRoot = Join-Path $MemoryBankRoot "review-workflow"
$PagesRoot = Join-Path $ReviewRoot "pages"
$StatePath = Join-Path $ReviewRoot "state.json"
$SummaryPath = Join-Path $MemoryBankRoot "review-workflow.md"
$RuntimePath = Join-Path $MemoryBankRoot "_generated\review-workflow-runtime.json"
$MaxPageLines = 500
$ResolvedApiBase = $ApiBase.TrimEnd('/')
$script:CurrentWorkerLease = $null
$script:CurrentReviewPolicy = $null

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

function Ensure-Directory {
    param([string]$PathValue)

    if (-not (Test-Path -LiteralPath $PathValue)) {
        New-Item -ItemType Directory -Path $PathValue -Force | Out-Null
    }
}

function Get-UtcNowString {
    return (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
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
        return $resolved.Substring($RepoRoot.Length).TrimStart(@('\', '/')).Replace("\", "/")
    }
    return $resolved.Replace("\", "/")
}

function Write-JsonFile {
    param(
        [string]$PathValue,
        [object]$Value
    )

    $parent = Split-Path -Parent $PathValue
    if ($parent) {
        Ensure-Directory -PathValue $parent
    }
    $json = $Value | ConvertTo-Json -Depth 30
    Set-Content -LiteralPath $PathValue -Value $json -Encoding utf8
}

function Write-TextFile {
    param(
        [string]$PathValue,
        [string]$Content
    )

    $parent = Split-Path -Parent $PathValue
    if ($parent) {
        Ensure-Directory -PathValue $parent
    }
    Set-Content -LiteralPath $PathValue -Value $Content -Encoding utf8
}

function New-RoleRecord {
    param([string]$RoleName)

    return [pscustomobject][ordered]@{
        role = $RoleName
        status = "idle"
        agent_id = ""
        agent_family = ""
        model_name = ""
        session_mode = ""
        started_at_utc = ""
        last_heartbeat_utc = ""
        last_message = ""
    }
}

function ConvertTo-PageSlug {
    param([string]$Value)

    $slug = ($Value.ToLowerInvariant() -replace "[^a-z0-9]+", "-").Trim("-")
    if ([string]::IsNullOrWhiteSpace($slug)) {
        return "review-task"
    }
    return $slug
}

function Get-NextPageIndex {
    param([object]$State)

    if ($null -eq $State -or $null -eq $State.pages -or @($State.pages).Count -eq 0) {
        return 1
    }
    $max = 0
    foreach ($page in @($State.pages)) {
        if ([int]$page.page_index -gt $max) {
            $max = [int]$page.page_index
        }
    }
    return ($max + 1)
}

function New-PageRecord {
    param(
        [int]$Index,
        [string]$PageTitle,
        [string]$PageDetails,
        [string[]]$Paths
    )

    $now = Get-UtcNowString
    $slug = ConvertTo-PageSlug -Value $PageTitle
    $pageId = ("{0:D2}-{1}" -f $Index, $slug)
    return [pscustomobject][ordered]@{
        page_index = $Index
        page_id = $pageId
        page_title = $PageTitle
        page_file = ("Memory-bank/review-workflow/pages/{0}.md" -f $pageId)
        status = "builder_in_progress"
        next_actor = "builder"
        current_round = 0
        details = $PageDetails
        changed_paths = @($Paths)
        findings = @()
        responses = @()
        approvals = @()
        timestamps = [pscustomobject][ordered]@{
            created_at_utc = $now
            updated_at_utc = $now
            ready_for_review_at_utc = ""
            approved_at_utc = ""
        }
    }
}

function New-ReviewState {
    param(
        [string]$InitialTitle,
        [string]$InitialDetails,
        [string[]]$Paths
    )

    $titleValue = if ([string]::IsNullOrWhiteSpace($InitialTitle)) { "Current Review Task" } else { $InitialTitle }
    $page = New-PageRecord -Index 1 -PageTitle $titleValue -PageDetails $InitialDetails -Paths $Paths
    $now = Get-UtcNowString
    return [pscustomobject][ordered]@{
        project_root = $RepoRoot
        workflow = [pscustomobject][ordered]@{
            status = "active"
            current_page_id = $page.page_id
            next_actor = "builder"
            latest_activity_utc = $now
            completion_note = ""
        }
        roles = [pscustomobject][ordered]@{
            builder = (New-RoleRecord -RoleName "builder")
            reviewer = (New-RoleRecord -RoleName "reviewer")
        }
        summary = [pscustomobject][ordered]@{
            total_pages = 1
            approved_pages = 0
            open_findings = 0
        }
        pages = @($page)
    }
}

function New-RuntimeState {
    return [pscustomobject][ordered]@{
        version = 2
        workflow_status = "active"
        stop_all = $false
        builder = [pscustomobject][ordered]@{ stop_requested = $false; end_requested = $false; final_status = "stopped"; requested_at_utc = ""; requested_by = "" }
        reviewer = [pscustomobject][ordered]@{ stop_requested = $false; end_requested = $false; final_status = "stopped"; requested_at_utc = ""; requested_by = "" }
    }
}

function Ensure-RuntimeDefaults {
    param([object]$RuntimeState)

    if ($null -eq $RuntimeState) {
        return (New-RuntimeState)
    }
    foreach ($runtimeRole in @("builder", "reviewer")) {
        if ($null -eq $RuntimeState.$runtimeRole) {
            $RuntimeState | Add-Member -NotePropertyName $runtimeRole -NotePropertyValue ([pscustomobject][ordered]@{
                stop_requested = $false
                end_requested = $false
                final_status = "stopped"
                requested_at_utc = ""
                requested_by = ""
            })
        }
        foreach ($property in @("stop_requested", "end_requested", "final_status", "requested_at_utc", "requested_by")) {
            if (-not $RuntimeState.$runtimeRole.PSObject.Properties.Name.Contains($property)) {
                $defaultValue = switch ($property) {
                    "stop_requested" { $false }
                    "end_requested" { $false }
                    "final_status" { "stopped" }
                    default { "" }
                }
                $RuntimeState.$runtimeRole | Add-Member -NotePropertyName $property -NotePropertyValue $defaultValue
            }
        }
    }
    if (-not $RuntimeState.PSObject.Properties.Name.Contains("stop_all")) {
        $RuntimeState | Add-Member -NotePropertyName stop_all -NotePropertyValue $false
    }
    if (-not $RuntimeState.PSObject.Properties.Name.Contains("workflow_status")) {
        $RuntimeState | Add-Member -NotePropertyName workflow_status -NotePropertyValue "active"
    }
    return $RuntimeState
}

function New-RuntimeEnvelope {
    param([object]$RuntimeState)

    $normalizedRuntimeState = Ensure-RuntimeDefaults -RuntimeState $RuntimeState
    $payloadJson = $normalizedRuntimeState | ConvertTo-Json -Depth 10 -Compress
    return [pscustomobject][ordered]@{
        version = 2
        state_kind = "review-workflow-runtime"
        storage_mode = "dpapi-securestring"
        repo_key = $RepoKey
        updated_at_utc = Get-UtcNowString
        protected_payload = Convert-PlainToProtected -PlainText $payloadJson
    }
}

function Get-RedactedDetailNotice {
    return "Protected in authenticated server-backed mode. Use authenticated review commands while connected to the local server to refresh or act on this detail."
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

function Ensure-StateDefaults {
    param([object]$State)

    if ($null -eq $State) {
        return $null
    }
    if (-not $State.PSObject.Properties.Name.Contains("project_root") -or [string]::IsNullOrWhiteSpace([string]$State.project_root)) {
        $State | Add-Member -NotePropertyName project_root -NotePropertyValue $RepoRoot -Force
    }
    if ($null -eq $State.workflow) {
        $seed = New-ReviewState -InitialTitle "Current Review Task" -InitialDetails "" -Paths @()
        $State | Add-Member -NotePropertyName workflow -NotePropertyValue $seed.workflow -Force
    }
    if ($null -eq $State.roles) {
        $State | Add-Member -NotePropertyName roles -NotePropertyValue ([pscustomobject][ordered]@{
            builder = (New-RoleRecord -RoleName "builder")
            reviewer = (New-RoleRecord -RoleName "reviewer")
        }) -Force
    }
    foreach ($roleName in @("builder", "reviewer")) {
        if ($null -eq $State.roles.$roleName) {
            $State.roles | Add-Member -NotePropertyName $roleName -NotePropertyValue (New-RoleRecord -RoleName $roleName)
        }
    }
    if ($null -eq $State.summary) {
        $State | Add-Member -NotePropertyName summary -NotePropertyValue ([pscustomobject][ordered]@{
            total_pages = 0
            approved_pages = 0
            open_findings = 0
        }) -Force
    }
    if ($null -eq $State.pages) {
        $State | Add-Member -NotePropertyName pages -NotePropertyValue @() -Force
    }
    return $State
}

function Get-LocalProjectionState {
    param([object]$State)

    $projection = Copy-JsonObject -Value $State
    if (-not $UseServerMode -or $null -eq $projection) {
        return $projection
    }

    $detailNotice = Get-RedactedDetailNotice
    foreach ($page in @($projection.pages)) {
        $page.details = $detailNotice
        $page.changed_paths = Get-RedactedListSummary -Items @($page.changed_paths) -Label "changed path"
        foreach ($finding in @($page.findings)) {
            $finding.title = "Protected reviewer finding"
            $finding.evidence = $detailNotice
            $finding.builder_reply = $(if ($finding.builder_reply) { $detailNotice } else { "" })
            $finding.changed_paths = Get-RedactedListSummary -Items @($finding.changed_paths) -Label "finding path"
        }
        foreach ($response in @($page.responses)) {
            $response.details = $detailNotice
            $response.changed_paths = Get-RedactedListSummary -Items @($response.changed_paths) -Label "response path"
        }
        foreach ($approval in @($page.approvals)) {
            $approval.notes = $detailNotice
        }
    }
    if (-not $projection.summary.PSObject.Properties.Name.Contains("local_detail_mode")) {
        $projection.summary | Add-Member -NotePropertyName local_detail_mode -NotePropertyValue "redacted"
    }
    else {
        $projection.summary.local_detail_mode = "redacted"
    }
    return $projection
}

function Read-State {
    if (-not (Test-Path -LiteralPath $StatePath)) {
        return $null
    }
    $state = ConvertFrom-JsonCompat -JsonText (Get-Content -LiteralPath $StatePath -Raw -Encoding utf8)
    return (Ensure-StateDefaults -State $state)
}

function Read-Runtime {
    if (-not (Test-Path -LiteralPath $RuntimePath)) {
        return (New-RuntimeState)
    }
    $raw = Get-Content -LiteralPath $RuntimePath -Raw -Encoding utf8
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return (New-RuntimeState)
    }
    $runtimeEnvelope = ConvertFrom-JsonCompat -JsonText $raw
    if ($null -ne $runtimeEnvelope -and $runtimeEnvelope.PSObject.Properties.Name.Contains("protected_payload")) {
        try {
            if ($runtimeEnvelope.repo_key -and [string]$runtimeEnvelope.repo_key -ne $RepoKey) {
                throw "Runtime state repo key mismatch."
            }
            $plainJson = Convert-ProtectedToPlain -CipherText ([string]$runtimeEnvelope.protected_payload)
            return (Ensure-RuntimeDefaults -RuntimeState (ConvertFrom-JsonCompat -JsonText $plainJson))
        }
        catch {
            throw "Review workflow runtime control state is unreadable or has been tampered with. Remove $RuntimePath only if you intend to reset worker control state."
        }
    }
    return (Ensure-RuntimeDefaults -RuntimeState $runtimeEnvelope)
}

function Save-Runtime {
    param([object]$Runtime)

    Ensure-Directory -PathValue $MemoryBankRoot
    Ensure-Directory -PathValue (Join-Path $MemoryBankRoot "_generated")
    $runtimeEnvelope = New-RuntimeEnvelope -RuntimeState $Runtime
    ($runtimeEnvelope | ConvertTo-Json -Depth 10) | Set-Content -LiteralPath $RuntimePath -Encoding utf8
}

function Invoke-ReviewApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null
    )

    if (-not $UseServerMode) {
        throw "Server mode is not enabled for review workflow sync."
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
            throw "Review workflow access was denied by the server. The session, subscription, or worker lease may have been revoked. $detail"
        }
        throw "Review workflow server sync failed (HTTP $statusCode). $detail"
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
    $script:CurrentReviewPolicy = $null
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
        $script:CurrentReviewPolicy = $Response.policy
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
        $response = Invoke-ReviewApiRequest -Method "GET" -Endpoint ("/account/review/orchestration/state?repo_key={0}" -f $RepoKey)
    }
    catch {
        if (Test-ShouldFallbackToLocal -ErrorRecord $_) {
            Disable-ServerMode -Reason "Review workflow server is unavailable. Falling back to local-only mode."
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

function Load-CurrentState {
    if ($UseServerMode) {
        $loadedServerState = Load-ServerState
        if ($null -ne $loadedServerState) {
            return $loadedServerState
        }
    }
    return Read-State
}

function Resolve-Page {
    param(
        [object]$State,
        [string]$RequestedPageId
    )

    $pages = @($State.pages)
    if ($pages.Count -eq 0) {
        throw "Review workflow has no pages. Run .\pg.ps1 review-init first."
    }
    if (-not [string]::IsNullOrWhiteSpace($RequestedPageId)) {
        $match = $pages | Where-Object { $_.page_id -eq $RequestedPageId } | Select-Object -First 1
        if ($null -ne $match) {
            return $match
        }
        throw "Review page '$RequestedPageId' was not found."
    }
    $current = $pages | Where-Object { $_.page_id -eq $State.workflow.current_page_id } | Select-Object -First 1
    if ($null -ne $current) {
        return $current
    }
    return ($pages | Select-Object -First 1)
}

function Update-SummaryCounts {
    param([object]$State)

    $pages = @($State.pages)
    $approvedPages = @($pages | Where-Object { $_.status -eq "approved" }).Count
    $openFindings = 0
    foreach ($page in $pages) {
        foreach ($finding in @($page.findings)) {
            if ($finding.status -in @("open", "needs_fix", "builder_replied", "blocked")) {
                $openFindings += 1
            }
        }
    }
    $State.summary.total_pages = $pages.Count
    $State.summary.approved_pages = $approvedPages
    $State.summary.open_findings = $openFindings
    if (-not $State.summary.PSObject.Properties.Name.Contains("local_detail_mode")) {
        $State.summary | Add-Member -NotePropertyName local_detail_mode -NotePropertyValue $(if ($UseServerMode) { "redacted" } else { "full" })
    }
    else {
        $State.summary.local_detail_mode = $(if ($UseServerMode) { "redacted" } else { "full" })
    }
    if ($approvedPages -eq $pages.Count -and $pages.Count -gt 0) {
        $State.workflow.status = "completed"
        $State.workflow.next_actor = ""
    }
    elseif ($pages.Count -gt 0) {
        $currentPage = Resolve-Page -State $State -RequestedPageId $State.workflow.current_page_id
        $State.workflow.next_actor = [string]$currentPage.next_actor
    }
    $State.workflow.latest_activity_utc = Get-UtcNowString
}

function Write-SummaryMarkdown {
    param([object]$State)

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("# PG Review Workflow")
    $lines.Add("")
    $lines.Add(("LAST_UPDATED_UTC: {0}" -f (Get-UtcNowString)))
    $lines.Add("UPDATED_BY: copilot")
    $lines.Add("")
    $lines.Add("## Orchestration Mode")
    $lines.Add(("- mode: {0}" -f $(if ($UseServerMode) { "server-backed" } else { "local-only" })))
    $lines.Add(("- local_detail_mode: {0}" -f $(if ($UseServerMode) { "redacted" } else { "full" })))
    $lines.Add(("- worker_lease_expires_at: {0}" -f $(if ($UseServerMode -and $null -ne $script:CurrentWorkerLease -and $script:CurrentWorkerLease.expires_at) { $script:CurrentWorkerLease.expires_at } else { "n/a" })))
    $lines.Add("")
    $lines.Add("## Workflow")
    $lines.Add(("- Status: {0}" -f $State.workflow.status))
    $lines.Add(("- Current page: {0}" -f $State.workflow.current_page_id))
    $lines.Add(("- Next actor: {0}" -f $(if ($State.workflow.next_actor) { $State.workflow.next_actor } else { "none" })))
    $lines.Add(("- Open findings: {0}" -f $State.summary.open_findings))
    $lines.Add("")
    $lines.Add("## Roles")
    foreach ($roleName in @("builder", "reviewer")) {
        $role = $State.roles.$roleName
        $lines.Add(("- {0}: status={1} heartbeat={2} agent={3}" -f $roleName, $role.status, $(if ($role.last_heartbeat_utc) { $role.last_heartbeat_utc } else { "never" }), $(if ($role.agent_id) { $role.agent_id } else { "unclaimed" })))
    }
    $lines.Add("")
    $lines.Add("## Review Pages")
    foreach ($page in @($State.pages)) {
        $lines.Add(("- {0} | status={1} | next={2} | file={3}" -f $page.page_id, $page.status, $(if ($page.next_actor) { $page.next_actor } else { "none" }), $page.page_file))
    }
    $lines.Add("")
    $lines.Add("## Commands")
    $lines.Add("- .\pg.ps1 review-builder-start -Persistent")
    $lines.Add("- .\pg.ps1 review-reviewer-start -Persistent")
    $lines.Add("- .\pg.ps1 review-report -PageId PAGE_ID -Title finding -Kind medium -Details evidence")
    $lines.Add("- .\pg.ps1 review-respond -PageId PAGE_ID -Resolution fixed -Details patch-and-validation")
    $lines.Add("- .\pg.ps1 review-approve -PageId PAGE_ID -Details verified")
    Write-TextFile -PathValue $SummaryPath -Content ($lines -join [Environment]::NewLine)
}

function Write-PageMarkdown {
    param([object]$Page)

    $pagePath = Join-Path $RepoRoot ($Page.page_file.Replace("/", "\"))
    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add(("# {0}" -f $Page.page_title))
    $lines.Add("")
    $lines.Add(("PAGE_ID: {0}" -f $Page.page_id))
    $lines.Add(("STATUS: {0}" -f $Page.status))
    $lines.Add(("NEXT_ACTOR: {0}" -f $(if ($Page.next_actor) { $Page.next_actor } else { "none" })))
    $lines.Add(("CURRENT_ROUND: {0}" -f $Page.current_round))
    $lines.Add("")
    $lines.Add("## Scope")
    if ($Page.details) {
        $lines.Add([string]::Format("- {0}", $Page.details))
    }
    else {
        $lines.Add("- Scope details pending.")
    }
    $lines.Add("")
    $lines.Add("## Changed Paths")
        $displayPaths = @($Page.changed_paths | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
        if ($displayPaths.Count -gt 0) {
            foreach ($path in $displayPaths) {
                $lines.Add(('- {0}' -f [string]$path))
            }
    }
    else {
        $lines.Add("- No changed paths recorded yet.")
    }
    $lines.Add("")
    $lines.Add("## Reviewer Findings")
    if (@($Page.findings).Count -gt 0) {
        foreach ($finding in @($Page.findings)) {
            $lines.Add(("### {0} | {1} | {2}" -f $finding.finding_id, $finding.severity, $finding.status))
            $lines.Add([string]::Format("- Title: {0}", $finding.title))
            $lines.Add([string]::Format("- Reported by: {0}", $finding.reported_by))
            $lines.Add([string]::Format("- Round: {0}", $finding.round))
            $lines.Add([string]::Format("- Evidence: {0}", $finding.evidence))
            if ($finding.builder_reply) {
                $lines.Add([string]::Format("- Builder reply: {0}", $finding.builder_reply))
            }
            $lines.Add("")
        }
    }
    else {
        $lines.Add("- No findings recorded yet.")
    }
    $lines.Add("")
    $lines.Add("## Builder Updates")
    if (@($Page.responses).Count -gt 0) {
        foreach ($response in @($Page.responses)) {
            $lines.Add(("### {0} | {1}" -f $response.response_id, $response.response_type))
            $lines.Add([string]::Format("- Resolution: {0}", $response.resolution))
            $lines.Add([string]::Format("- Notes: {0}", $response.details))
            $lines.Add([string]::Format("- Actor: {0}", $response.actor))
            $lines.Add([string]::Format("- Timestamp: {0}", $response.created_at_utc))
            $lines.Add("")
        }
    }
    else {
        $lines.Add("- No builder updates recorded yet.")
    }
    $lines.Add("")
    $lines.Add("## Approvals")
    if (@($Page.approvals).Count -gt 0) {
        foreach ($approval in @($Page.approvals)) {
            $lines.Add([string]::Format("- {0} | {1}", $approval.created_at_utc, $approval.notes))
        }
    }
    else {
        $lines.Add("- Not approved yet.")
    }
    if ($lines.Count -gt $MaxPageLines) {
        throw "Review page '$($Page.page_id)' exceeded the $MaxPageLines line limit."
    }
    Write-TextFile -PathValue $pagePath -Content ($lines -join [Environment]::NewLine)
}

function Write-AllArtifacts {
    param(
        [object]$State,
        [object]$Runtime
    )

    Update-SummaryCounts -State $State
    $Runtime.workflow_status = $State.workflow.status
    Save-Runtime -Runtime $Runtime
    $localState = Get-LocalProjectionState -State $State
    Write-JsonFile -PathValue $StatePath -Value $localState
    Write-SummaryMarkdown -State $localState
    foreach ($page in @($localState.pages)) {
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

    $endpoint = if ($SyncAction -eq "init") { "/account/review/orchestration/init" } else { "/account/review/orchestration/sync" }
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
        $response = Invoke-ReviewApiRequest -Method "POST" -Endpoint $endpoint -Body $body
    }
    catch {
        if (Test-ShouldFallbackToLocal -ErrorRecord $_) {
            Disable-ServerMode -Reason "Review workflow server sync is unavailable. Continuing in local-only mode."
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
        [object]$Runtime,
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
    Write-AllArtifacts -State $authoritativeState -Runtime $Runtime
    return $authoritativeState
}

function Ensure-StateExists {
    $state = Load-CurrentState
    if ($null -eq $state) {
        throw "Review workflow is not initialized. Run .\pg.ps1 review-init first."
    }
    return $state
}

function Resolve-ActivePage {
    param([object]$State)

    return Resolve-Page -State $State -RequestedPageId $PageId
}

function Set-RoleActive {
    param(
        [object]$State,
        [string]$RoleName,
        [string]$Message
    )

    $now = Get-UtcNowString
    $roleRecord = $State.roles.$RoleName
    $resolvedAgentId = if ([string]::IsNullOrWhiteSpace($AgentId)) {
        ("{0}-{1}-{2}" -f $RoleName, $AgentFamily, ($ModelName.ToLowerInvariant() -replace "[^a-z0-9]+", "-"))
    }
    else {
        $AgentId
    }
    if (-not $roleRecord.started_at_utc) {
        $roleRecord.started_at_utc = $now
    }
    $roleRecord.status = "active"
    $roleRecord.agent_id = $resolvedAgentId.Trim("-")
    $roleRecord.agent_family = $AgentFamily
    $roleRecord.model_name = $ModelName
    $roleRecord.session_mode = $SessionMode
    $roleRecord.last_heartbeat_utc = $now
    $roleRecord.last_message = $Message
}

function Stop-RoleRecord {
    param(
        [object]$State,
        [string]$RoleName,
        [string]$Message
    )

    $roleRecord = $State.roles.$RoleName
    $roleRecord.status = "stopped"
    $roleRecord.last_heartbeat_utc = Get-UtcNowString
    $roleRecord.last_message = $Message
}

function Get-StatusView {
    param([object]$State)

    $page = Resolve-ActivePage -State $State
    return [pscustomobject][ordered]@{
        workflow_status = $State.workflow.status
        current_page_id = $page.page_id
        current_page_title = $page.page_title
        page_status = $page.status
        next_actor = $State.workflow.next_actor
        open_findings = $State.summary.open_findings
        approved_pages = $State.summary.approved_pages
        total_pages = $State.summary.total_pages
        builder_status = $State.roles.builder.status
        reviewer_status = $State.roles.reviewer.status
        page_file = $page.page_file
        mode = $(if ($UseServerMode) { "server" } else { "local" })
    }
}

function Write-StatusOutput {
    param([object]$StatusView)

    if ($Json.IsPresent) {
        $StatusView | ConvertTo-Json -Depth 10
        return
    }
    Write-Host ("workflow: {0}" -f $StatusView.workflow_status)
    Write-Host ("page: {0} ({1})" -f $StatusView.current_page_id, $StatusView.current_page_title)
    Write-Host ("page status: {0}" -f $StatusView.page_status)
    Write-Host ("next actor: {0}" -f $(if ($StatusView.next_actor) { $StatusView.next_actor } else { "none" }))
    Write-Host ("open findings: {0}" -f $StatusView.open_findings)
    Write-Host ("pages approved: {0}/{1}" -f $StatusView.approved_pages, $StatusView.total_pages)
    Write-Host ("builder: {0}" -f $StatusView.builder_status)
    Write-Host ("reviewer: {0}" -f $StatusView.reviewer_status)
    Write-Host ("mode: {0}" -f $StatusView.mode)
    Write-Host ("page file: {0}" -f $StatusView.page_file)
}

Ensure-Directory -PathValue $ReviewRoot
Ensure-Directory -PathValue $PagesRoot
Ensure-Directory -PathValue (Split-Path -Parent $RuntimePath)

switch ($Action) {
    "init" {
        $existingState = Load-CurrentState
        $runtime = Read-Runtime
        $normalizedPaths = @($ChangedPath | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { ConvertTo-RelativeRepoPath -PathValue $_ })
        if ($null -eq $existingState) {
            $state = New-ReviewState -InitialTitle $Title -InitialDetails $Details -Paths $normalizedPaths
        }
        else {
            $state = $existingState
            $pageTitle = if ([string]::IsNullOrWhiteSpace($Title)) { "Current Review Task" } else { $Title }
            $index = Get-NextPageIndex -State $state
            $page = New-PageRecord -Index $index -PageTitle $pageTitle -PageDetails $Details -Paths $normalizedPaths
            $state.pages = @($state.pages) + @($page)
            $state.workflow.current_page_id = $page.page_id
            $state.workflow.next_actor = "builder"
        }
        $state = Persist-State -State $state -Runtime $runtime -SyncAction "init"
        Write-StatusOutput -StatusView (Get-StatusView -State $state)
    }
    "start-role" {
        if ([string]::IsNullOrWhiteSpace($Role)) {
            throw "Role is required for start-role. Use builder or reviewer."
        }
        $state = Ensure-StateExists
        $runtime = Read-Runtime
        $runtime.stop_all = $false
        $runtime.$Role.stop_requested = $false
        $runtime.$Role.end_requested = $false
        $runtime.$Role.requested_at_utc = ""
        $runtime.$Role.requested_by = ""
        $runtime.$Role.final_status = "active"
        Set-RoleActive -State $state -RoleName $Role -Message "heartbeat active"
        $state = Persist-State -State $state -Runtime $runtime -SyncAction "start-role" -SyncRole $Role -SyncPageId $state.workflow.current_page_id
        if ($Persistent.IsPresent) {
            while ($true) {
                Start-Sleep -Seconds $PollSeconds
                $state = Ensure-StateExists
                $runtime = Read-Runtime
                if ($runtime.stop_all -or $runtime.$Role.stop_requested -or $runtime.$Role.end_requested -or $state.workflow.status -eq "completed") {
                    $finalStatus = if ($runtime.$Role.final_status -eq "completed" -or $state.workflow.status -eq "completed") { "completed" } else { "stopped" }
                    Stop-RoleRecord -State $state -RoleName $Role -Message "worker stopped"
                    $state.roles.$Role.status = $finalStatus
                    $runtime.$Role.stop_requested = $false
                    $runtime.$Role.end_requested = $false
                    $runtime.$Role.requested_at_utc = ""
                    $runtime.$Role.requested_by = ""
                    $runtime.$Role.final_status = "stopped"
                    $state = Persist-State -State $state -Runtime $runtime -SyncAction "stop-role" -SyncRole $Role -SyncPageId $state.workflow.current_page_id
                    if (-not $Quiet.IsPresent) {
                        Write-Host ("{0} worker stopped." -f $Role)
                    }
                    break
                }
                Set-RoleActive -State $state -RoleName $Role -Message ("next actor is {0}" -f $(if ($state.workflow.next_actor) { $state.workflow.next_actor } else { "none" }))
                $state = Persist-State -State $state -Runtime $runtime -SyncAction "watch" -SyncRole $Role -SyncPageId $state.workflow.current_page_id
                if ($Once.IsPresent) {
                    break
                }
                if (-not $Quiet.IsPresent) {
                    Write-StatusOutput -StatusView (Get-StatusView -State $state)
                }
            }
            break
        }
        Write-StatusOutput -StatusView (Get-StatusView -State $state)
    }
    "stop-role" {
        $state = Ensure-StateExists
        $runtime = Read-Runtime
        $targets = if ([string]::IsNullOrWhiteSpace($Role)) { @("builder", "reviewer") } else { @($Role) }
        foreach ($targetRole in $targets) {
            $runtime.$targetRole.stop_requested = $true
            $runtime.$targetRole.end_requested = $false
            $runtime.$targetRole.final_status = "stopped"
            $runtime.$targetRole.requested_at_utc = Get-UtcNowString
            $runtime.$targetRole.requested_by = "review-stop"
            Stop-RoleRecord -State $state -RoleName $targetRole -Message "stop requested"
        }
        $syncRole = $(if ($targets.Count -eq 1) { $targets[0] } else { "" })
        $state = Persist-State -State $state -Runtime $runtime -SyncAction "stop-role" -SyncRole $syncRole -SyncPageId $state.workflow.current_page_id
        Write-StatusOutput -StatusView (Get-StatusView -State $state)
    }
    "end" {
        $state = Ensure-StateExists
        $runtime = Read-Runtime
        $runtime.stop_all = $true
        $runtime.builder.end_requested = $true
        $runtime.reviewer.end_requested = $true
        $runtime.builder.final_status = "completed"
        $runtime.reviewer.final_status = "completed"
        $runtime.builder.requested_at_utc = Get-UtcNowString
        $runtime.reviewer.requested_at_utc = Get-UtcNowString
        $runtime.builder.requested_by = "review-end"
        $runtime.reviewer.requested_by = "review-end"
        $state.workflow.status = "completed"
        $state.workflow.completion_note = $(if ($Details) { $Details } else { "review workflow ended" })
        Stop-RoleRecord -State $state -RoleName "builder" -Message "workflow ended"
        Stop-RoleRecord -State $state -RoleName "reviewer" -Message "workflow ended"
        $state.roles.builder.status = "completed"
        $state.roles.reviewer.status = "completed"
        $state = Persist-State -State $state -Runtime $runtime -SyncAction "end"
        Write-StatusOutput -StatusView (Get-StatusView -State $state)
    }
    "report" {
        $state = Ensure-StateExists
        $runtime = Read-Runtime
        $page = Resolve-ActivePage -State $state
        Set-RoleActive -State $state -RoleName "reviewer" -Message "finding recorded"
        if ($page.status -eq "builder_replied") {
            $page.current_round = [int]$page.current_round + 1
        }
        elseif ([int]$page.current_round -lt 1) {
            $page.current_round = 1
        }
        $roundFindings = @($page.findings | Where-Object { [int]$_.round -eq [int]$page.current_round }).Count
        $findingId = ("F{0:D2}-{1:D2}" -f [int]$page.current_round, ($roundFindings + 1))
        $finding = [pscustomobject][ordered]@{
            finding_id = $findingId
            round = [int]$page.current_round
            severity = $(if ($Kind) { $Kind } else { "medium" })
            status = "open"
            title = $(if ($Title) { $Title } else { "Reviewer finding" })
            evidence = $(if ($Details) { $Details } else { "Evidence pending." })
            reported_by = "reviewer"
            created_at_utc = Get-UtcNowString
            builder_reply = ""
            changed_paths = @($ChangedPath | ForEach-Object { ConvertTo-RelativeRepoPath -PathValue $_ })
        }
        $page.findings = @($page.findings) + @($finding)
        $page.status = "changes_requested"
        $page.next_actor = "builder"
        $page.timestamps.updated_at_utc = Get-UtcNowString
        $state.workflow.current_page_id = $page.page_id
        $state.workflow.next_actor = "builder"
        $state = Persist-State -State $state -Runtime $runtime -SyncAction "report" -SyncRole "reviewer" -SyncPageId $page.page_id
        Write-StatusOutput -StatusView (Get-StatusView -State $state)
    }
    "respond" {
        $state = Ensure-StateExists
        $runtime = Read-Runtime
        $page = Resolve-ActivePage -State $state
        Set-RoleActive -State $state -RoleName "builder" -Message "builder update recorded"
        $openFindings = @($page.findings | Where-Object { $_.status -in @("open", "needs_fix", "blocked", "builder_replied") })
        $responseType = if ($openFindings.Count -gt 0) { "builder_response" } else { "review_ready_update" }
        $responseId = ("R{0:D2}" -f (@($page.responses).Count + 1))
        $response = [pscustomobject][ordered]@{
            response_id = $responseId
            response_type = $responseType
            resolution = $(if ($Resolution) { $Resolution } else { "noted" })
            details = $(if ($Details) { $Details } else { "Builder update recorded." })
            actor = "builder"
            created_at_utc = Get-UtcNowString
            changed_paths = @($ChangedPath | ForEach-Object { ConvertTo-RelativeRepoPath -PathValue $_ })
        }
        $page.responses = @($page.responses) + @($response)
        if ($openFindings.Count -gt 0) {
            foreach ($finding in $openFindings) {
                $finding.status = "builder_replied"
                $finding.builder_reply = $response.details
            }
            $page.status = "builder_replied"
        }
        else {
            if ([int]$page.current_round -lt 1) {
                $page.current_round = 1
            }
            $page.status = "ready_for_review"
            $page.timestamps.ready_for_review_at_utc = Get-UtcNowString
        }
        $page.next_actor = "reviewer"
        $page.timestamps.updated_at_utc = Get-UtcNowString
        $state.workflow.current_page_id = $page.page_id
        $state.workflow.next_actor = "reviewer"
        $state = Persist-State -State $state -Runtime $runtime -SyncAction "respond" -SyncRole "builder" -SyncPageId $page.page_id
        Write-StatusOutput -StatusView (Get-StatusView -State $state)
    }
    "approve" {
        $state = Ensure-StateExists
        $runtime = Read-Runtime
        $page = Resolve-ActivePage -State $state
        Set-RoleActive -State $state -RoleName "reviewer" -Message "approval recorded"
        foreach ($finding in @($page.findings)) {
            if ($finding.status -in @("open", "needs_fix", "builder_replied", "blocked")) {
                $finding.status = "verified"
            }
        }
        $page.approvals = @($page.approvals) + @([pscustomobject][ordered]@{
            actor = "reviewer"
            notes = $(if ($Details) { $Details } else { "Approved." })
            created_at_utc = Get-UtcNowString
        })
        $page.status = "approved"
        $page.next_actor = ""
        $page.timestamps.updated_at_utc = Get-UtcNowString
        $page.timestamps.approved_at_utc = Get-UtcNowString
        $state = Persist-State -State $state -Runtime $runtime -SyncAction "approve" -SyncRole "reviewer" -SyncPageId $page.page_id
        Write-StatusOutput -StatusView (Get-StatusView -State $state)
    }
    "open-page" {
        $state = Ensure-StateExists
        $page = Resolve-ActivePage -State $state
        $pagePath = Join-Path $RepoRoot ($page.page_file.Replace("/", "\"))
        if ($Json.IsPresent) {
            [pscustomobject][ordered]@{ page_id = $page.page_id; page_file = $pagePath } | ConvertTo-Json -Depth 10
        }
        else {
            Write-Host $pagePath
        }
    }
    default {
        $state = Ensure-StateExists
        Write-AllArtifacts -State $state -Runtime (Read-Runtime)
        Write-StatusOutput -StatusView (Get-StatusView -State $state)
    }
}