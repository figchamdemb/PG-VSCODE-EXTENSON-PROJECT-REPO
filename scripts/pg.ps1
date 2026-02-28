param(
    [Parameter(Position = 0)]
    [ValidateSet("install", "start", "end", "status", "login", "update", "doctor", "governance-login", "governance-worker", "governance-bind", "slack-check", "narrate-check", "closure-check", "dependency-verify", "coding-verify", "api-contract-verify", "mcp-cloud-score", "cloud-score", "observability-check", "obs-check", "db-index-check", "db-check", "db-index-fix-plan", "db-fix", "db-index-remediate", "self-check", "as-you-go-check", "playwright-smoke-check", "ui-smoke-check", "enforce-trigger", "prod", "dev-profile", "help")]
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
    [string]$EnforcementMode = "warn",
    [ValidateSet("start-session", "post-write", "pre-push")]
    [string]$Phase = "start-session",
    [switch]$WarnOnly,
    [string]$OtpCode = "",
    [string]$AccessToken = "",
    [string]$StateFile = "",
    [string]$PlaybookPath = "",
    [string]$PlaywrightWorkingDirectory = "",
    [string]$PlaywrightConfigPath = "",
    [string]$DatabaseUrl = "",
    [string]$DbPlanOutputPath = "",
    [ValidateRange(1, 1000)]
    [int]$DbMaxRows = 25,
    [switch]$SkipAutoDbFixPlan,
    [string]$ThreadId = "",
    [string]$ActionKey = "",
    [ValidateSet("init", "check", "set", "get", "list", "remove")]
    [string]$DevProfileAction = "check",
    [string]$ProfilePath = "",
    [string]$ProfileKey = "",
    [string]$ProfileValue = "",
    [ValidateRange(1, 500)]
    [int]$Limit = 100,
    [ValidateRange(1, 1000)]
    [int]$SyncLimit = 300,
    [ValidateRange(2, 3600)]
    [int]$PollSeconds = 15,
    [string]$ApproveCommand = "",
    [string]$NeedsChangeCommand = "",
    [string]$RejectCommand = "",
    [switch]$Persistent,
    [switch]$Force,
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

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

$ErrorActionPreference = "Stop"

function Show-Help {
    Write-Host "pg command usage:"
    Write-Host "  .\pg.ps1 install backend"
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
    Write-Host "  .\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck"
    Write-Host "  .\pg.ps1 self-check -EnableDbIndexMaintenanceCheck -EnablePlaywrightSmokeCheck"
    Write-Host "  .\pg.ps1 playwright-smoke-check"
    Write-Host "  .\pg.ps1 ui-smoke-check"
    Write-Host "  .\pg.ps1 enforce-trigger -Phase pre-push -ApiBase http://127.0.0.1:8787 -ProjectFramework nestjs"
    Write-Host "  .\pg.ps1 prod -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json"
    Write-Host "  .\pg.ps1 prod                # default dependency check scans all service manifests"
    Write-Host "  .\pg.ps1 prod -ProdProfile strict -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json"
    Write-Host "  .\pg.ps1 prod -ProdProfile legacy -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json"
    Write-Host "  .\pg.ps1 prod -ApiBase http://127.0.0.1:8787 -ManifestPath .\server\package.json -EnablePlaywrightSmokeCheck"
    Write-Host "  .\pg.ps1 dev-profile -DevProfileAction init"
    Write-Host "  .\pg.ps1 dev-profile -DevProfileAction set -ProfileKey db_host -ProfileValue 127.0.0.1"
    Write-Host "  .\pg.ps1 dev-profile -DevProfileAction set -ProfileKey db_password -Secret -Prompt"
    Write-Host "  .\pg.ps1 dev-profile -DevProfileAction check"
    Write-Host "  .\pg.ps1 login -ApiBase http://127.0.0.1:8787 -Email user@company.com"
    Write-Host "  .\pg.ps1 update -ApiBase http://127.0.0.1:8787"
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
    Write-Host "  # Add -EnablePlaywrightSmokeCheck for web/UI tasks (defaults to .\server when working directory is omitted)."
    Write-Host ""
    Write-Host "PG prod profile defaults:"
    Write-Host "  -ProdProfile legacy   => dependency + coding only"
    Write-Host "  -ProdProfile standard => dependency + coding + API contract + DB index maintenance (default)"
    Write-Host "  -ProdProfile strict   => standard + Playwright smoke"
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
    Write-Host "Note: install delegates to global CLI if available (~\.pg-cli\pg.ps1)."
}

$scriptDir = $PSScriptRoot
$repoRootForDefaults = (Resolve-Path (Join-Path $scriptDir "..")).Path

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

switch ($Command) {
    "install" {
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
            EnforcementMode = $EnforcementMode
            ApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
            AccessToken = $AccessToken
            StateFile = $StateFile
        }
        if ($Yes.IsPresent) {
            $args["Yes"] = $true
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
    "self-check" {
        $args = @{
            ApiBase = if ($ApiBase) { $ApiBase } else { "http://127.0.0.1:8787" }
            AccessToken = $AccessToken
            ProjectFramework = if ($ProjectFramework) { $ProjectFramework } else { "unknown" }
            MaxFiles = $MaxFiles
            IncludeDevDependencies = $IncludeDevDependencies.IsPresent
            SkipFunctionChecks = $SkipFunctionChecks.IsPresent
            EnableDbIndexMaintenanceCheck = $EnableDbIndexMaintenanceCheck.IsPresent
            DatabaseUrl = $DatabaseUrl
            DbMaxRows = $DbMaxRows
            DbPlanOutputPath = $DbPlanOutputPath
            SkipAutoDbFixPlan = $SkipAutoDbFixPlan.IsPresent
            EnablePlaywrightSmokeCheck = $EnablePlaywrightSmokeCheck.IsPresent
            PlaywrightWorkingDirectory = $resolvedPlaywrightWorkingDirectory
            PlaywrightConfigPath = $PlaywrightConfigPath
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
            SkipFunctionChecks = $SkipFunctionChecks.IsPresent
            EnableDbIndexMaintenanceCheck = $EnableDbIndexMaintenanceCheck.IsPresent
            DatabaseUrl = $DatabaseUrl
            DbMaxRows = $DbMaxRows
            DbPlanOutputPath = $DbPlanOutputPath
            SkipAutoDbFixPlan = $SkipAutoDbFixPlan.IsPresent
            EnablePlaywrightSmokeCheck = $EnablePlaywrightSmokeCheck.IsPresent
            PlaywrightWorkingDirectory = $resolvedPlaywrightWorkingDirectory
            PlaywrightConfigPath = $PlaywrightConfigPath
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
    "playwright-smoke-check" {
        $args = @{
            WorkingDirectory = $resolvedPlaywrightWorkingDirectory
            ConfigPath = $PlaywrightConfigPath
        }
        & (Join-Path $scriptDir "playwright_smoke_check.ps1") @args
        exit $LASTEXITCODE
    }
    "ui-smoke-check" {
        $args = @{
            WorkingDirectory = $resolvedPlaywrightWorkingDirectory
            ConfigPath = $PlaywrightConfigPath
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
    default {
        Show-Help
        exit 0
    }
}
