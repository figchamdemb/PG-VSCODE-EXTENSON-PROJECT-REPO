import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";
import { NarrateSchemeProvider } from "../readingView/narrateSchemeProvider";
import { NarrationMode } from "../types";
import {
  getCurrentEduDetailLevel,
  getCurrentReadingPaneMode,
  getCurrentReadingSnippetMode,
  getCurrentReadingViewMode,
  setCurrentMode
} from "./modeState";

export function registerSetNarrationModeCommand(
  context: vscode.ExtensionContext,
  provider: NarrateSchemeProvider,
  gates: FeatureGateService,
  mode: NarrationMode,
  commandId: string,
  onModeChanged: (mode: NarrationMode) => void
): vscode.Disposable {
  return vscode.commands.registerCommand(commandId, async () => {
    if (mode === "edu") {
      const allowed = await gates.requireEduViewFeature();
      if (!allowed) {
        return;
      }
    }

    await setCurrentMode(context, mode);
    onModeChanged(mode);

    const opened = await provider.openNarrationFromContext({
      mode,
      viewMode: getCurrentReadingViewMode(context),
      paneMode: getCurrentReadingPaneMode(context),
      snippetMode: getCurrentReadingSnippetMode(context),
      eduDetailLevel: getCurrentEduDetailLevel(context)
    });
    if (!opened) {
      void vscode.window.showInformationMessage(
        `Narrate mode set to ${mode.toUpperCase()}. Open a source file to render.`
      );
    }
  });
}
