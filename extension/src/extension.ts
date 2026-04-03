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
import { registerCodebaseTourGraphCommand } from "./commands/codebaseTourGraph";
import { registerGovernanceSyncNowCommand } from "./commands/governanceSyncNow";
import { registerLicenseStatusCommand } from "./commands/licenseStatus";
import { registerManageDevicesCommand } from "./commands/manageDevices";
import { registerOpenCommandHelpCommand } from "./commands/openCommandHelp";
import { registerOpenModelSettingsCommand } from "./commands/openModelSettings";
import { registerOpenToggleControlPanelCommand } from "./commands/openToggleControlPanel";
import { registerPgPushCommands } from "./commands/pgPush";
import { registerRefreshLicenseCommand } from "./commands/refreshLicense";
import { registerRedeemCodeCommand } from "./commands/redeemCode";
import { registerRequestChangePromptCommand } from "./commands/requestChangePrompt";
import { registerRunCommandDiagnosticsCommand } from "./commands/runCommandDiagnostics";
import { registerRunFlowInteractionCheckCommand } from "./commands/runFlowInteractionCheck";
import { registerRunDeadCodeScanCommand } from "./commands/runDeadCodeScan";
import { registerRunEnvironmentDoctorCommand } from "./commands/runEnvironmentDoctor";
import { registerEnvDoctorCodeActionProvider, addKeyToEnvExample } from "./commands/envDoctorCodeActions";
import { registerRunApiContractValidatorCommand } from "./commands/runApiContractValidator";
import { registerRunDbIndexCheckCommand } from "./commands/runDbIndexCheck";
import { registerRunMcpCloudScoreCommand } from "./commands/runMcpCloudScore";
import { registerRunObservabilityCheckCommand } from "./commands/runObservabilityCheck";
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
import { ReadingSelectionSyncService } from "./readingView/readingSelectionSyncService";
import { ToggleControlViewProvider } from "./ui/toggleControlViewProvider";
import { TrustScoreService } from "./trust/trustScoreService";
import {
  openTrustFindingLocation,
  TrustScoreViewProvider
} from "./trust/trustScoreViewProvider";
import { Logger } from "./utils/logger";
import { StartupContextEnforcer } from "./startup/startupContextEnforcer";
import { StartupEnforcementBridge } from "./startup/startupEnforcementBridge";

let cacheProvider: JsonCacheProvider | undefined;

type ActivationServices = {
  logger: Logger;
  featureGates: FeatureGateService;
  narrationEngine: NarrationEngine;
  schemeProvider: NarrateSchemeProvider;
  trustScoreService: TrustScoreService;
  trustScoreViewProvider: TrustScoreViewProvider;
  postWriteEnforcer: PostWriteEnforcer;
  startupContextEnforcer: StartupContextEnforcer;
  startupEnforcementBridge: StartupEnforcementBridge;
  readingSelectionSyncService: ReadingSelectionSyncService;
  governanceDecisionSyncWorker: GovernanceDecisionSyncWorker;
  commandHelpViewProvider: CommandHelpViewProvider;
  toggleControlViewProvider: ToggleControlViewProvider;
};

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger("Narrate");
  const services = await createActivationServices(context, logger);
  const statusBars = createStatusBarItems(context);
  const refreshers = createStatusRefreshers(context, services.featureGates, statusBars);
  services.toggleControlViewProvider.setOnStateChanged(refreshers.refreshAllStatusBars);

  registerCoreRuntimeSubscriptions(context, services);
  registerStatusSubscriptions(context, services, refreshers);
  registerAllCommands(context, services, refreshers);

  await services.startupContextEnforcer.initialize();
  await services.startupEnforcementBridge.initialize();
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
  const readingSelectionSyncService = new ReadingSelectionSyncService(logger);
  const trustScoreService = new TrustScoreService(context, logger);
  const trustScoreViewProvider = new TrustScoreViewProvider(trustScoreService);
  const startupContextEnforcer = new StartupContextEnforcer(context, logger);
  const startupEnforcementBridge = new StartupEnforcementBridge(startupContextEnforcer, logger);
  const postWriteEnforcer = new PostWriteEnforcer(logger, startupContextEnforcer);
  const governanceDecisionSyncWorker = new GovernanceDecisionSyncWorker(logger);
  governanceDecisionSyncWorker.start();
  const commandHelpViewProvider = new CommandHelpViewProvider(logger);
  const toggleControlViewProvider = new ToggleControlViewProvider(
    context,
    schemeProvider,
    featureGates,
    logger
  );

  return {
    logger,
    featureGates,
    narrationEngine,
    schemeProvider,
    trustScoreService,
    trustScoreViewProvider,
    postWriteEnforcer,
    startupContextEnforcer,
    startupEnforcementBridge,
    readingSelectionSyncService,
    governanceDecisionSyncWorker,
    commandHelpViewProvider,
    toggleControlViewProvider
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
    services.startupContextEnforcer,
    services.startupEnforcementBridge,
    services.readingSelectionSyncService,
    services.governanceDecisionSyncWorker,
    vscode.window.registerWebviewViewProvider(
      CommandHelpViewProvider.viewType,
      services.commandHelpViewProvider
    ),
    vscode.window.registerWebviewViewProvider(
      ToggleControlViewProvider.viewType,
      services.toggleControlViewProvider
    ),
    vscode.window.registerTreeDataProvider(
      TrustScoreViewProvider.viewId,
      services.trustScoreViewProvider
    ),
    services.trustScoreViewProvider,
    services.featureGates.getLicensingCallbackHandler(),
    vscode.window.registerUriHandler(services.featureGates.getLicensingCallbackHandler()),
    services.schemeProvider,
    vscode.workspace.registerTextDocumentContentProvider("narrate", services.schemeProvider),
    vscode.workspace.onDidSaveTextDocument((document) => {
      void services.trustScoreService.onDidSaveTextDocument(document);
      void services.postWriteEnforcer.onDidSaveTextDocument(document);
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      void services.readingSelectionSyncService.onDidChangeSelection(event);
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      void services.startupContextEnforcer.onDidChangeActiveEditor(editor);
      void services.trustScoreService.onDidChangeActiveEditor();
      void services.readingSelectionSyncService.syncFromActiveEditor();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void services.startupContextEnforcer.onDidChangeWorkspaceFolders();
      void services.startupEnforcementBridge.onDidChangeWorkspaceFolders();
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
      services.toggleControlViewProvider.refresh();
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
    services.toggleControlViewProvider.refresh();
  }
  void services.trustScoreService.handleConfigurationChanged(event);
  void services.startupContextEnforcer.handleConfigurationChanged(event);
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
    registerRequestChangePromptCommand(
      context,
      services.narrationEngine,
      services.trustScoreService,
      services.startupContextEnforcer
    ),
    registerExportNarrationFileCommand(
      context,
      services.narrationEngine,
      services.featureGates,
      services.trustScoreService,
      services.startupContextEnforcer
    ),
    registerExportNarrationWorkspaceCommand(
      context,
      services.narrationEngine,
      services.featureGates,
      services.trustScoreService,
      services.startupContextEnforcer
    ),
    registerGenerateChangeReportCommand(
      context,
      services.narrationEngine,
      services.featureGates,
      services.trustScoreService,
      services.startupContextEnforcer
    ),
    registerGenerateCodebaseTourCommand(
      services.logger,
      services.startupContextEnforcer
    ),
    registerCodebaseTourGraphCommand(services.logger),
    registerPgPushCommands(
      services.trustScoreService,
      services.startupContextEnforcer
    ),
    registerGovernanceSyncNowCommand(services.governanceDecisionSyncWorker),
    registerOpenToggleControlPanelCommand(),
    registerRunFlowInteractionCheckCommand(
      context,
      services.narrationEngine,
      services.schemeProvider,
      services.logger
    )
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
    registerOpenCommandHelpCommand(),
    registerOpenModelSettingsCommand()
  ];
}

function registerMaintenanceCommands(services: ActivationServices): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("narrate.runStartupForCurrentContext", async () => {
      await services.startupContextEnforcer.runStartupForCurrentContext();
    }),
    vscode.commands.registerCommand("narrate.stopMandatoryEnforcement", async () => {
      await services.startupContextEnforcer.stopMandatoryEnforcementForCurrentWorkspace();
    }),
    vscode.commands.registerCommand("narrate.resumeMandatoryEnforcement", async () => {
      await services.startupContextEnforcer.resumeMandatoryEnforcementForCurrentWorkspace();
    }),
    registerCreateDeadCodeCleanupBranchCommand(services.logger),
    registerApplySafeDeadCodeFixesCommand(services.logger),
    registerRunCommandDiagnosticsCommand(services.logger),
    registerRunDeadCodeScanCommand(services.logger),
    registerRunEnvironmentDoctorCommand(services.logger),
    registerEnvDoctorCodeActionProvider(),
    vscode.commands.registerCommand("narrate.envDoctorAddKeyToExample", addKeyToEnvExample),
    registerRunApiContractValidatorCommand(services.featureGates, services.logger),
    registerRunTrustWorkspaceScanCommand(services.trustScoreService),
    registerSetupValidationLibraryCommand(),
    registerRunDbIndexCheckCommand(services.logger),
    registerRunMcpCloudScoreCommand(services.logger),
    registerRunObservabilityCheckCommand(services.logger)
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
