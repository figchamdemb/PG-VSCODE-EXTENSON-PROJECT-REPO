param(
    [string]$ApiBase = "",
    [string]$StateFile = "",
    [string]$PlaybookPath = "",
    [ValidateRange(1, 500)]
    [int]$Limit = 100,
    [ValidateRange(2, 3600)]
    [int]$PollSeconds = 15,
    [switch]$Once,
    [string]$ApproveCommand = "",
    [string]$NeedsChangeCommand = "",
    [string]$RejectCommand = "",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-DefaultStateFilePath {
    $root = Get-RepoRoot
    return Join-Path $root "Memory-bank\_generated\governance-agent-state.json"
}

function Get-DefaultPlaybookPath {
    return Join-Path $PSScriptRoot "governance_action_playbook.json"
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
    } catch {
        throw "State file is not valid JSON: $path"
    }
}

function Write-State([string]$path, [hashtable]$state) {
    $directory = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -Path $directory -ItemType Directory -Force | Out-Null
    }
    $json = $state | ConvertTo-Json -Depth 10
    Set-Content -LiteralPath $path -Value $json -Encoding UTF8
}

function Ensure-Text([object]$value, [string]$fallback = "") {
    if ($null -eq $value) {
        return $fallback
    }
    return [string]$value
}

function Resolve-PlaybookPath(
    [hashtable]$state,
    [string]$override
) {
    if (-not [string]::IsNullOrWhiteSpace($override)) {
        return $override
    }
    if ($state.ContainsKey("playbook_path")) {
        $candidate = Ensure-Text $state["playbook_path"]
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            return $candidate
        }
    }
    $defaultPath = Get-DefaultPlaybookPath
    if (Test-Path -LiteralPath $defaultPath) {
        return $defaultPath
    }
    return ""
}

function Resolve-AbsolutePath([string]$rawPath) {
    if ([string]::IsNullOrWhiteSpace($rawPath)) {
        return ""
    }
    if ([System.IO.Path]::IsPathRooted($rawPath)) {
        return $rawPath
    }
    $repoRoot = Get-RepoRoot
    return Join-Path $repoRoot $rawPath
}

function Read-ActionPlaybook([string]$path) {
    if ([string]::IsNullOrWhiteSpace($path)) {
        return @{ path = ""; actions = @{} }
    }
    $absolutePath = Resolve-AbsolutePath $path
    if (-not (Test-Path -LiteralPath $absolutePath)) {
        throw "Governance action playbook was not found: $absolutePath"
    }
    $raw = Get-Content -LiteralPath $absolutePath -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw "Governance action playbook is empty: $absolutePath"
    }
    $parsed = ConvertFrom-Json -InputObject $raw
    if ($null -eq $parsed) {
        throw "Governance action playbook is invalid JSON: $absolutePath"
    }

    $actions = @{}
    foreach ($action in @($parsed.actions)) {
        if ($null -eq $action) { continue }
        $key = (Ensure-Text $action.key).Trim().ToLowerInvariant()
        if ([string]::IsNullOrWhiteSpace($key)) { continue }
        $commands = @{}
        if ($null -ne $action.commands) {
            foreach ($property in $action.commands.PSObject.Properties) {
                $decisionKey = (Ensure-Text $property.Name).Trim().ToLowerInvariant()
                if ([string]::IsNullOrWhiteSpace($decisionKey)) { continue }
                $commands[$decisionKey] = Ensure-Text $property.Value
            }
        }
        $actions[$key] = @{
            key = $key
            description = Ensure-Text $action.description
            commands = $commands
        }
    }
    return @{
        path = $absolutePath
        actions = $actions
    }
}

function Resolve-PlaybookCommand(
    [hashtable]$playbook,
    [string]$actionKey,
    [string]$decision
) {
    if ($null -eq $playbook -or -not $playbook.ContainsKey("actions")) {
        return ""
    }
    $normalizedKey = (Ensure-Text $actionKey).Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($normalizedKey)) {
        return ""
    }
    $actions = $playbook["actions"]
    if ($null -eq $actions -or -not $actions.ContainsKey($normalizedKey)) {
        return ""
    }
    $action = $actions[$normalizedKey]
    if ($null -eq $action -or -not $action.ContainsKey("commands")) {
        return ""
    }
    $commands = $action["commands"]
    if ($null -eq $commands) {
        return ""
    }
    $decisionKey = (Ensure-Text $decision).Trim().ToLowerInvariant()
    if ($commands.ContainsKey($decisionKey)) {
        return Ensure-Text $commands[$decisionKey]
    }
    if ($commands.ContainsKey("*")) {
        return Ensure-Text $commands["*"]
    }
    return ""
}

function Find-ThreadActionBinding(
    [hashtable]$state,
    [string]$threadId
) {
    if (-not $state.ContainsKey("thread_action_bindings")) {
        return $null
    }
    foreach ($binding in @($state["thread_action_bindings"])) {
        if ($null -eq $binding) { continue }
        $bindingThreadId = Ensure-Text $binding.thread_id
        if ([string]::IsNullOrWhiteSpace($bindingThreadId)) { continue }
        if ($bindingThreadId -ne $threadId) { continue }
        $disabled = Ensure-Text $binding.status
        if ($disabled.Trim().ToLowerInvariant() -eq "disabled") { continue }
        return $binding
    }
    return $null
}

function Consume-ThreadBinding(
    [hashtable]$state,
    [string]$bindingId
) {
    if ([string]::IsNullOrWhiteSpace($bindingId)) {
        return
    }
    if (-not $state.ContainsKey("thread_action_bindings")) {
        return
    }
    $remaining = @()
    foreach ($binding in @($state["thread_action_bindings"])) {
        if ($null -eq $binding) { continue }
        $currentId = Ensure-Text $binding.id
        if ($currentId -eq $bindingId) { continue }
        $remaining += $binding
    }
    $state["thread_action_bindings"] = $remaining
}

function Invoke-Ack(
    [string]$apiBase,
    [string]$token,
    [string]$eventId,
    [string]$status,
    [string]$note
) {
    $uri = "{0}/account/governance/sync/ack" -f $apiBase.TrimEnd("/")
    $body = @{
        event_id = $eventId
        status = $status
        note = $note
    } | ConvertTo-Json -Compress

    return Invoke-RestMethod `
        -Method Post `
        -Uri $uri `
        -Headers @{ Authorization = "Bearer $token" } `
        -ContentType "application/json" `
        -Body $body
}

function Resolve-DecisionCommand(
    [string]$decision,
    [object]$event,
    [hashtable]$state,
    [hashtable]$playbook,
    [string]$approveOverride,
    [string]$needsChangeOverride,
    [string]$rejectOverride
) {
    $defaultHandler = Join-Path $PSScriptRoot "governance_action_handler.ps1"
    $defaultCommand = ""
    if (Test-Path -LiteralPath $defaultHandler) {
        $escapedPath = $defaultHandler.Replace("'", "''")
        $defaultCommand = "& '$escapedPath'"
    }

    if ($decision -eq "approve") {
        if (-not [string]::IsNullOrWhiteSpace($approveOverride)) {
            return @{
                command = $approveOverride
                source = "override.approve"
                action_key = ""
                binding_id = ""
                one_shot = $false
            }
        }
    }
    if ($decision -eq "needs_change") {
        if (-not [string]::IsNullOrWhiteSpace($needsChangeOverride)) {
            return @{
                command = $needsChangeOverride
                source = "override.needs_change"
                action_key = ""
                binding_id = ""
                one_shot = $false
            }
        }
    }
    if ($decision -eq "reject") {
        if (-not [string]::IsNullOrWhiteSpace($rejectOverride)) {
            return @{
                command = $rejectOverride
                source = "override.reject"
                action_key = ""
                binding_id = ""
                one_shot = $false
            }
        }
    }

    $threadId = Ensure-Text $event.thread_id
    if (-not [string]::IsNullOrWhiteSpace($threadId)) {
        $binding = Find-ThreadActionBinding -state $state -threadId $threadId
        if ($null -ne $binding) {
            $actionKey = (Ensure-Text $binding.action_key).Trim().ToLowerInvariant()
            $bindingId = Ensure-Text $binding.id
            $oneShot = $true
            if ($binding.PSObject.Properties.Name -contains "one_shot") {
                $oneShot = [bool]$binding.one_shot
            }
            $playbookCommand = Resolve-PlaybookCommand -playbook $playbook -actionKey $actionKey -decision $decision
            if (-not [string]::IsNullOrWhiteSpace($playbookCommand)) {
                return @{
                    command = $playbookCommand
                    source = "binding.playbook"
                    action_key = $actionKey
                    binding_id = $bindingId
                    one_shot = $oneShot
                }
            }
        }
    }

    if ($decision -eq "approve") {
        if ($state.ContainsKey("approve_command")) {
            return @{
                command = Ensure-Text $state["approve_command"]
                source = "state.approve_command"
                action_key = ""
                binding_id = ""
                one_shot = $false
            }
        }
    }
    if ($decision -eq "needs_change") {
        if ($state.ContainsKey("needs_change_command")) {
            return @{
                command = Ensure-Text $state["needs_change_command"]
                source = "state.needs_change_command"
                action_key = ""
                binding_id = ""
                one_shot = $false
            }
        }
    }
    if ($decision -eq "reject") {
        if ($state.ContainsKey("reject_command")) {
            return @{
                command = Ensure-Text $state["reject_command"]
                source = "state.reject_command"
                action_key = ""
                binding_id = ""
                one_shot = $false
            }
        }
    }

    if ($state.ContainsKey("default_action_key")) {
        $defaultActionKey = (Ensure-Text $state["default_action_key"]).Trim().ToLowerInvariant()
        $defaultActionCommand = Resolve-PlaybookCommand `
            -playbook $playbook `
            -actionKey $defaultActionKey `
            -decision $decision
        if (-not [string]::IsNullOrWhiteSpace($defaultActionCommand)) {
            return @{
                command = $defaultActionCommand
                source = "state.default_action_key"
                action_key = $defaultActionKey
                binding_id = ""
                one_shot = $false
            }
        }
    }
    return @{
        command = $defaultCommand
        source = "default.handler"
        action_key = ""
        binding_id = ""
        one_shot = $false
    }
}

function Invoke-DecisionCommand(
    [hashtable]$execution,
    [object]$event,
    [switch]$dryRun
) {
    $command = Ensure-Text $execution["command"]
    $source = Ensure-Text $execution["source"]
    $actionKey = Ensure-Text $execution["action_key"]
    $bindingId = Ensure-Text $execution["binding_id"]

    if ([string]::IsNullOrWhiteSpace($command)) {
        return @{
            status = "skipped"
            note = "no local command configured for decision $($event.decision)"
            exit_code = $null
        }
    }

    $eventJson = $event | ConvertTo-Json -Depth 8 -Compress
    if ($dryRun.IsPresent) {
        return @{
            status = "skipped"
            note = "dry-run: command not executed ($command)"
            exit_code = 0
        }
    }

    $oldEventId = $env:PG_GOV_EVENT_ID
    $oldThreadId = $env:PG_GOV_THREAD_ID
    $oldDecision = $env:PG_GOV_DECISION
    $oldWinningOption = $env:PG_GOV_WINNING_OPTION_KEY
    $oldSummary = $env:PG_GOV_SUMMARY
    $oldEventJson = $env:PG_GOV_EVENT_JSON
    $oldActionSource = $env:PG_GOV_ACTION_SOURCE
    $oldActionKey = $env:PG_GOV_ACTION_KEY
    $oldBindingId = $env:PG_GOV_BINDING_ID

    try {
        $env:PG_GOV_EVENT_ID = Ensure-Text $event.id
        $env:PG_GOV_THREAD_ID = Ensure-Text $event.thread_id
        $env:PG_GOV_DECISION = Ensure-Text $event.decision
        $env:PG_GOV_WINNING_OPTION_KEY = Ensure-Text $event.winning_option_key
        $env:PG_GOV_SUMMARY = Ensure-Text $event.summary
        $env:PG_GOV_EVENT_JSON = $eventJson
        $env:PG_GOV_ACTION_SOURCE = $source
        $env:PG_GOV_ACTION_KEY = $actionKey
        $env:PG_GOV_BINDING_ID = $bindingId

        $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
        if ($pwsh) {
            $output = & $pwsh.Source -NoProfile -ExecutionPolicy Bypass -Command $command 2>&1
        } else {
            $output = & powershell -NoProfile -ExecutionPolicy Bypass -Command $command 2>&1
        }
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) {
            $exitCode = 0
        }
        if ($exitCode -eq 0) {
            $note = "local command executed successfully (source=$source"
            if (-not [string]::IsNullOrWhiteSpace($actionKey)) {
                $note += ", action_key=$actionKey"
            }
            $note += ")"
            if ($output) {
                $text = (($output | Out-String).Trim())
                if (-not [string]::IsNullOrWhiteSpace($text)) {
                    $note = "${note}: $text"
                }
            }
            return @{
                status = "applied"
                note = $note.Substring(0, [Math]::Min($note.Length, 12000))
                exit_code = $exitCode
            }
        }

        $errorText = ""
        if ($output) {
            $errorText = (($output | Out-String).Trim())
        }
        if ([string]::IsNullOrWhiteSpace($errorText)) {
            $errorText = "command exited with code $exitCode"
        }
        $note = "local command failed (source=$source"
        if (-not [string]::IsNullOrWhiteSpace($actionKey)) {
            $note += ", action_key=$actionKey"
        }
        $note += "): $errorText"
        return @{
            status = "conflict"
            note = $note.Substring(0, [Math]::Min($note.Length, 12000))
            exit_code = $exitCode
        }
    } catch {
        $message = [string]$_.Exception.Message
        $note = "local command exception: $message"
        return @{
            status = "conflict"
            note = $note.Substring(0, [Math]::Min($note.Length, 12000))
            exit_code = -1
        }
    } finally {
        $env:PG_GOV_EVENT_ID = $oldEventId
        $env:PG_GOV_THREAD_ID = $oldThreadId
        $env:PG_GOV_DECISION = $oldDecision
        $env:PG_GOV_WINNING_OPTION_KEY = $oldWinningOption
        $env:PG_GOV_SUMMARY = $oldSummary
        $env:PG_GOV_EVENT_JSON = $oldEventJson
        $env:PG_GOV_ACTION_SOURCE = $oldActionSource
        $env:PG_GOV_ACTION_KEY = $oldActionKey
        $env:PG_GOV_BINDING_ID = $oldBindingId
    }
}

$statePath = if ([string]::IsNullOrWhiteSpace($StateFile)) { Get-DefaultStateFilePath } else { $StateFile }
$state = Read-State -path $statePath

if (-not [string]::IsNullOrWhiteSpace($ApproveCommand)) {
    $state["approve_command"] = $ApproveCommand
}
if (-not [string]::IsNullOrWhiteSpace($NeedsChangeCommand)) {
    $state["needs_change_command"] = $NeedsChangeCommand
}
if (-not [string]::IsNullOrWhiteSpace($RejectCommand)) {
    $state["reject_command"] = $RejectCommand
}

$resolvedPlaybookPath = Resolve-PlaybookPath -state $state -override $PlaybookPath
$playbook = @{ path = ""; actions = @{} }
if (-not [string]::IsNullOrWhiteSpace($resolvedPlaybookPath)) {
    try {
        $playbook = Read-ActionPlaybook -path $resolvedPlaybookPath
        $state["playbook_path"] = $resolvedPlaybookPath
    } catch {
        Write-Warning ("Failed to load governance playbook ({0}). Falling back to command/default handler mode." -f $_.Exception.Message)
    }
}

if ([string]::IsNullOrWhiteSpace($ApiBase)) {
    if ($state.ContainsKey("api_base")) {
        $ApiBase = Ensure-Text $state["api_base"]
    } else {
        $ApiBase = "http://127.0.0.1:8787"
    }
}

$token = ""
if ($state.ContainsKey("access_token")) {
    $token = Ensure-Text $state["access_token"]
}
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "No access token in state. Run .\pg.ps1 governance-login first."
}

$cursor = 0
if ($state.ContainsKey("cursor")) {
    try {
        $cursor = [int]$state["cursor"]
    } catch {
        $cursor = 0
    }
}

Write-Host "Governance worker started."
Write-Host ("- api_base: {0}" -f $ApiBase.TrimEnd("/"))
Write-Host ("- state_file: {0}" -f $statePath)
Write-Host ("- cursor: {0}" -f $cursor)
if (-not [string]::IsNullOrWhiteSpace($resolvedPlaybookPath)) {
    Write-Host ("- playbook: {0}" -f $resolvedPlaybookPath)
}
if ($DryRun.IsPresent) {
    Write-Host "- mode: dry-run"
}

while ($true) {
    $pullUri = "{0}/account/governance/sync/pull?since_sequence={1}&limit={2}" -f $ApiBase.TrimEnd("/"), $cursor, $Limit
    $pull = Invoke-RestMethod -Method Get -Uri $pullUri -Headers @{ Authorization = "Bearer $token" }

    $events = @()
    if ($pull.events) {
        $events = @($pull.events)
    }
    if ($events.Count -gt 0) {
        Write-Host ("Pulled {0} event(s)." -f $events.Count)
    } else {
        Write-Host "No new governance events."
    }

    foreach ($event in $events) {
        $eventId = Ensure-Text $event.id
        $decision = (Ensure-Text $event.decision).ToLowerInvariant()
        $existingAckStatus = ""
        if ($null -ne $event.ack -and $event.ack.PSObject.Properties.Name -contains "status") {
            $existingAckStatus = (Ensure-Text $event.ack.status).ToLowerInvariant()
        }
        if ($existingAckStatus -and $existingAckStatus -ne "pending") {
            Write-Host ("Skipping already-acked event {0} (status={1})." -f $eventId, $existingAckStatus)
            continue
        }

        $execution = Resolve-DecisionCommand `
            -decision $decision `
            -event $event `
            -state $state `
            -playbook $playbook `
            -approveOverride $ApproveCommand `
            -needsChangeOverride $NeedsChangeCommand `
            -rejectOverride $RejectCommand

        $executionSource = Ensure-Text $execution["source"]
        $executionActionKey = Ensure-Text $execution["action_key"]
        if (-not [string]::IsNullOrWhiteSpace($executionActionKey)) {
            Write-Host ("Processing event {0}: decision={1}, source={2}, action_key={3}" -f $eventId, $decision, $executionSource, $executionActionKey)
        } else {
            Write-Host ("Processing event {0}: decision={1}, source={2}" -f $eventId, $decision, $executionSource)
        }
        $execResult = Invoke-DecisionCommand -execution $execution -event $event -dryRun:$DryRun
        $ackStatus = Ensure-Text $execResult.status
        $ackNote = Ensure-Text $execResult.note

        try {
            $ackResult = Invoke-Ack `
                -apiBase $ApiBase `
                -token $token `
                -eventId $eventId `
                -status $ackStatus `
                -note $ackNote
            Write-Host ("Acked event {0} -> {1}" -f $eventId, $ackResult.status)
        } catch {
            Write-Warning ("Failed to ack event {0}: {1}" -f $eventId, $_.Exception.Message)
        }

        $bindingId = Ensure-Text $execution["binding_id"]
        $isOneShot = $false
        if ($execution.ContainsKey("one_shot")) {
            $isOneShot = [bool]$execution["one_shot"]
        }
        if ($isOneShot -and -not [string]::IsNullOrWhiteSpace($bindingId)) {
            Consume-ThreadBinding -state $state -bindingId $bindingId
            Write-Host ("Consumed one-shot thread binding {0}" -f $bindingId)
        }
    }

    if ($pull.PSObject.Properties.Name -contains "cursor") {
        try {
            $cursor = [int]$pull.cursor
        } catch {
            # Keep previous cursor on parse error.
        }
    }
    $state["cursor"] = $cursor
    $state["api_base"] = $ApiBase.TrimEnd("/")
    $state["last_poll_at"] = [DateTime]::UtcNow.ToString("o")
    Write-State -path $statePath -state $state

    if ($Once.IsPresent) {
        break
    }
    Start-Sleep -Seconds $PollSeconds
}

Write-Host "Governance worker completed."
