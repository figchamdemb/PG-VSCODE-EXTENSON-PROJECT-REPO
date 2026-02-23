import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { FeatureGateService } from "../licensing/featureGates";
import { NarrationEngine } from "../narration/narrationEngine";
import { renderNarrationDocument } from "../readingView/renderNarration";
import { getCurrentMode } from "./modeState";
import { resolveExportBaseDir, sanitizePathSegment } from "./exportUtils";

export function registerExportNarrationFileCommand(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine,
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.exportNarrationFile", async () => {
    const allowed = await gates.requireProFeature("Export Narration (Current File)");
    if (!allowed) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("Narrate: open a source file first.");
      return;
    }
    const document = editor.document;
    if (document.uri.scheme !== "file") {
      vscode.window.showWarningMessage("Narrate: current tab is not a local file.");
      return;
    }

    const mode = getCurrentMode(context);
    const narrations = await narrationEngine.narrateDocument(document, mode);
    const rendered = renderNarrationDocument(document, mode, narrations);
    const exportDir = await resolveExportBaseDir(context);

    const fileBase = sanitizePathSegment(path.basename(document.uri.fsPath));
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(exportDir, `${fileBase}.narrate.${mode}.${timestamp}.md`);

    await fs.writeFile(outputPath, rendered, "utf8");
    const opened = await vscode.workspace.openTextDocument(outputPath);
    await vscode.window.showTextDocument(opened, { preview: false, viewColumn: vscode.ViewColumn.Beside });
    vscode.window.showInformationMessage(`Narrate: exported current file narration to ${outputPath}`);
  });
}
