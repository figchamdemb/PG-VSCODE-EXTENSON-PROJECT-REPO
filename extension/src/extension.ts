import * as vscode from "vscode";
import { JsonCacheProvider } from "./cache/jsonCacheProvider";
import { registerActivateProjectQuotaCommand } from "./commands/activateProjectQuota";
import { registerAuthSignInCommand } from "./commands/authSignIn";
import { registerAuthSignInGitHubCommand } from "./commands/authSignInGitHub";
import { registerExportNarrationFileCommand } from "./commands/exportNarrationFile";
import { registerExportNarrationWorkspaceCommand } from "./commands/exportNarrationWorkspace";
import { registerGenerateChangeReportCommand } from "./commands/generateChangeReport";
import { registerLicenseStatusCommand } from "./commands/licenseStatus";
import { registerManageDevicesCommand } from "./commands/manageDevices";
import { registerPgPushCommands } from "./commands/pgPush";
import { registerRefreshLicenseCommand } from "./commands/refreshLicense";
import { registerRedeemCodeCommand } from "./commands/redeemCode";
import { registerRequestChangePromptCommand } from "./commands/requestChangePrompt";
import { registerShowProjectQuotaCommand } from "./commands/showProjectQuota";
import { registerStartTrialCommand } from "./commands/startTrial";
import { registerUpgradePlanCommand } from "./commands/upgradePlan";
import { getCurrentMode } from "./commands/modeState";
import { registerSwitchNarrationModeCommand } from "./commands/switchNarrationMode";
import { registerToggleReadingModeCommand } from "./commands/toggleReadingMode";
import { FeatureGateService } from "./licensing/featureGates";
import { OpenAICompatibleProvider } from "./llm/openAICompatibleProvider";
import { NarrationEngine } from "./narration/narrationEngine";
import { NarrateSchemeProvider } from "./readingView/narrateSchemeProvider";
import { NarrationMode } from "./types";
import { Logger } from "./utils/logger";

let cacheProvider: JsonCacheProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger("Narrate");
  cacheProvider = new JsonCacheProvider(context, logger);
  await cacheProvider.initialize();

  const featureGates = new FeatureGateService(logger, context);
  await featureGates.initialize();
  const llmProvider = new OpenAICompatibleProvider(logger, featureGates);
  const narrationEngine = new NarrationEngine(cacheProvider, llmProvider, logger);
  const schemeProvider = new NarrateSchemeProvider(narrationEngine, logger);

  context.subscriptions.push(
    logger,
    schemeProvider,
    vscode.workspace.registerTextDocumentContentProvider("narrate", schemeProvider)
  );

  const modeStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const planStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(modeStatus, planStatus);

  const refreshStatusBar = (mode: NarrationMode): void => {
    modeStatus.text = `Narrate: Reading (${mode.toUpperCase()})`;
    modeStatus.tooltip = "Switch Narrate mode";
    modeStatus.command = "narrate.switchNarrationMode";
    modeStatus.show();

    const planLabel = featureGates.getPlanLabel();
    planStatus.text = `Plan: ${planLabel}`;
    planStatus.tooltip =
      "Narrate licensing status. Use Narrate: License Status for details.";
    planStatus.show();
  };

  refreshStatusBar(getCurrentMode(context));

  context.subscriptions.push(
    registerToggleReadingModeCommand(
      context,
      schemeProvider,
      featureGates,
      "dev",
      "narrate.toggleReadingModeDev",
      refreshStatusBar
    ),
    registerToggleReadingModeCommand(
      context,
      schemeProvider,
      featureGates,
      "edu",
      "narrate.toggleReadingModeEdu",
      refreshStatusBar
    ),
    registerSwitchNarrationModeCommand(context, featureGates, refreshStatusBar),
    registerRequestChangePromptCommand(context, narrationEngine),
    registerExportNarrationFileCommand(context, narrationEngine, featureGates),
    registerExportNarrationWorkspaceCommand(context, narrationEngine, featureGates),
    registerGenerateChangeReportCommand(context, narrationEngine, featureGates),
    registerPgPushCommands(),
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
    featureGates.onDidChangeStatus(() => {
      refreshStatusBar(getCurrentMode(context));
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("narrate.defaultMode") ||
        event.affectsConfiguration("narrate.licensing.placeholderPlan") ||
        event.affectsConfiguration("narrate.licensing.mode") ||
        event.affectsConfiguration("narrate.licensing.apiBaseUrl") ||
        event.affectsConfiguration("narrate.licensing.publicKeyPem")
      ) {
        void featureGates.handleConfigurationChanged();
        refreshStatusBar(getCurrentMode(context));
      }
    })
  );

  logger.info("Narrate extension activated.");
}

export async function deactivate(): Promise<void> {
  if (cacheProvider) {
    await cacheProvider.flush();
  }
}
