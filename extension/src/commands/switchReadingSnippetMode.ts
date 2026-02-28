import * as vscode from "vscode";
import { NarrateSchemeProvider } from "../readingView/narrateSchemeProvider";
import {
  getCurrentEduDetailLevel,
  getCurrentMode,
  getCurrentReadingPaneMode,
  getCurrentReadingSnippetMode,
  getCurrentReadingViewMode,
  setCurrentReadingSnippetMode
} from "./modeState";

export function registerSwitchReadingSnippetModeCommand(
  context: vscode.ExtensionContext,
  provider: NarrateSchemeProvider,
  onReadingControlsChanged: () => void
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.switchReadingSnippetMode", async () => {
    const current = getCurrentReadingSnippetMode(context);
    const next = current === "withSource" ? "narrationOnly" : "withSource";
    await setCurrentReadingSnippetMode(context, next);
    onReadingControlsChanged();

    const opened = await provider.openNarrationFromContext({
      mode: getCurrentMode(context),
      viewMode: getCurrentReadingViewMode(context),
      paneMode: getCurrentReadingPaneMode(context),
      snippetMode: next,
      eduDetailLevel: getCurrentEduDetailLevel(context)
    });
    if (!opened) {
      const label = next === "withSource" ? "Code + meaning" : "Meaning only";
      void vscode.window.showInformationMessage(`Narrate source display set to ${label}.`);
    }
  });
}
