param(
    [Parameter(Position = 0)]
    [ValidateSet("install", "start", "end", "status", "login", "update", "doctor", "governance-login", "governance-worker", "governance-bind", "governance-digest", "reviewer-policy", "reviewer-check", "slack-check", "narrate-check", "closure-check", "dependency-verify", "coding-verify", "api-contract-verify", "mcp-cloud-score", "cloud-score", "observability-check", "obs-check", "scalability-check", "scale-check", "db-index-check", "db-check", "db-index-fix-plan", "db-fix", "db-index-remediate", "map-structure", "structure-map", "scan-structure", "self-check", "as-you-go-check", "playwright-author", "playwright-smoke-check", "playwright-full-check", "ui-smoke-check", "enforce-trigger", "prod", "dev-profile", "prod-checklist", "production-checklist", "tech-debt", "tech-debt-model", "init", "project-setup", "upgrade-scaffold", "integration", "integration-init", "integration-worker", "backend-start", "frontend-start", "backend-stop", "frontend-stop", "integration-stop", "integration-end", "integration-status", "integration-next", "integration-ready", "integration-complete", "integration-watch", "integration-export", "integration-report", "integration-respond", "integration-summary", "integration-open-page", "review", "review-init", "review-builder-start", "review-reviewer-start", "review-stop", "review-end", "review-status", "review-summary", "review-report", "review-respond", "review-approve", "review-open-page", "stop-enforcement", "resume-enforcement", "help")]
    [string]$Command = "help",

    [ValidateRange(1, 1000)]
    [int]$MaxCommits = 5,

    [ValidateRange(1, 168)]
    [int]$MaxHours = 12,

    [string]$Author = "agent",
    [string]$Note = "",
    [string]$ApiBase = "",
    [string]$PublicBaseUrl = "",
    [string]$TeamKey = "",
    [string]$Email = "",
    [string]$InstallId = "",
    [string]$ManifestPath = "",
    [string[]]$ScanPath = @(),
    [string[]]$ChangedPath = @(),
    [string]$ProjectFramework = "",
    [string]$NodeVersion = "",
    [ValidateRange(1, 2000)]
    [int]$MaxFiles = 400,
    [switch]$IncludeDevDependencies,
    [switch]$DependenciesOnly,
    [switch]$SkipRegistryFetch,
    [switch]$SkipFunctionChecks,
    [switch]$SkipApiContractCheck,
    [switch]$EnableApiContractCheck,
    [switch]$EnableDbIndexMaintenanceCheck,
    [switch]$EnablePlaywrightSmokeCheck,
    [switch]$SkipEnforcement,
    [ValidateSet("warn", "strict")]
    [string]$EnforcementMode = "strict",
    [ValidateSet("start-session", "post-write", "pre-push")]
    [string]$Phase = "start-session",
    [switch]$WarnOnly,
    [string]$OtpCode = "",
    [string]$AccessToken = "",
    [string]$StateFile = "",
    [string]$PlaybookPath = "",
    [string]$PlaywrightWorkingDirectory = "",
    [string]$PlaywrightConfigPath = "",
    [ValidateSet("minimal", "desktop", "full")]
    [string]$PlaywrightBrowserMatrix = "minimal",
    [switch]$InstallPlaywrightBrowsers,
    [string]$DatabaseUrl = "",
    [switch]$AllowDbIndexConnectionWarning,
    [string]$DbPlanOutputPath = "",
    [ValidateRange(1, 1000)]
    [int]$DbMaxRows = 25,
    [switch]$SkipAutoDbFixPlan,
    [string]$ThreadId = "",
    [string]$ActionKey = "",
    [ValidateSet("init", "check", "set", "get", "list", "remove")]
    [string]$DevProfileAction = "check",
    [ValidateSet("auto", "backend", "frontend", "mobile")]
    [string]$MapProfile = "auto",
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
    [string]$Title = "",
    [string]$Details = "",
    [ValidateRange(1, 8)]
    [int]$MapMaxDepth = 4,
    [ValidateRange(100, 10000)]
    [int]$MapMaxEntries = 1400,
    [ValidateRange(1, 30)]
    [int]$MapMaxComponents = 12,
    [switch]$SkipMapStructureGate,
    [string]$ProfilePath = "",
    [string]$ProfileKey = "",
    [string]$ProfileValue = "",
    [ValidateRange(1, 500)]
    [int]$Limit = 100,
    [ValidateRange(1, 1000)]
    [int]$SyncLimit = 300,
    [ValidateRange(2, 3600)]
    [int]$PollSeconds = 15,
    [switch]$SkipDevProfileNotice,
    [string]$ApproveCommand = "",
    [string]$NeedsChangeCommand = "",
    [string]$RejectCommand = "",
    [switch]$Persistent,
    [switch]$Force,
    [switch]$UpgradeScaffold,
    [switch]$Secret,
    [switch]$Prompt,
    [switch]$Reveal,
    [switch]$Json,
    [switch]$Remove,
    [switch]$List,
    [switch]$Once,
    [switch]$DryRun,
    [switch]$SkipPublicChecks,
    [switch]$SkipWorker,
    [switch]$SkipCompile,
    [ValidateSet("strict", "local-core")]
    [string]$ClosureMode = "strict",
    [ValidateSet("legacy", "standard", "strict")]
    [string]$ProdProfile = "standard",
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
    [ValidateSet("auto", "pg-hosted", "customer-hosted", "hybrid")]
    [string]$ObservabilityDeploymentProfile = "auto",
    [ValidateSet("auto", "on", "off")]
    [string]$ObservabilityOtlpEnabled = "auto",
    [string]$ObservabilityOtlpEndpoint = "",
    [ValidateSet("auto", "pg", "customer", "unknown")]
    [string]$ObservabilityOtlpHostedBy = "auto",
    [ValidateSet("auto", "present", "missing")]
    [string]$ObservabilityOtlpToken = "auto",
    [ValidateSet("auto", "on", "off")]
    [string]$ObservabilitySentryEnabled = "auto",
    [string]$ObservabilitySentryEndpoint = "",
    [ValidateSet("auto", "pg", "customer", "unknown")]
    [string]$ObservabilitySentryHostedBy = "auto",
    [ValidateSet("auto", "present", "missing")]
    [string]$ObservabilitySentryToken = "auto",
    [ValidateSet("auto", "on", "off")]
    [string]$ObservabilitySignozEnabled = "auto",
    [string]$ObservabilitySignozEndpoint = "",
    [ValidateSet("auto", "pg", "customer", "unknown")]
    [string]$ObservabilitySignozHostedBy = "auto",
    [ValidateSet("auto", "present", "missing")]
    [string]$ObservabilitySignozToken = "auto",
    [switch]$Yes,
    [switch]$SkipRefresh,
    [string]$TargetPath = "",
    [string]$BackupRoot = "",
    [switch]$SkipPostUpgradeHookInstall,
    [switch]$SkipPostUpgradeStart,
    [switch]$RunSelfCheck,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

$ErrorActionPreference = "Stop"

function Show-Help {
    Write-Host "pg command usage:"
    Write-Host "  .\pg.ps1 install backend"
    Write-Host "  .\pg.ps1 install backend --target ""."" -UpgradeScaffold"
    Write-Host "  .\pg.ps1 map-structure"
    Write-Host "  # start-session blocks by default when map files are missing/stale on legacy repos"
    Write-Host "  # warning-only mode: .\pg.ps1 start -Yes -EnforcementMode warn"
    Write-Host "  # emergency bypass only: .\pg.ps1 start -Yes -SkipMapStructureGate"
    Write-Host "  .\pg.ps1 start -Yes"
    Write-Host "  .\pg.ps1 end -Note ""finished for today"""
    Write-Host "  .\pg.ps1 status"
    Write-Host "  .\pg.ps1 login -Email user@company.com"
    Write-Host "  .\pg.ps1 update"
    Write-Host "  .\pg.ps1 doctor"
    Write-Host "  .\pg.ps1 governance-login -Email user@company.com"
    Write-Host "  .\pg.ps1 governance-worker -Once"
    Write-Host "  .\pg.ps1 governance-bind -ThreadId ""6c920350-9b8c-4067-a0f0-92c8a9b9b42a"" -ActionKey default-handler"
    Write-Host "  .\pg.ps1 governance-bind -List"
    Write-Host "  .\pg.ps1 governance-digest -ApiBase http://127.0.0.1:8787 -TeamKey my-team"
    Write-Host "  .\pg.ps1 governance-digest -ApiBase http://127.0.0.1:8787 -Json"
    Write-Host "  .\pg.ps1 slack-check -ApiBase http://127.0.0.1:8787 -PublicBaseUrl https://pg-ext.addresly.com"
    Write-Host "  .\pg.ps1 narrate-check"
    Write-Host "  .\pg.ps1 narrate-check -SkipCompile"
    Write-Host "  .\pg.ps1 closure-check -ApiBase http://127.0.0.1:8787 -PublicBaseUrl https://pg-ext.addresly.com"
    Write-Host "  .\pg.ps1 closure-check -ClosureMode local-core -ApiBase http://127.0.0.1:8787 -PublicBaseUrl https://pg-ext.addresly.com"
    Write-Host "  .\pg.ps1 governance-worker -PollSeconds 15 -ApproveCommand ""& '.\scripts\governance_action_handler.ps1'"""
    Write-Host "  .\pg.ps1 dependency-verify -ApiBase http://127.0.0.1:8787 -AccessToken ""PASTE_TOKEN_HERE"" -ManifestPath .\server\package.json"
    Write-Host "  .\pg.ps1 dependency-verify   # default scans all service package.json manifests"
    Write-Host "  .\pg.ps1 coding-verify -ApiBase http://127.0.0.1:8787 -AccessToken ""PASTE_TOKEN_HERE"" -ScanPath .\server\src,.\extension\src"
    Write-Host "  .\pg.ps1 api-contract-verify -ApiBase http://127.0.0.1:8787 -AccessToken ""PASTE_TOKEN_HERE"" -ScanPath .\server\src,.\extension\src"
    Write-Host "  .\pg.ps1 mcp-cloud-score -ApiBase http://127.0.0.1:8787 -WorkloadSensitivity regulated"
    Write-Host "  .\pg.ps1 cloud-score -WorkloadSensitivity regulated"
    Write-Host "  .\pg.ps1 mcp-cloud-score -WorkloadSensitivity regulated -ControlCloudflareTunnel pass -ControlSecretsManager pass -ControlDbPortNotPublic pass"
    Write-Host "  .\pg.ps1 observability-check"
    Write-Host "  .\pg.ps1 obs-check"
    Write-Host "  .\pg.ps1 observability-check -ObservabilityDeploymentProfile pg-hosted -ObservabilityOtlpEnabled on -ObservabilityOtlpEndpoint https://otel.yourdomain.com/v1/traces -ObservabilityOtlpToken present"
    Write-Host "  .\pg.ps1 observability-check -ObservabilityDeploymentProfile customer-hosted -ObservabilitySignozEnabled on -ObservabilitySignozHostedBy customer -ObservabilitySignozEndpoint https://signoz.customer.local -ObservabilitySignozToken present"
    Write-Host "  .\pg.ps1 db-index-check"
    Write-Host "  .\pg.ps1 db-check"
    Write-Host "  .\pg.ps1 db-index-fix-plan"
    Write-Host "  .\pg.ps1 db-fix"
    Write-Host "  .\pg.ps1 db-index-remediate"
    Write-Host "  .\pg.ps1 map-structure -MapProfile auto"
    Write-Host "  .\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck -PlaywrightBrowserMatrix desktop"
    Write-Host "  .\pg.ps1 self-check -EnableDbIndexMaintenanceCheck -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers"
    Write-Host "  .\pg.ps1 playwright-author"
    Write-Host "  .\pg.ps1 playwright-smoke-check -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers"
    Write-Host "  .\pg.ps1 playwright-full-check -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers"
    Write-Host "  .\pg.ps1 ui-smoke-check"
    Write-Host "  .\pg.ps1 integration-init"
    Write-Host "  .\pg.ps1 integration-worker -Role backend|frontend -PollSeconds 30"
    Write-Host "  .\pg.ps1 backend-start"
    Write-Host "  .\pg.ps1 frontend-start"
    Write-Host "  .\pg.ps1 backend-start -Persistent -PollSeconds 30"
    Write-Host "  .\pg.ps1 frontend-start -Persistent -PollSeconds 30"
    Write-Host "  .\pg.ps1 backend-stop"
    Write-Host "  .\pg.ps1 frontend-stop"
    Write-Host "  .\pg.ps1 integration-stop -Role backend|frontend"
    Write-Host "  .\pg.ps1 integration-end -Role backend|frontend"
    Write-Host "  .\pg.ps1 integration-status"
    Write-Host "  .\pg.ps1 integration-summary"
    Write-Host "  .\pg.ps1 integration-next -Role backend|frontend"
    Write-Host "  .\pg.ps1 integration-ready -StepId 01-auth-login"
    Write-Host "  .\pg.ps1 integration-complete -StepId 01-auth-login"
    Write-Host "  .\pg.ps1 integration-report -StepId 01-auth-login -Kind backend-missing -Details \"describe the blocker\""
    Write-Host "  .\pg.ps1 integration-respond -StepId 01-auth-login -Resolution fixed -Details \"describe the fix\""
    Write-Host "  .\pg.ps1 integration-watch -Role frontend -PollSeconds 30 -Once"
    Write-Host "  .\pg.ps1 integration-open-page -PageId 02-dashboard"
    Write-Host "  .\pg.ps1 review-init -Title \"review workflow batch\" -Details \"scope\""
    Write-Host "  .\pg.ps1 review-builder-start -Persistent -PollSeconds 30"
    Write-Host "  .\pg.ps1 review-reviewer-start -Persistent -PollSeconds 30"
    Write-Host "  .\pg.ps1 review-status"
    Write-Host "  .\pg.ps1 review-report -PageId 01-review-task -Title \"finding\" -Kind medium -Details \"evidence\""
    Write-Host "  .\pg.ps1 review-respond -PageId 01-review-task -Resolution fixed -Details \"patch + validation\""
    Write-Host "  .\pg.ps1 review-approve -PageId 01-review-task -Details \"verified\""
    Write-Host "  .\pg.ps1 review-stop -Role builder|reviewer"
    Write-Host "  .\pg.ps1 review-end -Details \"finished\""
    Write-Host "  .\pg.ps1 stop-enforcement"
    Write-Host "  .\pg.ps1 resume-enforcement"
    Write-Host "  CMD wrapper equivalents: pg.cmd stop-enforcement | pg.cmd resume-enforcement | pg.cmd start -Yes"
    Write-Host "  Alias forms: .\pg.ps1 start backend | .\pg.ps1 start frontend | .\pg.ps1 integration worker backend | .\pg.ps1 integration summary | .\pg.ps1 integration stop backend | .\pg.ps1 integration end frontend | .\pg.ps1 integration page 02-dashboard"
    Write-Host "  .\pg.ps1 enforce-trigger -Phase pre-push -ApiBase http://127.0.0.1:8787 -ProjectFramework nestjs"
    Write-Host "  .\pg.ps1 prod -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json"
    Write-Host "  .\pg.ps1 prod                # default dependency check scans all service manifests"
    Write-Host "  .\pg.ps1 prod -ProdProfile strict -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json -PlaywrightBrowserMatrix full -InstallPlaywrightBrowsers"
    Write-Host "  .\pg.ps1 prod -ProdProfile legacy -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json"
    Write-Host "  .\pg.ps1 prod -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json"
    Write-Host "  .\pg.ps1 dev-profile -DevProfileAction init"
    Write-Host "  .\pg.ps1 dev-profile -DevProfileAction set -ProfileKey db_host -ProfileValue 127.0.0.1"
    Write-Host "  .\pg.ps1 dev-profile -DevProfileAction set -ProfileKey db_password -Secret -Prompt"
    Write-Host "  .\pg.ps1 dev-profile -DevProfileAction check"
    Write-Host "  .\pg.ps1 login -ApiBase http://127.0.0.1:8787 -Email user@company.com"
    Write-Host "  .\pg.ps1 update -ApiBase http://127.0.0.1:8787"
    Write-Host "  .\pg.ps1 upgrade-scaffold -DryRun"
    Write-Host "  .\pg.ps1 upgrade-scaffold -Yes"
    Write-Host "  .\pg.ps1 doctor -ApiBase http://127.0.0.1:8787"
    Write-Host ""
    Write-Host "DB index quick flow (run from repo root):"
    Write-Host "  1) .\pg.ps1 db-index-check"
    Write-Host "  2) .\pg.ps1 db-index-fix-plan -DbMaxRows 5 -DbPlanOutputPath .\Memory-bank\_generated\db-index-fix-plan-next5.md"
    Write-Host "  3) Run plan SQL inside PostgreSQL (psql/Prisma/pgAdmin), then:"
    Write-Host "     .\pg.ps1 db-index-check"
    Write-Host ""
    Write-Host "As-you-go agent command (recommended while building):"
    Write-Host "  .\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck"
    Write-Host "  # Runs post-write enforcement + DB check (+ auto fix-plan generation when findings exist)."
    Write-Host "  # Playwright smoke is mandatory, writes HTML/JSON evidence under Memory-bank/_generated/playwright-smoke, and defaults to .\server when working directory is omitted."
    Write-Host "  # Use -PlaywrightBrowserMatrix minimal|desktop|full and -InstallPlaywrightBrowsers for course-style multi-browser runs."
    Write-Host ""
    Write-Host "Legacy or half-built project structure mapping:"
    Write-Host "  .\pg.ps1 map-structure"
    Write-Host "  # Scans existing code + migration/schema files and updates Memory-bank/code-tree + Memory-bank/db-schema auto docs."
    Write-Host "  # Optional tuning: -MapProfile auto|backend|frontend|mobile -MapMaxDepth 4 -MapMaxEntries 1400 -MapMaxComponents 12"
    Write-Host ""
    Write-Host "PG prod profile defaults:"
    Write-Host "  -ProdProfile legacy   => dependency + coding + Playwright smoke"
    Write-Host "  -ProdProfile standard => legacy + API contract + DB index maintenance (default)"
    Write-Host "  -ProdProfile strict   => standard + any future strict-only overlays"
    Write-Host "  If omitted, -ProdProfile now auto-resolves from pg lifecycle state when available."
    Write-Host "  Explicit -Enable* flags always force that check on."
    Write-Host ""
    Write-Host "DB index troubleshooting:"
    Write-Host "  - Always use local command prefix: .\pg.ps1 ..."
    Write-Host "  - If you see command set {install,start,...}, you ran global pg CLI from PATH."
    Write-Host "    Fix: rerun with .\pg.ps1 from this repo."
    Write-Host "  - If '.\pg.ps1' is not recognized, you are not in repo root."
    Write-Host ("    Fix: cd '{0}'" -f (Resolve-Path (Join-Path $scriptDir "..")).Path)
    Write-Host "  - If terminal shows '>>', press Ctrl+C once, then rerun one command per line."
    Write-Host "  - SQL like 'SHOW ...' must run in PostgreSQL, not directly in PowerShell."
    Write-Host ""
    Write-Host "Example SQL execution via Prisma (no psql required):"
    Write-Host "  cd .\server"
    Write-Host "  @'"
    Write-Host "  SHOW shared_preload_libraries;"
    Write-Host "  '@ | npx prisma db execute --stdin"
    Write-Host ""
    Write-Host "Note: install delegates to global CLI if available (~\.pg-cli\pg.ps1), except local scaffold upgrade mode (`-UpgradeScaffold`) which runs from this repo."
}

function Resolve-InstallRequest([string[]]$tokens, [string]$explicitTargetPath) {
    $profile = "backend"
    $target = if ([string]::IsNullOrWhiteSpace($explicitTargetPath)) { "" } else { $explicitTargetPath }

    for ($index = 0; $index -lt $tokens.Count; $index++) {
        $token = [string]$tokens[$index]
        if ([string]::IsNullOrWhiteSpace($token)) {
            continue
        }

        $normalized = $token.Trim().ToLowerInvariant()
        if ($normalized -in @("backend", "frontend")) {
            $profile = $normalized
            continue
        }

        if ($normalized -in @("--target", "-target")) {
            if ($index + 1 -lt $tokens.Count) {
                $target = $tokens[$index + 1]
                $index += 1
            }
            continue
        }
    }

    if ([string]::IsNullOrWhiteSpace($target)) {
        $target = (Get-Location).Path
    }

    return [ordered]@{
        profile = $profile
        target = [System.IO.Path]::GetFullPath($target)
    }
}

$scriptDir = $PSScriptRoot
$repoRootForDefaults = (Resolve-Path (Join-Path $scriptDir "..")).Path

function Get-EnforcementBridgePath {
    return Join-Path $repoRootForDefaults "Memory-bank\_generated\pg-enforcement-bridge.json"
}

function Invoke-EnforcementBridgeAction([string]$action) {
    $bridgePath = Get-EnforcementBridgePath
    $bridgeDir = Split-Path -Parent $bridgePath
    if (-not (Test-Path -LiteralPath $bridgeDir)) {
        New-Item -ItemType Directory -Path $bridgeDir -Force | Out-Null
    }

    $requestId = [guid]::NewGuid().ToString()
    $payload = [ordered]@{
        request_id = $requestId
        action = $action
        requested_at_utc = [DateTime]::UtcNow.ToString("o")
        source = "pg-cli"
        status = "pending"
        handled_at_utc = $null
        message = $null
    }
    $json = $payload | ConvertTo-Json -Depth 5
    Set-Content -LiteralPath $bridgePath -Value $json -Encoding UTF8

    $deadline = [DateTime]::UtcNow.AddSeconds(8)
    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 250
        try {
            $raw = Get-Content -LiteralPath $bridgePath -Raw
            if ([string]::IsNullOrWhiteSpace($raw)) {
                continue
            }
            $current = ConvertFrom-Json -InputObject $raw
            if ($null -eq $current -or $current.request_id -ne $requestId) {
                continue
            }
            if ($current.status -eq "applied") {
                Write-Host ([string]$current.message)
                return 0
            }
            if ($current.status -eq "failed") {
                Write-Warning ([string]$current.message)
                return 1
            }
        }
        catch {
            continue
        }
    }

    Write-Warning "Narrate did not acknowledge the enforcement bridge request yet. Keep the extension open in this workspace and it will apply from Memory-bank/_generated/pg-enforcement-bridge.json."
    return 0
}

function Resolve-ProdProfileFromLifecycleState([string]$statePath) {
    if ([string]::IsNullOrWhiteSpace($statePath)) {
        return ""
    }
    if (-not (Test-Path -LiteralPath $statePath)) {
        return ""
    }
    try {
        $raw = Get-Content -LiteralPath $statePath -Raw
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return ""
        }
        $parsed = ConvertFrom-Json -InputObject $raw
        if ($null -eq $parsed) {
            return ""
        }
        $recommended = ""
        if ($parsed.PSObject.Properties.Name -contains "recommended_prod_profile") {
            $recommended = [string]$parsed.recommended_prod_profile
        }
        if ($recommended -in @("legacy", "standard", "strict")) {
            return $recommended
        }
        return ""
    }
    catch {
        return ""
    }
}

$effectiveProdProfile = $ProdProfile
if ($Command -eq "prod" -and -not $PSBoundParameters.ContainsKey("ProdProfile")) {
    $lifecycleStatePath = if ($StateFile) { $StateFile } else { Join-Path $repoRootForDefaults "Memory-bank\_generated\pg-cli-state.json" }
    $recommendedProfile = Resolve-ProdProfileFromLifecycleState -statePath $lifecycleStatePath
    if ($recommendedProfile -in @("legacy", "standard", "strict")) {
        $effectiveProdProfile = $recommendedProfile
    }
}

$resolvedPlaywrightWorkingDirectory = $PlaywrightWorkingDirectory
if ([string]::IsNullOrWhiteSpace($resolvedPlaywrightWorkingDirectory)) {
    $serverCandidate = Join-Path $repoRootForDefaults "server"
    if (Test-Path -LiteralPath $serverCandidate) {
        $resolvedPlaywrightWorkingDirectory = ".\server"
    }
}

if ($Command -eq "start" -and $Rest.Count -gt 0) {
    $startAlias = $Rest[0].Trim().ToLowerInvariant()
    switch ($startAlias) {
        "backend" {
            $Command = "backend-start"
            $Role = "backend"
            if ($Rest.Count -gt 1) {
                $Rest = @($Rest[1..($Rest.Count - 1)])
            }
            else {
                $Rest = @()
            }
        }
        "frontend" {
            $Command = "frontend-start"
            $Role = "frontend"
            if ($Rest.Count -gt 1) {
                $Rest = @($Rest[1..($Rest.Count - 1)])
            }
            else {
                $Rest = @()
            }
        }
    }
}

if ($Command -eq "integration" -and $Rest.Count -gt 0) {
    $integrationAlias = $Rest[0].Trim().ToLowerInvariant()
    switch ($integrationAlias) {
        "init" { $Command = "integration-init" }
        "status" { $Command = "integration-status" }
        "summary" { $Command = "integration-summary" }
        "worker" {
            $Command = "integration-worker"
            if (-not $Role -and $Rest.Count -gt 1) { $Role = $Rest[1].Trim().ToLowerInvariant() }
        }
        "stop" {
            $Command = "integration-stop"
            if (-not $Role -and $Rest.Count -gt 1) { $Role = $Rest[1].Trim().ToLowerInvariant() }
        }
        "end" {
            $Command = "integration-end"
            if (-not $Role -and $Rest.Count -gt 1) { $Role = $Rest[1].Trim().ToLowerInvariant() }
        }
        "next" { $Command = "integration-next" }
        "ready" {
            $Command = "integration-ready"
            if (-not $StepId -and $Rest.Count -gt 1) { $StepId = $Rest[1] }
        }
        "complete" {
            $Command = "integration-complete"
            if (-not $StepId -and $Rest.Count -gt 1) { $StepId = $Rest[1] }
        }
        "watch" { $Command = "integration-watch" }
        "export" {
            $Command = "integration-export"
            if (-not $StepId -and $Rest.Count -gt 1) { $StepId = $Rest[1] }
        }
        "report" {
            $Command = "integration-report"
            if (-not $StepId -and $Rest.Count -gt 1) { $StepId = $Rest[1] }
        }
        "respond" {
            $Command = "integration-respond"
            if (-not $StepId -and $Rest.Count -gt 1) { $StepId = $Rest[1] }
        }
        "page" {
            $Command = "integration-open-page"
            if (-not $PageId -and $Rest.Count -gt 1) { $PageId = $Rest[1] }
        }
    }
}

if ($Command -eq "review" -and $Rest.Count -gt 0) {
    $reviewAlias = $Rest[0].Trim().ToLowerInvariant()
    switch ($reviewAlias) {
        "init" { $Command = "review-init" }
        "builder-start" {
            $Command = "review-builder-start"
            $Role = "builder"
        }
        "reviewer-start" {
            $Command = "review-reviewer-start"
            $Role = "reviewer"
        }
        "status" { $Command = "review-status" }
        "summary" { $Command = "review-summary" }
        "report" {
            $Command = "review-report"
            if (-not $PageId -and $Rest.Count -gt 1) { $PageId = $Rest[1] }
        }
        "respond" {
            $Command = "review-respond"
            if (-not $PageId -and $Rest.Count -gt 1) { $PageId = $Rest[1] }
        }
        "approve" {
            $Command = "review-approve"
            if (-not $PageId -and $Rest.Count -gt 1) { $PageId = $Rest[1] }
        }
        "stop" {
            $Command = "review-stop"
            if (-not $Role -and $Rest.Count -gt 1) { $Role = $Rest[1].Trim().ToLowerInvariant() }
        }
        "end" { $Command = "review-end" }
        "page" {
            $Command = "review-open-page"
            if (-not $PageId -and $Rest.Count -gt 1) { $PageId = $Rest[1] }
        }
    }
}

switch ($Command) {
    "install" {
        $installRequest = Resolve-InstallRequest -tokens $Rest -explicitTargetPath $TargetPath
        if ($UpgradeScaffold.IsPresent) {
            $args = @{
                TargetPath = $installRequest.target
                DryRun = $DryRun.IsPresent
                Yes = $Yes.IsPresent
                Json = $Json.IsPresent
                SkipPostUpgradeHookInstall = $SkipPostUpgradeHookInstall.IsPresent
                SkipPostUpgradeStart = $SkipPostUpgradeStart.IsPresent
                RunSelfCheck = $RunSelfCheck.IsPresent
            }
            if ($BackupRoot) {
                $args["BackupRoot"] = $BackupRoot
            }
            & (Join-Path $scriptDir "scaffold_upgrade.ps1") @args
            exit $LASTEXITCODE
        }
        $globalPg = Join-Path $HOME ".pg-cli\pg.ps1"
        if (-not (Test-Path -LiteralPath $globalPg)) {
            throw "Install command requires global pg CLI. Run pg-install.ps1 once on this machine."
        }
        Write-Host "Delegating install to global pg CLI..."
        & powershell -ExecutionPolicy Bypass -File $globalPg "install" @Rest
        exit $LASTEXITCODE
    }
    "start" {
        $args = @{
            MaxCommits = $MaxCommits
            MaxHours = $MaxHours
            Author = $Author
            SkipRefresh = $SkipRefresh.IsPresent
            SkipEnforcement = $SkipEnforcement.IsPresent
            SkipMapStructureGate = $SkipMapStructureGate.IsPresent
            EnforcementMode = $EnforcementMode
            ApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
            AccessToken = $AccessToken
            StateFile = $StateFile
        }
        if ($Yes.IsPresent) {
            $args["Yes"] = $true
        }
        if ($SkipDevProfileNotice.IsPresent) {
            $args["SkipDevProfileNotice"] = $true
        }
        & (Join-Path $scriptDir "start_memory_bank_session.ps1") @args
        exit $LASTEXITCODE
    }
    "end" {
        $args = @{
            Author = $Author
            Note = $Note
            SkipRefresh = $SkipRefresh.IsPresent
        }
        & (Join-Path $scriptDir "end_memory_bank_session.ps1") @args
        exit $LASTEXITCODE
    }
    "status" {
        & python (Join-Path $scriptDir "session_status.py")
        exit $LASTEXITCODE
    }
    "stop-enforcement" {
        $code = Invoke-EnforcementBridgeAction -action "stop"
        exit $code
    }
    "resume-enforcement" {
        $code = Invoke-EnforcementBridgeAction -action "resume"
        exit $code
    }
    "login" {
        $args = @{
            Action = "login"
            Email = $Email
            InstallId = $InstallId
            OtpCode = $OtpCode
            AccessToken = $AccessToken
            StateFile = $StateFile
            Yes = $Yes.IsPresent
            Json = $Json.IsPresent
        }
        if ($PSBoundParameters.ContainsKey("ApiBase")) {
            $args["ApiBase"] = $ApiBase
        }
        & (Join-Path $scriptDir "pg_lifecycle.ps1") @args
        exit $LASTEXITCODE
    }
    "update" {
        $args = @{
            Action = "update"
            Email = $Email
            InstallId = $InstallId
            AccessToken = $AccessToken
            StateFile = $StateFile
            Json = $Json.IsPresent
        }
        if ($PSBoundParameters.ContainsKey("ApiBase")) {
            $args["ApiBase"] = $ApiBase
        }
        & (Join-Path $scriptDir "pg_lifecycle.ps1") @args
        exit $LASTEXITCODE
    }
    "doctor" {
        $args = @{
            Action = "doctor"
            AccessToken = $AccessToken
            StateFile = $StateFile
            Json = $Json.IsPresent
        }
        if ($PSBoundParameters.ContainsKey("ApiBase")) {
            $args["ApiBase"] = $ApiBase
        }
        & (Join-Path $scriptDir "pg_lifecycle.ps1") @args
        exit $LASTEXITCODE
    }
    "governance-login" {
        $args = @{
            ApiBase = $ApiBase
            Email = $Email
            InstallId = $InstallId
            OtpCode = $OtpCode
            AccessToken = $AccessToken
            StateFile = $StateFile
        }
        & (Join-Path $scriptDir "governance_login.ps1") @args
        exit $LASTEXITCODE
    }
    "governance-worker" {
        $args = @{
            ApiBase = $ApiBase
            StateFile = $StateFile
            PlaybookPath = $PlaybookPath
            Limit = $Limit
            PollSeconds = $PollSeconds
            ApproveCommand = $ApproveCommand
            NeedsChangeCommand = $NeedsChangeCommand
            RejectCommand = $RejectCommand
            Once = $Once.IsPresent
            DryRun = $DryRun.IsPresent
        }
        & (Join-Path $scriptDir "governance_worker.ps1") @args
        exit $LASTEXITCODE
    }
    "governance-bind" {
        $args = @{
            ThreadId = $ThreadId
            ActionKey = $ActionKey
            StateFile = $StateFile
            PlaybookPath = $PlaybookPath
            Persistent = $Persistent.IsPresent
            Remove = $Remove.IsPresent
            List = $List.IsPresent
        }
        & (Join-Path $scriptDir "governance_bind_action.ps1") @args
        exit $LASTEXITCODE
    }
    "governance-digest" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase  = $resolvedApiBase
            Json     = $Json.IsPresent
        }
        if ($StateFile) { $args["StateFile"] = $StateFile }
        if ($TeamKey)   { $args["TeamKey"]   = $TeamKey   }
        if ($AccessToken) { $args["AccessToken"] = $AccessToken }
        & (Join-Path $scriptDir "governance_digest.ps1") @args
        exit $LASTEXITCODE
    }
    "reviewer-policy" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            Action = "status"
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            Json = $Json.IsPresent
        }
        if ($StateFile) { $args["StateFile"] = $StateFile }
        if ($TeamKey)   { $args["TeamKey"]   = $TeamKey   }
        if ($ThreadId)  { $args["ThreadId"]  = $ThreadId  }
        & (Join-Path $scriptDir "reviewer_automation.ps1") @args
        exit $LASTEXITCODE
    }
    "reviewer-check" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            Action = "sla"
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            Json = $Json.IsPresent
        }
        if ($StateFile) { $args["StateFile"] = $StateFile }
        if ($TeamKey)   { $args["TeamKey"]   = $TeamKey   }
        & (Join-Path $scriptDir "reviewer_automation.ps1") @args
        exit $LASTEXITCODE
    }
    "slack-check" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase = $resolvedApiBase
            SyncLimit = $SyncLimit
            Json = $Json.IsPresent
        }
        if ($PublicBaseUrl) {
            $args["PublicBaseUrl"] = $PublicBaseUrl
        }
        if ($TeamKey) {
            $args["TeamKey"] = $TeamKey
        }
        if ($StateFile) {
            $args["StateFile"] = $StateFile
        }
        if ($ActionKey) {
            $args["ActionKey"] = $ActionKey
        }
        if ($SkipPublicChecks.IsPresent) {
            $args["SkipPublicChecks"] = $true
        }
        if ($SkipWorker.IsPresent) {
            $args["SkipWorker"] = $true
        }
        & (Join-Path $scriptDir "slack_transport_check.ps1") @args
        exit $LASTEXITCODE
    }
    "narrate-check" {
        $args = @{
            Json = $Json.IsPresent
            SkipCompile = $SkipCompile.IsPresent
        }
        & (Join-Path $scriptDir "narrate_flow_check.ps1") @args
        exit $LASTEXITCODE
    }
    "closure-check" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $resolvedPublicBaseUrl = if ($PublicBaseUrl) { $PublicBaseUrl } else { "https://pg-ext.addresly.com" }
        $resolvedTeamKey = if ($TeamKey) { $TeamKey } else { "TEAM-EXTENSON-PG" }
        $resolvedActionKey = if ($ActionKey) { $ActionKey } else { "default-handler" }
        $args = @{
            ApiBase = $resolvedApiBase
            PublicBaseUrl = $resolvedPublicBaseUrl
            TeamKey = $resolvedTeamKey
            ActionKey = $resolvedActionKey
            SyncLimit = $SyncLimit
            Mode = $ClosureMode
            Json = $Json.IsPresent
            SkipPublicChecks = $SkipPublicChecks.IsPresent
            SkipWorker = $SkipWorker.IsPresent
            SkipCompile = $SkipCompile.IsPresent
        }
        if ($StateFile) {
            $args["StateFile"] = $StateFile
        }
        & (Join-Path $scriptDir "milestone_closure_check.ps1") @args
        exit $LASTEXITCODE
    }
    "dependency-verify" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            ManifestPath = $ManifestPath
            ProjectFramework = $ProjectFramework
            NodeVersion = $NodeVersion
            DependenciesOnly = $DependenciesOnly.IsPresent
            SkipRegistryFetch = $SkipRegistryFetch.IsPresent
        }
        & (Join-Path $scriptDir "dependency_verify.ps1") @args
        exit $LASTEXITCODE
    }
    "coding-verify" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            ProjectFramework = $ProjectFramework
            MaxFiles = $MaxFiles
            SkipFunctionChecks = $SkipFunctionChecks.IsPresent
        }
        if ($ScanPath -and $ScanPath.Count -gt 0) {
            $args["ScanPath"] = $ScanPath
        }
        & (Join-Path $scriptDir "coding_verify.ps1") @args
        exit $LASTEXITCODE
    }
    "api-contract-verify" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            MaxFiles = $MaxFiles
        }
        if ($ScanPath -and $ScanPath.Count -gt 0) {
            $args["ScanPath"] = $ScanPath
        }
        & (Join-Path $scriptDir "api_contract_verify.ps1") @args
        exit $LASTEXITCODE
    }
    "mcp-cloud-score" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            StateFile = $StateFile
            ManifestPath = $ManifestPath
            ProjectFramework = $ProjectFramework
            NodeVersion = $NodeVersion
            MaxFiles = $MaxFiles
            MaxFileBytes = 300000
            IncludeDevDependencies = $IncludeDevDependencies.IsPresent
            SkipFunctionChecks = $SkipFunctionChecks.IsPresent
            SkipApiContractCheck = $SkipApiContractCheck.IsPresent
            WorkloadSensitivity = $WorkloadSensitivity
            MonthlyBudgetUsd = $MonthlyBudgetUsd
            ProviderCloudflare = $ProviderCloudflare
            ProviderAws = $ProviderAws
            ProviderHetzner = $ProviderHetzner
            ProviderCloudfront = $ProviderCloudfront
            ProviderAwsShieldAdvanced = $ProviderAwsShieldAdvanced
            ControlCloudflareTunnel = $ControlCloudflareTunnel
            ControlCloudflareFullStrictTls = $ControlCloudflareFullStrictTls
            ControlEc2PrivateSubnetOnly = $ControlEc2PrivateSubnetOnly
            ControlDbPublicAccessDisabled = $ControlDbPublicAccessDisabled
            ControlWireguardDbTunnel = $ControlWireguardDbTunnel
            ControlSecretsManager = $ControlSecretsManager
            ControlIamRoleNoAccessKeys = $ControlIamRoleNoAccessKeys
            ControlCloudTrailMultiRegion = $ControlCloudTrailMultiRegion
            ControlBackupRestoreTested30d = $ControlBackupRestoreTested30d
            ControlImdsV2Enforced = $ControlImdsV2Enforced
            ControlSshPortClosedPublic = $ControlSshPortClosedPublic
            ControlDbPortNotPublic = $ControlDbPortNotPublic
            ControlWafManagedRulesEnabled = $ControlWafManagedRulesEnabled
            ControlAuthRateLimitsEnabled = $ControlAuthRateLimitsEnabled
            ControlCiSecretScanningEnabled = $ControlCiSecretScanningEnabled
            ControlWireguardAlertEnabled = $ControlWireguardAlertEnabled
            ControlCloudTrailRootLoginAlert = $ControlCloudTrailRootLoginAlert
            ControlEc2MultiAz = $ControlEc2MultiAz
            Json = $Json.IsPresent
        }
        if ($ScanPath -and $ScanPath.Count -gt 0) {
            $args["ScanPath"] = $ScanPath
        }
        & (Join-Path $scriptDir "mcp_cloud_score_verify.ps1") @args
        exit $LASTEXITCODE
    }
    "cloud-score" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            StateFile = $StateFile
            ManifestPath = $ManifestPath
            ProjectFramework = $ProjectFramework
            NodeVersion = $NodeVersion
            MaxFiles = $MaxFiles
            MaxFileBytes = 300000
            IncludeDevDependencies = $IncludeDevDependencies.IsPresent
            SkipFunctionChecks = $SkipFunctionChecks.IsPresent
            SkipApiContractCheck = $SkipApiContractCheck.IsPresent
            WorkloadSensitivity = $WorkloadSensitivity
            MonthlyBudgetUsd = $MonthlyBudgetUsd
            ProviderCloudflare = $ProviderCloudflare
            ProviderAws = $ProviderAws
            ProviderHetzner = $ProviderHetzner
            ProviderCloudfront = $ProviderCloudfront
            ProviderAwsShieldAdvanced = $ProviderAwsShieldAdvanced
            ControlCloudflareTunnel = $ControlCloudflareTunnel
            ControlCloudflareFullStrictTls = $ControlCloudflareFullStrictTls
            ControlEc2PrivateSubnetOnly = $ControlEc2PrivateSubnetOnly
            ControlDbPublicAccessDisabled = $ControlDbPublicAccessDisabled
            ControlWireguardDbTunnel = $ControlWireguardDbTunnel
            ControlSecretsManager = $ControlSecretsManager
            ControlIamRoleNoAccessKeys = $ControlIamRoleNoAccessKeys
            ControlCloudTrailMultiRegion = $ControlCloudTrailMultiRegion
            ControlBackupRestoreTested30d = $ControlBackupRestoreTested30d
            ControlImdsV2Enforced = $ControlImdsV2Enforced
            ControlSshPortClosedPublic = $ControlSshPortClosedPublic
            ControlDbPortNotPublic = $ControlDbPortNotPublic
            ControlWafManagedRulesEnabled = $ControlWafManagedRulesEnabled
            ControlAuthRateLimitsEnabled = $ControlAuthRateLimitsEnabled
            ControlCiSecretScanningEnabled = $ControlCiSecretScanningEnabled
            ControlWireguardAlertEnabled = $ControlWireguardAlertEnabled
            ControlCloudTrailRootLoginAlert = $ControlCloudTrailRootLoginAlert
            ControlEc2MultiAz = $ControlEc2MultiAz
            Json = $Json.IsPresent
        }
        if ($ScanPath -and $ScanPath.Count -gt 0) {
            $args["ScanPath"] = $ScanPath
        }
        & (Join-Path $scriptDir "mcp_cloud_score_verify.ps1") @args
        exit $LASTEXITCODE
    }
    "observability-check" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            StateFile = $StateFile
            DeploymentProfile = $ObservabilityDeploymentProfile
            OtlpEnabled = $ObservabilityOtlpEnabled
            OtlpEndpoint = $ObservabilityOtlpEndpoint
            OtlpHostedBy = $ObservabilityOtlpHostedBy
            OtlpToken = $ObservabilityOtlpToken
            SentryEnabled = $ObservabilitySentryEnabled
            SentryEndpoint = $ObservabilitySentryEndpoint
            SentryHostedBy = $ObservabilitySentryHostedBy
            SentryToken = $ObservabilitySentryToken
            SignozEnabled = $ObservabilitySignozEnabled
            SignozEndpoint = $ObservabilitySignozEndpoint
            SignozHostedBy = $ObservabilitySignozHostedBy
            SignozToken = $ObservabilitySignozToken
            Json = $Json.IsPresent
        }
        & (Join-Path $scriptDir "observability_check.ps1") @args
        exit $LASTEXITCODE
    }
    "obs-check" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            StateFile = $StateFile
            DeploymentProfile = $ObservabilityDeploymentProfile
            OtlpEnabled = $ObservabilityOtlpEnabled
            OtlpEndpoint = $ObservabilityOtlpEndpoint
            OtlpHostedBy = $ObservabilityOtlpHostedBy
            OtlpToken = $ObservabilityOtlpToken
            SentryEnabled = $ObservabilitySentryEnabled
            SentryEndpoint = $ObservabilitySentryEndpoint
            SentryHostedBy = $ObservabilitySentryHostedBy
            SentryToken = $ObservabilitySentryToken
            SignozEnabled = $ObservabilitySignozEnabled
            SignozEndpoint = $ObservabilitySignozEndpoint
            SignozHostedBy = $ObservabilitySignozHostedBy
            SignozToken = $ObservabilitySignozToken
            Json = $Json.IsPresent
        }
        & (Join-Path $scriptDir "observability_check.ps1") @args
        exit $LASTEXITCODE
    }
    "db-index-check" {
        $args = @{
            DatabaseUrl = $DatabaseUrl
        }
        & (Join-Path $scriptDir "db_index_maintenance_check.ps1") @args
        exit $LASTEXITCODE
    }
    "db-check" {
        $args = @{
            DatabaseUrl = $DatabaseUrl
        }
        & (Join-Path $scriptDir "db_index_maintenance_check.ps1") @args
        exit $LASTEXITCODE
    }
    "scalability-check" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            StateFile = $StateFile
            Json = $Json.IsPresent
        }
        & (Join-Path $scriptDir "scalability_check.ps1") @args
        exit $LASTEXITCODE
    }
    "scale-check" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            StateFile = $StateFile
            Json = $Json.IsPresent
        }
        & (Join-Path $scriptDir "scalability_check.ps1") @args
        exit $LASTEXITCODE
    }
    "db-index-fix-plan" {
        $args = @{
            DatabaseUrl = $DatabaseUrl
            MaxRows = $DbMaxRows
            OutputPath = $DbPlanOutputPath
        }
        & (Join-Path $scriptDir "db_index_fix_plan.ps1") @args
        exit $LASTEXITCODE
    }
    "db-fix" {
        $args = @{
            DatabaseUrl = $DatabaseUrl
            MaxRows = $DbMaxRows
            OutputPath = $DbPlanOutputPath
        }
        & (Join-Path $scriptDir "db_index_fix_plan.ps1") @args
        exit $LASTEXITCODE
    }
    "db-index-remediate" {
        $args = @{
            DatabaseUrl = $DatabaseUrl
            MaxRows = $DbMaxRows
            OutputPath = $DbPlanOutputPath
        }
        & (Join-Path $scriptDir "db_index_fix_plan.ps1") @args
        exit $LASTEXITCODE
    }
    "map-structure" {
        $args = @(
            (Join-Path $scriptDir "map_structure.py"),
            "--profile", $MapProfile,
            "--max-depth", $MapMaxDepth,
            "--max-entries", $MapMaxEntries,
            "--max-components", $MapMaxComponents
        )
        & python @args
        exit $LASTEXITCODE
    }
    "structure-map" {
        $args = @(
            (Join-Path $scriptDir "map_structure.py"),
            "--profile", $MapProfile,
            "--max-depth", $MapMaxDepth,
            "--max-entries", $MapMaxEntries,
            "--max-components", $MapMaxComponents
        )
        & python @args
        exit $LASTEXITCODE
    }
    "scan-structure" {
        $args = @(
            (Join-Path $scriptDir "map_structure.py"),
            "--profile", $MapProfile,
            "--max-depth", $MapMaxDepth,
            "--max-entries", $MapMaxEntries,
            "--max-components", $MapMaxComponents
        )
        & python @args
        exit $LASTEXITCODE
    }
    "self-check" {
        $args = @{
            ApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
            AccessToken = $AccessToken
            ProjectFramework = if ($ProjectFramework) { $ProjectFramework } else { "unknown" }
            MaxFiles = $MaxFiles
            IncludeDevDependencies = $IncludeDevDependencies.IsPresent
            SkipDependencyRegistryFetch = $SkipRegistryFetch.IsPresent
            SkipFunctionChecks = $SkipFunctionChecks.IsPresent
            EnableDbIndexMaintenanceCheck = $EnableDbIndexMaintenanceCheck.IsPresent
            DatabaseUrl = $DatabaseUrl
            AllowDbIndexConnectionWarning = $AllowDbIndexConnectionWarning.IsPresent
            DbMaxRows = $DbMaxRows
            DbPlanOutputPath = $DbPlanOutputPath
            SkipAutoDbFixPlan = $SkipAutoDbFixPlan.IsPresent
            EnablePlaywrightSmokeCheck = $EnablePlaywrightSmokeCheck.IsPresent
            PlaywrightWorkingDirectory = $resolvedPlaywrightWorkingDirectory
            PlaywrightConfigPath = $PlaywrightConfigPath
            PlaywrightBrowserMatrix = $PlaywrightBrowserMatrix
            InstallPlaywrightBrowsers = $InstallPlaywrightBrowsers.IsPresent
            WarnOnly = $WarnOnly.IsPresent
            StateFile = $StateFile
        }
        if ($ScanPath -and $ScanPath.Count -gt 0) {
            $args["ScanPath"] = $ScanPath
        }
        if ($ChangedPath -and $ChangedPath.Count -gt 0) {
            $args["ChangedPath"] = $ChangedPath
        }
        & (Join-Path $scriptDir "self_check.ps1") @args
        exit $LASTEXITCODE
    }
    "as-you-go-check" {
        $args = @{
            ApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
            AccessToken = $AccessToken
            ProjectFramework = if ($ProjectFramework) { $ProjectFramework } else { "unknown" }
            MaxFiles = $MaxFiles
            IncludeDevDependencies = $IncludeDevDependencies.IsPresent
            SkipDependencyRegistryFetch = $SkipRegistryFetch.IsPresent
            SkipFunctionChecks = $SkipFunctionChecks.IsPresent
            EnableDbIndexMaintenanceCheck = $EnableDbIndexMaintenanceCheck.IsPresent
            DatabaseUrl = $DatabaseUrl
            AllowDbIndexConnectionWarning = $AllowDbIndexConnectionWarning.IsPresent
            DbMaxRows = $DbMaxRows
            DbPlanOutputPath = $DbPlanOutputPath
            SkipAutoDbFixPlan = $SkipAutoDbFixPlan.IsPresent
            EnablePlaywrightSmokeCheck = $EnablePlaywrightSmokeCheck.IsPresent
            PlaywrightWorkingDirectory = $resolvedPlaywrightWorkingDirectory
            PlaywrightConfigPath = $PlaywrightConfigPath
            PlaywrightBrowserMatrix = $PlaywrightBrowserMatrix
            WarnOnly = $WarnOnly.IsPresent
            StateFile = $StateFile
        }
        if ($ScanPath -and $ScanPath.Count -gt 0) {
            $args["ScanPath"] = $ScanPath
        }
        if ($ChangedPath -and $ChangedPath.Count -gt 0) {
            $args["ChangedPath"] = $ChangedPath
        }
        & (Join-Path $scriptDir "self_check.ps1") @args
        exit $LASTEXITCODE
    }
    "playwright-author" {
        $args = @{
            WorkingDirectory = $resolvedPlaywrightWorkingDirectory
        }
        & (Join-Path $scriptDir "playwright_author_suite.ps1") @args
        exit $LASTEXITCODE
    }
    "playwright-smoke-check" {
        $args = @{
            WorkingDirectory = $resolvedPlaywrightWorkingDirectory
            ConfigPath = $PlaywrightConfigPath
            BrowserMatrix = $PlaywrightBrowserMatrix
        }
        if ($InstallPlaywrightBrowsers.IsPresent) {
            $args["InstallBrowsers"] = $true
        }
        & (Join-Path $scriptDir "playwright_smoke_check.ps1") @args
        exit $LASTEXITCODE
    }
    "playwright-full-check" {
        $args = @{
            WorkingDirectory = $resolvedPlaywrightWorkingDirectory
            ConfigPath = $PlaywrightConfigPath
            BrowserMatrix = $PlaywrightBrowserMatrix
        }
        if ($InstallPlaywrightBrowsers.IsPresent) {
            $args["InstallBrowsers"] = $true
        }
        & (Join-Path $scriptDir "playwright_full_check.ps1") @args
        exit $LASTEXITCODE
    }
    "ui-smoke-check" {
        $args = @{
            WorkingDirectory = $resolvedPlaywrightWorkingDirectory
            ConfigPath = $PlaywrightConfigPath
            BrowserMatrix = $PlaywrightBrowserMatrix
        }
        if ($InstallPlaywrightBrowsers.IsPresent) {
            $args["InstallBrowsers"] = $true
        }
        & (Join-Path $scriptDir "playwright_smoke_check.ps1") @args
        exit $LASTEXITCODE
    }
    "enforce-trigger" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            Phase = $Phase
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            ManifestPath = $ManifestPath
            ProjectFramework = $ProjectFramework
            NodeVersion = $NodeVersion
            MaxFiles = $MaxFiles
            IncludeDevDependencies = $IncludeDevDependencies.IsPresent
            SkipRegistryFetch = $SkipRegistryFetch.IsPresent
            SkipFunctionChecks = $SkipFunctionChecks.IsPresent
            EnableDbIndexMaintenanceCheck = $EnableDbIndexMaintenanceCheck.IsPresent
            DatabaseUrl = $DatabaseUrl
            WarnOnly = $WarnOnly.IsPresent
            StateFile = $StateFile
        }
        if ($ScanPath -and $ScanPath.Count -gt 0) {
            $args["ScanPath"] = $ScanPath
        }
        if ($ChangedPath -and $ChangedPath.Count -gt 0) {
            $args["ChangedPath"] = $ChangedPath
        }
        & (Join-Path $scriptDir "enforcement_trigger.ps1") @args
        exit $LASTEXITCODE
    }
    "prod" {
        $resolvedApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
        $args = @{
            ApiBase = $resolvedApiBase
            AccessToken = $AccessToken
            ManifestPath = $ManifestPath
            ProjectFramework = $ProjectFramework
            NodeVersion = $NodeVersion
            MaxFiles = $MaxFiles
            ProdProfile = $effectiveProdProfile
            SkipFunctionChecks = $SkipFunctionChecks.IsPresent
            IncludeDevDependencies = $IncludeDevDependencies.IsPresent
            EnableApiContractCheck = $EnableApiContractCheck.IsPresent
            EnableDbIndexMaintenanceCheck = $EnableDbIndexMaintenanceCheck.IsPresent
            EnablePlaywrightSmokeCheck = $EnablePlaywrightSmokeCheck.IsPresent
            PlaywrightWorkingDirectory = $resolvedPlaywrightWorkingDirectory
            PlaywrightConfigPath = $PlaywrightConfigPath
            PlaywrightBrowserMatrix = $PlaywrightBrowserMatrix
            InstallPlaywrightBrowsers = $InstallPlaywrightBrowsers.IsPresent
            DatabaseUrl = $DatabaseUrl
            StateFile = $StateFile
        }
        if ($ScanPath -and $ScanPath.Count -gt 0) {
            $args["ScanPath"] = $ScanPath
        }
        & (Join-Path $scriptDir "pg_prod.ps1") @args
        exit $LASTEXITCODE
    }
    "dev-profile" {
        $args = @{
            Action = $DevProfileAction
            ProfilePath = $ProfilePath
            Key = $ProfileKey
            Value = $ProfileValue
            Secret = $Secret.IsPresent
            Prompt = $Prompt.IsPresent
            Reveal = $Reveal.IsPresent
            Json = $Json.IsPresent
            Force = $Force.IsPresent
        }
        $result = & (Join-Path $scriptDir "dev_profile.ps1") @args
        if ($DevProfileAction -eq "check" -and $result -and ($result.ok -eq $false)) {
            exit 2
        }
        exit $LASTEXITCODE
    }
    { $_ -in "prod-checklist", "production-checklist" } {
        $args = @{}
        if ($Json.IsPresent) { $args["Json"] = $true }
        if ($ApiBase) { $args["ApiBase"] = $ApiBase }
        if ($AccessToken) { $args["AccessToken"] = $AccessToken }
        & (Join-Path $scriptDir "production_checklist.ps1") @args
        exit $LASTEXITCODE
    }
    "tech-debt" {
        $args = @{}
        if ($Json.IsPresent) { $args["Json"] = $true }
        if ($ApiBase) { $args["ApiBase"] = $ApiBase }
        if ($AccessToken) { $args["AccessToken"] = $AccessToken }
        & (Join-Path $scriptDir "tech_debt_check.ps1") @args
        exit $LASTEXITCODE
    }
    "tech-debt-model" {
        $args = @{ ModelOnly = $true }
        if ($Json.IsPresent) { $args["Json"] = $true }
        if ($ApiBase) { $args["ApiBase"] = $ApiBase }
        if ($AccessToken) { $args["AccessToken"] = $AccessToken }
        & (Join-Path $scriptDir "tech_debt_check.ps1") @args
        exit $LASTEXITCODE
    }
    { $_ -in "init", "project-setup" } {
        $args = @{}
        if ($Json.IsPresent) { $args["Json"] = $true }
        if ($Force.IsPresent) { $args["Force"] = $true }
        if ($TargetPath) { $args["ProjectRoot"] = $TargetPath }
        & (Join-Path $scriptDir "project_setup.ps1") @args
        exit $LASTEXITCODE
    }
    "upgrade-scaffold" {
        $args = @{
            DryRun = $DryRun.IsPresent
            Yes = $Yes.IsPresent
            Json = $Json.IsPresent
            SkipPostUpgradeHookInstall = $SkipPostUpgradeHookInstall.IsPresent
            SkipPostUpgradeStart = $SkipPostUpgradeStart.IsPresent
            RunSelfCheck = $RunSelfCheck.IsPresent
        }
        if ($TargetPath) { $args["TargetPath"] = $TargetPath }
        if ($BackupRoot) { $args["BackupRoot"] = $BackupRoot }
        & (Join-Path $scriptDir "scaffold_upgrade.ps1") @args
        exit $LASTEXITCODE
    }
    { $_ -in "integration-init", "integration-worker", "backend-start", "frontend-start", "backend-stop", "frontend-stop", "integration-stop", "integration-end", "integration-status", "integration-next", "integration-ready", "integration-complete", "integration-watch", "integration-export", "integration-report", "integration-respond", "integration-summary", "integration-open-page" } {
        $actionMap = @{
            "integration-init" = "init"
            "integration-worker" = "start-role"
            "backend-start" = "start-role"
            "frontend-start" = "start-role"
            "backend-stop" = "stop-role"
            "frontend-stop" = "stop-role"
            "integration-stop" = "stop-role"
            "integration-end" = "stop-role"
            "integration-status" = "status"
            "integration-next" = "next"
            "integration-ready" = "ready"
            "integration-complete" = "complete"
            "integration-watch" = "watch"
            "integration-export" = "export"
            "integration-report" = "report"
            "integration-respond" = "respond"
            "integration-summary" = "summary"
            "integration-open-page" = "open-page"
        }
        $args = @{
            Action = $actionMap[$Command]
            Role = $(if ($Command -eq "backend-start" -or $Command -eq "backend-stop") { "backend" } elseif ($Command -eq "frontend-start" -or $Command -eq "frontend-stop") { "frontend" } else { $Role })
            StepId = $StepId
            PageId = $PageId
            Kind = $Kind
            Resolution = $(if ($Command -eq "integration-end") { "completed" } elseif ($Resolution) { $Resolution } else { "" })
            AgentId = $AgentId
            AgentFamily = $AgentFamily
            ModelName = $ModelName
            SessionMode = $(if ($Command -eq "integration-worker" -and -not $PSBoundParameters.ContainsKey("SessionMode")) { "worker" } else { $SessionMode })
            PollSeconds = $(if ($PSBoundParameters.ContainsKey("PollSeconds")) { $PollSeconds } else { 30 })
            Title = $Title
            Details = $Details
            ApiBase = $(if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" })
            AccessToken = $AccessToken
            StateFile = $StateFile
        }
        if ($Persistent.IsPresent -or $Command -eq "integration-worker") { $args["Persistent"] = $true }
        if ($ChangedPath -and $ChangedPath.Count -gt 0) {
            $args["ChangedPath"] = $ChangedPath
        }
        if ($Once.IsPresent) { $args["Once"] = $true }
        if ($Json.IsPresent) { $args["Json"] = $true }
        & (Join-Path $scriptDir "frontend_integration.ps1") @args
        exit $LASTEXITCODE
    }
    { $_ -in "review-init", "review-builder-start", "review-reviewer-start", "review-stop", "review-end", "review-status", "review-summary", "review-report", "review-respond", "review-approve", "review-open-page" } {
        $actionMap = @{
            "review-init" = "init"
            "review-builder-start" = "start-role"
            "review-reviewer-start" = "start-role"
            "review-stop" = "stop-role"
            "review-end" = "end"
            "review-status" = "status"
            "review-summary" = "summary"
            "review-report" = "report"
            "review-respond" = "respond"
            "review-approve" = "approve"
            "review-open-page" = "open-page"
        }
        $args = @{
            Action = $actionMap[$Command]
            Role = $(if ($Command -eq "review-builder-start") { "builder" } elseif ($Command -eq "review-reviewer-start") { "reviewer" } else { $Role })
            PageId = $PageId
            Title = $Title
            Details = $Details
            Kind = $Kind
            Resolution = $Resolution
            AgentId = $AgentId
            AgentFamily = $AgentFamily
            ModelName = $ModelName
            SessionMode = $(if (($Command -eq "review-builder-start" -or $Command -eq "review-reviewer-start") -and -not $PSBoundParameters.ContainsKey("SessionMode")) { "worker" } else { $SessionMode })
            PollSeconds = $(if ($PSBoundParameters.ContainsKey("PollSeconds")) { $PollSeconds } else { 30 })
            ApiBase = $(if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" })
            AccessToken = $AccessToken
            StateFile = $StateFile
        }
        if ($Persistent.IsPresent) { $args["Persistent"] = $true }
        if ($ChangedPath -and $ChangedPath.Count -gt 0) { $args["ChangedPath"] = $ChangedPath }
        if ($Once.IsPresent) { $args["Once"] = $true }
        if ($Json.IsPresent) { $args["Json"] = $true }
        & (Join-Path $scriptDir "review_workflow.ps1") @args
        exit $LASTEXITCODE
    }
    default {
        Show-Help
        exit 0
    }
}
