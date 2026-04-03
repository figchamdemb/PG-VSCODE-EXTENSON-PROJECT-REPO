import * as vscode from "vscode";

export function registerOpenToggleControlPanelCommand(): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.openToggleControlPanel", async () => {
    try {
      await vscode.commands.executeCommand("workbench.view.extension.narrateHelp");
      await vscode.commands.executeCommand("narrate.toggleControlView.focus");
    } catch {
      void vscode.window.showInformationMessage(
        "Narrate: open the 'Narrate Help' activity tab to view the Toggle Panel."
      );
    }
  });
}
