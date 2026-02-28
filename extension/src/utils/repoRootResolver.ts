import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export type RepoRootResolution = {
  repoRoot: string;
  pgScriptPath: string;
  startPath: string;
};

type ResolveOptions = {
  seedPath?: string;
  seedUri?: vscode.Uri;
};

export function resolveRepoRoot(options: ResolveOptions = {}): RepoRootResolution | undefined {
  const candidates = buildCandidateStartPaths(options);
  for (const candidate of candidates) {
    const match = walkParentsForRepoRoot(candidate);
    if (match) {
      return match;
    }
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

  const activeDoc = vscode.window.activeTextEditor?.document;
  if (activeDoc && activeDoc.uri.scheme === "file") {
    values.push(activeDoc.uri.fsPath);
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    values.push(folder.uri.fsPath);
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const absolute = normalizePathToDirectory(value);
    const key = absolute.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(absolute);
  }
  return normalized;
}

function normalizePathToDirectory(value: string): string {
  const absolute = path.resolve(value);
  try {
    const stats = fs.statSync(absolute);
    if (stats.isDirectory()) {
      return absolute;
    }
  } catch {
    // Keep best-effort fallback path normalization.
  }
  return path.dirname(absolute);
}

function walkParentsForRepoRoot(startPath: string): RepoRootResolution | undefined {
  let cursor = startPath;
  while (true) {
    const pgScriptPath = path.join(cursor, "pg.ps1");
    if (fs.existsSync(pgScriptPath)) {
      return {
        repoRoot: cursor,
        pgScriptPath,
        startPath
      };
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      return undefined;
    }
    cursor = parent;
  }
}
