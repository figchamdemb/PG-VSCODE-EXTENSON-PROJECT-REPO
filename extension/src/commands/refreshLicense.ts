import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";

export function registerRefreshLicenseCommand(
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.refreshLicense", async () => {
    try {
      await gates.refreshLicense("manual");
      vscode.window.showInformationMessage("Narrate: license refreshed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: license refresh failed. ${message}`);
    }
  });
}
