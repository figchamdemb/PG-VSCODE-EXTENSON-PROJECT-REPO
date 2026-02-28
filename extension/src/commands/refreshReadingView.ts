import * as vscode from "vscode";
import { NarrateSchemeProvider } from "../readingView/narrateSchemeProvider";
import {
  getCurrentEduDetailLevel,
  getCurrentMode,
  getCurrentReadingPaneMode,
  getCurrentReadingSnippetMode,
  getCurrentReadingViewMode
} from "./modeState";

export function registerRefreshReadingViewCommand(
  context: vscode.ExtensionContext,
  provider: NarrateSchemeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.refreshReadingView", async () => {
    const opened = await provider.openNarrationFromContext({
      mode: getCurrentMode(context),
      viewMode: getCurrentReadingViewMode(context),
      paneMode: getCurrentReadingPaneMode(context),
      snippetMode: getCurrentReadingSnippetMode(context),
      eduDetailLevel: getCurrentEduDetailLevel(context)
    });
    if (!opened) {
      void vscode.window.showWarningMessage(
        "Narrate: open a source file (or previous Narrate tab) before refresh."
      );
    }
  });
}
