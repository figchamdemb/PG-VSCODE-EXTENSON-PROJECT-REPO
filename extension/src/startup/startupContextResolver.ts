import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { RepoRootResolution, resolveRepoRoot } from "../utils/repoRootResolver";

export type StartupContextResolution = {
  key: string;
  contextDirectory: string;
  label: string;
  agentsPath?: string;
  repo: RepoRootResolution;
};

type ResolveOptions = {
  seedPath?: string;
  seedUri?: vscode.Uri;
};

export function resolveStartupContext(
  options: ResolveOptions = {}
): StartupContextResolution | undefined {
  const repo = resolveRepoRoot(options);
  if (!repo) {
    return undefined;
  }

  const agentsPath = findNearestAgentsPath(repo.startPath, repo.repoRoot);
  const contextDirectory = agentsPath ? path.dirname(agentsPath) : repo.repoRoot;
  const label = path.basename(contextDirectory) || path.basename(repo.repoRoot) || "current context";

  return {
    key: `${contextDirectory.toLowerCase()}|${repo.repoRoot.toLowerCase()}`,
    contextDirectory,
    label,
    agentsPath,
    repo
  };
}

function findNearestAgentsPath(
  startPath: string,
  stopDirectory: string
): string | undefined {
  let cursor = normalizePathToDirectory(startPath);
  const stopKey = path.resolve(stopDirectory).toLowerCase();

  while (true) {
    const candidate = path.join(cursor, "AGENTS.md");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    if (cursor.toLowerCase() === stopKey) {
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
    // Best-effort fallback for paths that no longer exist.
  }
  return path.dirname(absolute);
}
