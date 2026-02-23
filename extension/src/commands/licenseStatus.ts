import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";

export function registerLicenseStatusCommand(
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.licenseStatus", async () => {
    try {
      await gates.showLicenseStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: license status failed. ${message}`);
    }
  });
}
