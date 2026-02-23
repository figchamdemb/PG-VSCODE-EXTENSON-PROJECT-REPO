import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";

export function registerActivateProjectQuotaCommand(
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.activateProjectQuota", async () => {
    try {
      await gates.activateCurrentWorkspaceProject();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: project activation failed. ${message}`);
    }
  });
}
