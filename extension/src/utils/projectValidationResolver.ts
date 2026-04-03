import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export type ValidationWorkspaceKind = "node" | "java" | "unknown";

export type ValidationWorkspaceResolution = {
  kind: ValidationWorkspaceKind;
  projectRoot: string | null;
  manifestPath: string | null;
};

type ResolveOptions = {
  seedPath?: string;
  seedUri?: vscode.Uri;
};

const JAVA_MANIFEST_FILES = ["pom.xml", "build.gradle", "build.gradle.kts"] as const;

export function resolveValidationWorkspace(
  options: ResolveOptions = {}
): ValidationWorkspaceResolution {
  for (const candidate of buildCandidateStartPaths(options)) {
    const workspaceFolderPath = resolveWorkspaceFolderPath(candidate);
    const match = walkParentsForValidationWorkspace(candidate, workspaceFolderPath);
    if (match) {
      return match;
    }
  }

  return {
    kind: "unknown",
    projectRoot: null,
    manifestPath: null
  };
}

function buildCandidateStartPaths(options: ResolveOptions): string[] {
  const values: string[] = [];
  if (options.seedPath) {
    values.push(options.seedPath);
  }
  if (options.seedUri?.scheme === "file") {
    values.push(options.seedUri.fsPath);
  }

  const activeDocument = vscode.window.activeTextEditor?.document;
  if (activeDocument?.uri.scheme === "file") {
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

function walkParentsForValidationWorkspace(
  startPath: string,
  workspaceFolderPath?: string
): ValidationWorkspaceResolution | undefined {
  let cursor = normalizePathToDirectory(startPath);
  const stopKey = workspaceFolderPath
    ? path.resolve(workspaceFolderPath).toLowerCase()
    : undefined;

  while (true) {
    const nodeManifest = path.join(cursor, "package.json");
    if (fs.existsSync(nodeManifest)) {
      return {
        kind: "node",
        projectRoot: cursor,
        manifestPath: nodeManifest
      };
    }

    for (const manifestName of JAVA_MANIFEST_FILES) {
      const javaManifest = path.join(cursor, manifestName);
      if (fs.existsSync(javaManifest)) {
        return {
          kind: "java",
          projectRoot: cursor,
          manifestPath: javaManifest
        };
      }
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
    // Best-effort normalization for stale paths.
  }
  return path.dirname(absolute);
}
