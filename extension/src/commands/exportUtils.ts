import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";

export async function resolveExportBaseDir(context: vscode.ExtensionContext): Promise<string> {
  const config = vscode.workspace.getConfiguration("narrate.export");
  const configured = config.get<string>("outputDir", ".narrate/exports").trim();

  let exportPath: string;
  if (path.isAbsolute(configured)) {
    exportPath = configured;
  } else if (vscode.workspace.workspaceFolders?.[0]) {
    exportPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, configured);
  } else {
    exportPath = path.join(context.globalStorageUri.fsPath, "exports");
  }

  await fs.mkdir(exportPath, { recursive: true });
  return exportPath;
}

export function sanitizePathSegment(input: string): string {
  return input.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
}

export function toWorkspaceRelativePath(filePath: string): string {
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
  if (!folder) {
    return path.basename(filePath);
  }
  return path.relative(folder.uri.fsPath, filePath);
}
