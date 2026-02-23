import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";
import { NarrateSchemeProvider } from "../readingView/narrateSchemeProvider";
import { NarrationMode } from "../types";
import { setCurrentMode } from "./modeState";

export function registerToggleReadingModeCommand(
  context: vscode.ExtensionContext,
  provider: NarrateSchemeProvider,
  gates: FeatureGateService,
  mode: NarrationMode,
  commandId: string,
  onModeChanged: (mode: NarrationMode) => void
): vscode.Disposable {
  return vscode.commands.registerCommand(commandId, async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("Narrate: open a source file first.");
      return;
    }

    const activeDoc = editor.document;
    if (activeDoc.uri.scheme === "narrate") {
      vscode.window.showWarningMessage("Narrate: switch to a source code tab first.");
      return;
    }

    if (mode === "edu") {
      const allowed = await gates.requireEduViewFeature();
      if (!allowed) {
        return;
      }
    }

    await setCurrentMode(context, mode);
    onModeChanged(mode);
    await provider.openNarrationView(activeDoc, mode);
  });
}
