import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";

export function registerAuthSignInCommand(
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.authSignIn", async () => {
    try {
      await gates.signInWithEmail();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: sign-in failed. ${message}`);
    }
  });
}
