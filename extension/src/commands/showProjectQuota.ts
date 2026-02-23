import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";

export function registerShowProjectQuotaCommand(
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.showProjectQuota", async () => {
    try {
      await gates.showProjectQuota();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: quota status failed. ${message}`);
    }
  });
}
