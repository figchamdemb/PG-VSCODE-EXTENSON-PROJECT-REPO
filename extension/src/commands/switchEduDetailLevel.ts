import * as vscode from "vscode";
import { NarrateSchemeProvider } from "../readingView/narrateSchemeProvider";
import {
  getCurrentEduDetailLevel,
  getCurrentMode,
  getCurrentReadingPaneMode,
  getCurrentReadingSnippetMode,
  getCurrentReadingViewMode,
  setCurrentEduDetailLevel
} from "./modeState";

export function registerSwitchEduDetailLevelCommand(
  context: vscode.ExtensionContext,
  provider: NarrateSchemeProvider,
  onReadingControlsChanged: () => void
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.switchEduDetailLevel", async () => {
    const current = getCurrentEduDetailLevel(context);
    const next =
      current === "standard" ? "beginner" : current === "beginner" ? "fullBeginner" : "standard";
    await setCurrentEduDetailLevel(context, next);
    onReadingControlsChanged();

    const opened = await provider.openNarrationFromContext({
      mode: getCurrentMode(context),
      viewMode: getCurrentReadingViewMode(context),
      paneMode: getCurrentReadingPaneMode(context),
      snippetMode: getCurrentReadingSnippetMode(context),
      eduDetailLevel: next
    });
    if (!opened) {
      const label =
        next === "fullBeginner"
          ? "Full Beginner (max explain)"
          : next === "beginner"
            ? "Beginner (deeper)"
            : "Standard";
      void vscode.window.showInformationMessage(`Narrate EDU detail set to ${label}.`);
    }
  });
}
