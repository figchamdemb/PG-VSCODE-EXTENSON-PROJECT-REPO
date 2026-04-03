import * as vscode from "vscode";

export function registerOpenModelSettingsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.openModelSettings", async () => {
    try {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "narrate.model"
      );
    } catch {
      void vscode.window.showInformationMessage(
        "Narrate: open Settings and search for 'narrate.model'."
      );
    }
  });
}
