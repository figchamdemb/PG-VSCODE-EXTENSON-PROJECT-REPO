import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";
import { NarrationMode } from "../types";
import { getCurrentMode, setCurrentMode } from "./modeState";

export function registerSwitchNarrationModeCommand(
  context: vscode.ExtensionContext,
  gates: FeatureGateService,
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
    vscode.window.showInformationMessage(`Narrate mode set to ${picked.value.toUpperCase()}.`);
  });
}
