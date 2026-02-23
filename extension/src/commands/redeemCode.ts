import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";

export function registerRedeemCodeCommand(
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.redeemCode", async () => {
    try {
      await gates.redeemCode();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: redeem failed. ${message}`);
    }
  });
}
