import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { FeatureGateService } from "../licensing/featureGates";
import { NarrationEngine } from "../narration/narrationEngine";
import { renderNarrationDocument } from "../readingView/renderNarration";
import { getCurrentMode } from "./modeState";
import { resolveExportBaseDir, sanitizePathSegment, toWorkspaceRelativePath } from "./exportUtils";

export function registerExportNarrationWorkspaceCommand(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine,
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.exportNarrationWorkspace", async () => {
    const allowed = await gates.requireProFeature("Export Narration (Workspace)");
    if (!allowed) {
      return;
    }

    if (!vscode.workspace.workspaceFolders?.length) {
      vscode.window.showWarningMessage("Narrate: open a workspace folder first.");
      return;
    }

    const mode = getCurrentMode(context);
    const exportBaseDir = await resolveExportBaseDir(context);
    const runTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const runDir = path.join(exportBaseDir, `workspace-export-${runTimestamp}`);
    await fs.mkdir(runDir, { recursive: true });

    const config = vscode.workspace.getConfiguration("narrate.export");
    const includeGlob = config.get<string>(
      "includeGlob",
      "**/*.{ts,tsx,js,jsx,java,kt,kts,py,go,rs,cs,cpp,c,h,hpp,json,yml,yaml,sql,xml,html,css,scss,swift,dart,md}"
    );
    const excludeGlob = config.get<string>(
      "excludeGlob",
      "**/{node_modules,dist,build,.git,.next,coverage,.venv,venv,.gradle,target,out}/**"
    );
    const maxFiles = config.get<number>("maxFiles", 120);
    const maxCharsPerFile = config.get<number>("maxCharsPerFile", 40000);

    const files = await vscode.workspace.findFiles(includeGlob, excludeGlob, maxFiles);
    if (files.length === 0) {
      vscode.window.showWarningMessage("Narrate: no files matched workspace export glob.");
      return;
    }

    const indexLines: string[] = [
      "# Narrate Workspace Export",
      `Generated: ${new Date().toISOString()}`,
      `Mode: ${mode}`,
      `Matched files: ${files.length}`,
      ""
    ];

    let exportedCount = 0;
    let skippedCount = 0;

    await vscode.window.withProgress(
      {
        title: "Narrate: Exporting workspace narration",
        location: vscode.ProgressLocation.Notification,
        cancellable: false
      },
      async (progress) => {
        for (let idx = 0; idx < files.length; idx += 1) {
          const file = files[idx];
          progress.report({
            message: `${idx + 1}/${files.length} ${path.basename(file.fsPath)}`,
            increment: Math.max(1, Math.floor(100 / files.length))
          });

          try {
            const doc = await vscode.workspace.openTextDocument(file);
            if (doc.getText().length > maxCharsPerFile) {
              skippedCount += 1;
              indexLines.push(`- SKIPPED (too large): \`${toWorkspaceRelativePath(file.fsPath)}\``);
              continue;
            }

            const narrations = await narrationEngine.narrateDocument(doc, mode);
            const rendered = renderNarrationDocument(doc, mode, narrations);
            const relativePath = toWorkspaceRelativePath(file.fsPath);
            const normalizedRelative = relativePath.split(path.sep).map(sanitizePathSegment).join(path.sep);
            const targetPath = path.join(runDir, `${normalizedRelative}.narrate.${mode}.md`);

            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await fs.writeFile(targetPath, rendered, "utf8");

            exportedCount += 1;
            indexLines.push(`- EXPORTED: \`${relativePath}\` -> \`${path.relative(runDir, targetPath)}\``);
          } catch {
            skippedCount += 1;
            indexLines.push(`- SKIPPED (read/export error): \`${toWorkspaceRelativePath(file.fsPath)}\``);
          }
        }
      }
    );

    indexLines.unshift(
      `Summary: exported=${exportedCount}, skipped=${skippedCount}`,
      ""
    );
    const indexPath = path.join(runDir, "index.md");
    await fs.writeFile(indexPath, indexLines.join("\n"), "utf8");
    const indexDoc = await vscode.workspace.openTextDocument(indexPath);
    await vscode.window.showTextDocument(indexDoc, { preview: false });

    vscode.window.showInformationMessage(
      `Narrate: workspace export complete. exported=${exportedCount}, skipped=${skippedCount}`
    );
  });
}
