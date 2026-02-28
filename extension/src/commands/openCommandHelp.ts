import * as vscode from "vscode";

export function registerOpenCommandHelpCommand(): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.openCommandHelp", async () => {
    try {
      await vscode.commands.executeCommand("workbench.view.extension.narrateHelp");
      await vscode.commands.executeCommand("narrate.commandHelpView.focus");
    } catch {
      void vscode.window.showInformationMessage(
        "Narrate: open the 'Narrate Help' activity tab to view command help."
      );
    }
  });
}
