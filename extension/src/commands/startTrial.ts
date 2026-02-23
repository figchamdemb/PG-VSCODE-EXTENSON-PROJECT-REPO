import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";

export function registerStartTrialCommand(
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.startTrial", async () => {
    try {
      await gates.startTrial();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: trial start failed. ${message}`);
    }
  });
}
