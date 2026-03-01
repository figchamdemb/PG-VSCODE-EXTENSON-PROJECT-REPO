import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";
import { Logger } from "../utils/logger";
import { runApiContractValidation } from "./apiContractAnalyzer";
import { buildApiContractHandoffPrompt } from "./apiContractHandoffPrompt";
import { buildApiContractReportMarkdown } from "./apiContractReport";
import {
  ApiContractSettings,
  ApiContractValidationResult,
  DEFAULT_API_CONTRACT_EXCLUDE_GLOB,
  DEFAULT_API_CONTRACT_INCLUDE_GLOB,
  DEFAULT_API_CONTRACT_MAX_FILES
} from "./apiContractTypes";

export function registerRunApiContractValidatorCommand(
  gates: FeatureGateService, logger: Logger
): vscode.Disposable {
  return vscode.Disposable.from(
    registerRunValidatorCommand(gates, logger),
    registerApiCheckAlias(),
    registerApiHandoffCommand(gates, logger)
  );
}

function registerRunValidatorCommand(gates: FeatureGateService, logger: Logger): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.runApiContractValidator", async () => {
    const execution = await runValidatorExecution(gates, logger);
    if (!execution) return;
    await openApiReportDocument(execution.workspace, execution.result);
    showApiSummary(execution.result);
  });
}

function registerApiCheckAlias(): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.openApiCheck", () =>
    vscode.commands.executeCommand("narrate.runApiContractValidator")
  );
}

function registerApiHandoffCommand(gates: FeatureGateService, logger: Logger): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.openApiFixHandoff", async () => {
    const execution = await runValidatorExecution(gates, logger);
    if (!execution) return;
    const prompt = buildApiContractHandoffPrompt(execution.workspace.uri.fsPath, execution.result);
    await vscode.env.clipboard.writeText(prompt);
    const doc = await vscode.workspace.openTextDocument({ language: "markdown", content: prompt });
    await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
    void vscode.window.showInformationMessage("Narrate: OpenAPI fix handoff prompt copied to clipboard.");
  });
}

async function runValidatorExecution(
  gates: FeatureGateService, logger: Logger
): Promise<{ workspace: vscode.WorkspaceFolder; result: ApiContractValidationResult } | undefined> {
  if (!(await gates.requireProFeature("API Contract Validator"))) return undefined;
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    void vscode.window.showWarningMessage("Narrate: open a workspace folder before running API Contract Validator.");
    return undefined;
  }
  const settings = getApiContractSettings();
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Narrate: Running API Contract Validator", cancellable: false },
    (progress) => runApiContractValidation(workspace, settings, progress)
  );
  logger.info(`API Contract Validator: mismatches=${result.mismatches.length}, unmatched_calls=${result.unmatchedFrontendCalls.length}, source=${result.sourceMode}`);
  return { workspace, result };
}

async function openApiReportDocument(
  workspace: vscode.WorkspaceFolder,
  result: ApiContractValidationResult
): Promise<void> {
  const report = buildApiContractReportMarkdown(workspace.uri.fsPath, result);
  const doc = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: report
  });
  await vscode.window.showTextDocument(doc, { preview: false });
}

function showApiSummary(result: ApiContractValidationResult): void {
  if (result.mismatches.length > 0) {
    void vscode.window.showWarningMessage(
      `Narrate API Contract Validator: ${result.mismatches.length} mismatch(es) found.`
    );
    return;
  }
  void vscode.window.showInformationMessage(
    "Narrate API Contract Validator: no mismatches found."
  );
}

function getApiContractSettings(): ApiContractSettings {
  const config = vscode.workspace.getConfiguration("narrate");
  return {
    includeGlob: config.get<string>(
      "apiContract.includeGlob",
      DEFAULT_API_CONTRACT_INCLUDE_GLOB
    ),
    excludeGlob: config.get<string>(
      "apiContract.excludeGlob",
      DEFAULT_API_CONTRACT_EXCLUDE_GLOB
    ),
    maxFiles: Math.max(
      1,
      config.get<number>("apiContract.maxFiles", DEFAULT_API_CONTRACT_MAX_FILES)
    )
  };
}
