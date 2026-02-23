import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";

export function registerUpgradePlanCommand(
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.upgradePlan", async () => {
    try {
      await gates.openUpgradeCheckout();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: checkout failed. ${message}`);
    }
  });
}
