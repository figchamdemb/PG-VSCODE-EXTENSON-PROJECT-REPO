import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";

export function registerManageDevicesCommand(
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.manageDevices", async () => {
    try {
      await gates.manageDevices();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: manage devices failed. ${message}`);
    }
  });
}
