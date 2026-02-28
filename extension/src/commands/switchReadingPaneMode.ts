import * as vscode from "vscode";
import { NarrateSchemeProvider } from "../readingView/narrateSchemeProvider";
import {
  getCurrentEduDetailLevel,
  getCurrentMode,
  getCurrentReadingPaneMode,
  getCurrentReadingSnippetMode,
  getCurrentReadingViewMode,
  setCurrentReadingPaneMode
} from "./modeState";

export function registerSwitchReadingPaneModeCommand(
  context: vscode.ExtensionContext,
  provider: NarrateSchemeProvider,
  onReadingControlsChanged: () => void
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.switchReadingPaneMode", async () => {
    const current = getCurrentReadingPaneMode(context);
    const next = current === "sideBySide" ? "fullPage" : "sideBySide";
    await setCurrentReadingPaneMode(context, next);
    onReadingControlsChanged();

    const opened = await provider.openNarrationFromContext({
      mode: getCurrentMode(context),
      viewMode: getCurrentReadingViewMode(context),
      paneMode: next,
      snippetMode: getCurrentReadingSnippetMode(context),
      eduDetailLevel: getCurrentEduDetailLevel(context)
    });
    if (!opened) {
      void vscode.window.showInformationMessage(
        `Narrate pane mode set to ${next === "sideBySide" ? "Split" : "Full page"}.`
      );
    }
  });
}
