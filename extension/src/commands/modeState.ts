import * as vscode from "vscode";
import { NarrationMode } from "../types";

const MODE_KEY = "narrate.mode";

export function getCurrentMode(context: vscode.ExtensionContext): NarrationMode {
  const stored = context.workspaceState.get<string>(MODE_KEY);
  if (stored === "dev" || stored === "edu") {
    return stored;
  }
  const configured = vscode.workspace.getConfiguration("narrate").get<string>("defaultMode", "dev");
  return configured === "edu" ? "edu" : "dev";
}

export async function setCurrentMode(context: vscode.ExtensionContext, mode: NarrationMode): Promise<void> {
  await context.workspaceState.update(MODE_KEY, mode);
}
