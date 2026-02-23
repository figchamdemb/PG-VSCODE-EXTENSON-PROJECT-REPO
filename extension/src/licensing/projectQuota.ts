import { createHash } from "crypto";
import * as path from "path";
import * as vscode from "vscode";

export interface WorkspaceFingerprint {
  scope: "memorybank";
  repoFingerprint: string;
  repoLabel: string;
}

export function buildCurrentWorkspaceFingerprint(): WorkspaceFingerprint | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }

  const normalized = folders
    .map((folder) => path.resolve(folder.uri.fsPath))
    .sort((a, b) => a.localeCompare(b));
  const joined = normalized.join("::");
  const repoFingerprint = createHash("sha256").update(joined).digest("hex");

  const label =
    folders.length === 1
      ? path.basename(folders[0].uri.fsPath)
      : `${path.basename(folders[0].uri.fsPath)}+${folders.length - 1}`;

  return {
    scope: "memorybank",
    repoFingerprint,
    repoLabel: label
  };
}
