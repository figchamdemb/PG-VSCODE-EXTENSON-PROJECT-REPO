import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";
import { NarrateSchemeProvider } from "../readingView/narrateSchemeProvider";
import { NarrationMode } from "../types";
import {
  getCurrentEduDetailLevel,
  getCurrentMode,
  getCurrentReadingPaneMode,
  getCurrentReadingSnippetMode,
  getCurrentReadingViewMode,
  setCurrentMode
} from "./modeState";

export function registerSwitchNarrationModeCommand(
  context: vscode.ExtensionContext,
  gates: FeatureGateService,
  provider: NarrateSchemeProvider,
  onModeChanged: (mode: NarrationMode) => void
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.switchNarrationMode", async () => {
    const current = getCurrentMode(context);
    const picked = await vscode.window.showQuickPick(
      [
        { label: "Developer mode", value: "dev" as NarrationMode },
        { label: "Education mode", value: "edu" as NarrationMode }
      ],
      { title: `Narrate mode (current: ${current})` }
    );
    if (!picked) {
      return;
    }
    if (picked.value === "edu") {
      const allowed = await gates.requireEduViewFeature();
      if (!allowed) {
        return;
      }
    }

    await setCurrentMode(context, picked.value);
    onModeChanged(picked.value);
    const opened = await provider.openNarrationFromContext({
      mode: picked.value,
      viewMode: getCurrentReadingViewMode(context),
      paneMode: getCurrentReadingPaneMode(context),
      snippetMode: getCurrentReadingSnippetMode(context),
      eduDetailLevel: getCurrentEduDetailLevel(context)
    });
    if (!opened) {
      vscode.window.showInformationMessage(`Narrate mode set to ${picked.value.toUpperCase()}.`);
    }
  });
}
