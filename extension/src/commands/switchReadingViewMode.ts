import * as vscode from "vscode";
import { NarrateSchemeProvider } from "../readingView/narrateSchemeProvider";
import {
  getCurrentEduDetailLevel,
  getCurrentMode,
  getCurrentReadingPaneMode,
  getCurrentReadingSnippetMode,
  getCurrentReadingViewMode,
  setCurrentReadingViewMode
} from "./modeState";

export function registerSwitchReadingViewModeCommand(
  context: vscode.ExtensionContext,
  provider: NarrateSchemeProvider,
  onReadingControlsChanged: () => void
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.switchReadingViewMode", async () => {
    const current = getCurrentReadingViewMode(context);
    const next = current === "exact" ? "section" : "exact";
    await setCurrentReadingViewMode(context, next);
    onReadingControlsChanged();

    const opened = await provider.openNarrationFromContext({
      mode: getCurrentMode(context),
      viewMode: next,
      paneMode: getCurrentReadingPaneMode(context),
      snippetMode: getCurrentReadingSnippetMode(context),
      eduDetailLevel: getCurrentEduDetailLevel(context)
    });
    if (!opened) {
      void vscode.window.showInformationMessage(
        `Narrate view mode set to ${next === "exact" ? "Exact" : "Section"}.`
      );
    }
  });
}
