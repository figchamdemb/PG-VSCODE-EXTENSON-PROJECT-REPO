import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export type ProjectPackageResolution = {
  packageJsonPath: string;
  projectRoot: string;
  startPath: string;
  workspaceFolderPath?: string;
};

type ResolveOptions = {
  seedPath?: string;
  seedUri?: vscode.Uri;
};

export function resolveNearestProjectPackage(
  options: ResolveOptions = {}
): ProjectPackageResolution | undefined {
  const candidates = buildCandidateStartPaths(options);
  for (const candidate of candidates) {
    const workspaceFolderPath = resolveWorkspaceFolderPath(candidate);
    const match = walkParentsForPackageJson(candidate, workspaceFolderPath);
    if (!match) {
      continue;
    }
    return {
      ...match,
      startPath: candidate,
      workspaceFolderPath
    };
  }
  return undefined;
}

function buildCandidateStartPaths(options: ResolveOptions): string[] {
  const values: string[] = [];
  if (options.seedPath) {
    values.push(options.seedPath);
  }
  if (options.seedUri && options.seedUri.scheme === "file") {
    values.push(options.seedUri.fsPath);
  }

  const activeDocument = vscode.window.activeTextEditor?.document;
  if (activeDocument && activeDocument.uri.scheme === "file") {
    values.push(activeDocument.uri.fsPath);
  }

  for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
    values.push(workspaceFolder.uri.fsPath);
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const candidate = normalizePathToDirectory(value);
    const key = candidate.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(candidate);
  }
  return normalized;
}

function resolveWorkspaceFolderPath(value: string): string | undefined {
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(value));
  return folder?.uri.fsPath;
}

function walkParentsForPackageJson(
  startPath: string,
  workspaceFolderPath?: string
): Omit<ProjectPackageResolution, "startPath" | "workspaceFolderPath"> | undefined {
  let cursor = normalizePathToDirectory(startPath);
  const stopKey = workspaceFolderPath
    ? path.resolve(workspaceFolderPath).toLowerCase()
    : undefined;

  while (true) {
    const candidate = path.join(cursor, "package.json");
    if (fs.existsSync(candidate)) {
      return {
        packageJsonPath: candidate,
        projectRoot: cursor
      };
    }
    if (stopKey && cursor.toLowerCase() === stopKey) {
      return undefined;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      return undefined;
    }
    cursor = parent;
  }
}

function normalizePathToDirectory(value: string): string {
  const absolute = path.resolve(value);
  try {
    const stats = fs.statSync(absolute);
    if (stats.isDirectory()) {
      return absolute;
    }
  } catch {
    // Keep best-effort normalization for stale paths.
  }
  return path.dirname(absolute);
}
