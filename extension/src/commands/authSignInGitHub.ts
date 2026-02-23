import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";

export function registerAuthSignInGitHubCommand(
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.authSignInGitHub", async () => {
    try {
      await gates.signInWithGitHub();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: GitHub sign-in failed. ${message}`);
    }
  });
}
