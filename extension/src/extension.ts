import * as vscode from "vscode";
import {
  createStatusBarItems,
  createStatusRefreshers,
  StatusRefreshers
} from "./activation/statusBars";
import { JsonCacheProvider } from "./cache/jsonCacheProvider";
import { registerActivateProjectQuotaCommand } from "./commands/activateProjectQuota";
import { registerApplySafeDeadCodeFixesCommand } from "./commands/applySafeDeadCodeFixes";
import { registerAuthSignInCommand } from "./commands/authSignIn";
import { registerAuthSignInGitHubCommand } from "./commands/authSignInGitHub";
import { registerCreateDeadCodeCleanupBranchCommand } from "./commands/createDeadCodeCleanupBranch";
import { registerExportNarrationFileCommand } from "./commands/exportNarrationFile";
import { registerExportNarrationWorkspaceCommand } from "./commands/exportNarrationWorkspace";
import { registerGenerateChangeReportCommand } from "./commands/generateChangeReport";
import { registerGenerateCodebaseTourCommand } from "./commands/generateCodebaseTour";
import { registerGovernanceSyncNowCommand } from "./commands/governanceSyncNow";
import { registerLicenseStatusCommand } from "./commands/licenseStatus";
import { registerManageDevicesCommand } from "./commands/manageDevices";
import { registerOpenCommandHelpCommand } from "./commands/openCommandHelp";
import { registerPgPushCommands } from "./commands/pgPush";
import { registerRefreshLicenseCommand } from "./commands/refreshLicense";
import { registerRedeemCodeCommand } from "./commands/redeemCode";
import { registerRequestChangePromptCommand } from "./commands/requestChangePrompt";
import { registerRunCommandDiagnosticsCommand } from "./commands/runCommandDiagnostics";
import { registerRunDeadCodeScanCommand } from "./commands/runDeadCodeScan";
import { registerRunEnvironmentDoctorCommand } from "./commands/runEnvironmentDoctor";
import { registerRunApiContractValidatorCommand } from "./commands/runApiContractValidator";
import { registerRunTrustWorkspaceScanCommand } from "./commands/runTrustWorkspaceScan";
import { registerRefreshReadingViewCommand } from "./commands/refreshReadingView";
import { registerSetupValidationLibraryCommand } from "./commands/setupValidationLibrary";
import { registerShowProjectQuotaCommand } from "./commands/showProjectQuota";
import { registerSetNarrationModeCommand } from "./commands/setNarrationMode";
import { registerStartTrialCommand } from "./commands/startTrial";
import { registerSwitchReadingPaneModeCommand } from "./commands/switchReadingPaneMode";
import { registerSwitchReadingSnippetModeCommand } from "./commands/switchReadingSnippetMode";
import { registerSwitchReadingViewModeCommand } from "./commands/switchReadingViewMode";
import { registerSwitchEduDetailLevelCommand } from "./commands/switchEduDetailLevel";
import { registerUpgradePlanCommand } from "./commands/upgradePlan";
import { GovernanceDecisionSyncWorker } from "./governance/decisionSyncWorker";
import { registerSwitchNarrationModeCommand } from "./commands/switchNarrationMode";
import { registerToggleReadingModeCommand } from "./commands/toggleReadingMode";
import { PostWriteEnforcer } from "./governance/postWriteEnforcer";
import { FeatureGateService } from "./licensing/featureGates";
import { OpenAICompatibleProvider } from "./llm/openAICompatibleProvider";
import { NarrationEngine } from "./narration/narrationEngine";
import { CommandHelpViewProvider } from "./help/commandHelpViewProvider";
import { NarrateSchemeProvider } from "./readingView/narrateSchemeProvider";
import { TrustScoreService } from "./trust/trustScoreService";
import {
  openTrustFindingLocation,
  TrustScoreViewProvider
} from "./trust/trustScoreViewProvider";
import { Logger } from "./utils/logger";

let cacheProvider: JsonCacheProvider | undefined;

type ActivationServices = {
  logger: Logger;
  featureGates: FeatureGateService;
  narrationEngine: NarrationEngine;
  schemeProvider: NarrateSchemeProvider;
  trustScoreService: TrustScoreService;
  trustScoreViewProvider: TrustScoreViewProvider;
  postWriteEnforcer: PostWriteEnforcer;
  governanceDecisionSyncWorker: GovernanceDecisionSyncWorker;
  commandHelpViewProvider: CommandHelpViewProvider;
};

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger("Narrate");
  const services = await createActivationServices(context, logger);
  const statusBars = createStatusBarItems(context);
  const refreshers = createStatusRefreshers(context, services.featureGates, statusBars);

  registerCoreRuntimeSubscriptions(context, services);
  registerStatusSubscriptions(context, services, refreshers);
  registerAllCommands(context, services, refreshers);

  refreshers.refreshAllStatusBars();
  void services.trustScoreService.refreshNow();
  logger.info("Narrate extension activated.");
}

async function createActivationServices(
  context: vscode.ExtensionContext,
  logger: Logger
): Promise<ActivationServices> {
  cacheProvider = new JsonCacheProvider(context, logger);
  await cacheProvider.initialize();

  const featureGates = new FeatureGateService(logger, context);
  await featureGates.initialize();

  const llmProvider = new OpenAICompatibleProvider(logger, featureGates);
  const narrationEngine = new NarrationEngine(cacheProvider, llmProvider, logger);
  const schemeProvider = new NarrateSchemeProvider(narrationEngine, logger);
  const trustScoreService = new TrustScoreService(context, logger);
  const trustScoreViewProvider = new TrustScoreViewProvider(trustScoreService);
  const postWriteEnforcer = new PostWriteEnforcer(logger);
  const governanceDecisionSyncWorker = new GovernanceDecisionSyncWorker(logger);
  governanceDecisionSyncWorker.start();
  const commandHelpViewProvider = new CommandHelpViewProvider(logger);

  return {
    logger,
    featureGates,
    narrationEngine,
    schemeProvider,
    trustScoreService,
    trustScoreViewProvider,
    postWriteEnforcer,
    governanceDecisionSyncWorker,
    commandHelpViewProvider
  };
}

function registerCoreRuntimeSubscriptions(
  context: vscode.ExtensionContext,
  services: ActivationServices
): void {
  context.subscriptions.push(
    services.logger,
    services.trustScoreService,
    services.postWriteEnforcer,
    services.governanceDecisionSyncWorker,
    vscode.window.registerWebviewViewProvider(
      CommandHelpViewProvider.viewType,
      services.commandHelpViewProvider
    ),
    vscode.window.registerTreeDataProvider(
      TrustScoreViewProvider.viewId,
      services.trustScoreViewProvider
    ),
    services.trustScoreViewProvider,
    services.schemeProvider,
    vscode.workspace.registerTextDocumentContentProvider("narrate", services.schemeProvider),
    vscode.workspace.onDidSaveTextDocument((document) => {
      void services.trustScoreService.onDidSaveTextDocument(document);
      void services.postWriteEnforcer.onDidSaveTextDocument(document);
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      void services.trustScoreService.onDidChangeActiveEditor();
    })
  );
}

function registerStatusSubscriptions(
  context: vscode.ExtensionContext,
  services: ActivationServices,
  refreshers: StatusRefreshers
): void {
  context.subscriptions.push(
    services.featureGates.onDidChangeStatus(() => {
      refreshers.refreshAllStatusBars();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      handleConfigurationChanged(event, services, refreshers);
    })
  );
}

function handleConfigurationChanged(
  event: vscode.ConfigurationChangeEvent,
  services: ActivationServices,
  refreshers: StatusRefreshers
): void {
  if (affectsStatusBarConfiguration(event)) {
    void services.featureGates.handleConfigurationChanged();
    refreshers.refreshAllStatusBars();
  }
  void services.trustScoreService.handleConfigurationChanged(event);
  services.governanceDecisionSyncWorker.handleConfigurationChanged(event);
}

function affectsStatusBarConfiguration(event: vscode.ConfigurationChangeEvent): boolean {
  return (
    event.affectsConfiguration("narrate.defaultMode") ||
    event.affectsConfiguration("narrate.reading.defaultViewMode") ||
    event.affectsConfiguration("narrate.reading.defaultPaneMode") ||
    event.affectsConfiguration("narrate.reading.defaultSnippetMode") ||
    event.affectsConfiguration("narrate.reading.defaultEduDetailLevel") ||
    event.affectsConfiguration("narrate.reading.showStatusBarControls") ||
    event.affectsConfiguration("narrate.licensing.placeholderPlan") ||
    event.affectsConfiguration("narrate.licensing.mode") ||
    event.affectsConfiguration("narrate.licensing.apiBaseUrl") ||
    event.affectsConfiguration("narrate.licensing.publicKeyPem")
  );
}

function registerAllCommands(
  context: vscode.ExtensionContext,
  services: ActivationServices,
  refreshers: StatusRefreshers
): void {
  context.subscriptions.push(
    ...registerModeCommands(context, services, refreshers),
    ...registerReadingCommands(context, services, refreshers),
    ...registerWorkflowCommands(context, services),
    ...registerLicensingCommands(services.featureGates),
    ...registerMaintenanceCommands(services),
    ...registerTrustCommands(services.trustScoreService)
  );
}

function registerModeCommands(
  context: vscode.ExtensionContext,
  services: ActivationServices,
  refreshers: StatusRefreshers
): vscode.Disposable[] {
  return [
    registerToggleReadingModeCommand(
      context,
      services.schemeProvider,
      services.featureGates,
      "dev",
      "narrate.toggleReadingModeDev",
      refreshers.refreshStatusBar
    ),
    registerToggleReadingModeCommand(
      context,
      services.schemeProvider,
      services.featureGates,
      "edu",
      "narrate.toggleReadingModeEdu",
      refreshers.refreshStatusBar
    ),
    registerSetNarrationModeCommand(
      context,
      services.schemeProvider,
      services.featureGates,
      "dev",
      "narrate.setModeDev",
      refreshers.refreshStatusBar
    ),
    registerSetNarrationModeCommand(
      context,
      services.schemeProvider,
      services.featureGates,
      "edu",
      "narrate.setModeEdu",
      refreshers.refreshStatusBar
    ),
    registerSwitchNarrationModeCommand(
      context,
      services.featureGates,
      services.schemeProvider,
      refreshers.refreshStatusBar
    )
  ];
}

function registerReadingCommands(
  context: vscode.ExtensionContext,
  services: ActivationServices,
  refreshers: StatusRefreshers
): vscode.Disposable[] {
  return [
    registerSwitchReadingViewModeCommand(
      context,
      services.schemeProvider,
      refreshers.refreshReadingControls
    ),
    registerSwitchReadingSnippetModeCommand(
      context,
      services.schemeProvider,
      refreshers.refreshReadingControls
    ),
    registerSwitchEduDetailLevelCommand(
      context,
      services.schemeProvider,
      refreshers.refreshReadingControls
    ),
    registerSwitchReadingPaneModeCommand(
      context,
      services.schemeProvider,
      refreshers.refreshReadingControls
    ),
    registerRefreshReadingViewCommand(context, services.schemeProvider)
  ];
}

function registerWorkflowCommands(
  context: vscode.ExtensionContext,
  services: ActivationServices
): vscode.Disposable[] {
  return [
    registerRequestChangePromptCommand(context, services.narrationEngine),
    registerExportNarrationFileCommand(
      context,
      services.narrationEngine,
      services.featureGates
    ),
    registerExportNarrationWorkspaceCommand(
      context,
      services.narrationEngine,
      services.featureGates
    ),
    registerGenerateChangeReportCommand(
      context,
      services.narrationEngine,
      services.featureGates
    ),
    registerGenerateCodebaseTourCommand(services.logger),
    registerPgPushCommands(services.trustScoreService),
    registerGovernanceSyncNowCommand(services.governanceDecisionSyncWorker)
  ];
}

function registerLicensingCommands(featureGates: FeatureGateService): vscode.Disposable[] {
  return [
    registerAuthSignInCommand(featureGates),
    registerAuthSignInGitHubCommand(featureGates),
    registerRedeemCodeCommand(featureGates),
    registerStartTrialCommand(featureGates),
    registerRefreshLicenseCommand(featureGates),
    registerLicenseStatusCommand(featureGates),
    registerUpgradePlanCommand(featureGates),
    registerActivateProjectQuotaCommand(featureGates),
    registerShowProjectQuotaCommand(featureGates),
    registerManageDevicesCommand(featureGates),
    registerOpenCommandHelpCommand()
  ];
}

function registerMaintenanceCommands(services: ActivationServices): vscode.Disposable[] {
  return [
    registerCreateDeadCodeCleanupBranchCommand(services.logger),
    registerApplySafeDeadCodeFixesCommand(services.logger),
    registerRunCommandDiagnosticsCommand(services.logger),
    registerRunDeadCodeScanCommand(services.logger),
    registerRunEnvironmentDoctorCommand(services.logger),
    registerRunApiContractValidatorCommand(services.featureGates, services.logger),
    registerRunTrustWorkspaceScanCommand(services.trustScoreService),
    registerSetupValidationLibraryCommand()
  ];
}

function registerTrustCommands(trustScoreService: TrustScoreService): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("narrate.showTrustScoreReport", async () => {
      await trustScoreService.showLatestReport();
    }),
    vscode.commands.registerCommand("narrate.refreshTrustScore", async () => {
      await trustScoreService.refreshNow();
    }),
    createRestartTypeScriptAndRefreshTrustCommand(trustScoreService),
    createToggleTrustScoreCommand(trustScoreService),
    vscode.commands.registerCommand("narrate.openTrustFindingLocation", async (finding) => {
      await openTrustFindingLocation(finding);
    }),
    vscode.commands.registerCommand("narrate.openTrustScorePanel", async () => {
      await vscode.commands.executeCommand(`${TrustScoreViewProvider.viewId}.focus`);
    })
  ];
}

function createRestartTypeScriptAndRefreshTrustCommand(
  trustScoreService: TrustScoreService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.restartTypeScriptAndRefreshTrust", async () => {
    await vscode.workspace.saveAll(false);
    try {
      await vscode.commands.executeCommand("typescript.restartTsServer");
    } catch {
      void vscode.window.showWarningMessage(
        "Narrate: could not run TypeScript restart command automatically."
      );
    }
    await trustScoreService.refreshNow();
    void vscode.window.showInformationMessage(
      "Narrate: TypeScript server restarted and Trust Score refreshed."
    );
  });
}

function createToggleTrustScoreCommand(trustScoreService: TrustScoreService): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.toggleTrustScore", async () => {
    const enabled = await trustScoreService.toggleEnabled();
    void vscode.window.showInformationMessage(
      `Narrate Trust Score: ${enabled ? "enabled" : "disabled"}.`
    );
  });
}

export async function deactivate(): Promise<void> {
  if (cacheProvider) {
    await cacheProvider.flush();
  }
}
