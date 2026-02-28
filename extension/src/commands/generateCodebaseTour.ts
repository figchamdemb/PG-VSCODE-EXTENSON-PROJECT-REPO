import * as path from "path";
import * as vscode from "vscode";
import { buildTourMarkdown } from "./codebaseTourReport";
import {
  DEFAULT_CODEBASE_TOUR_EXCLUDE_GLOB,
  DEFAULT_CODEBASE_TOUR_INCLUDE_GLOB,
  DEFAULT_CODEBASE_TOUR_MAX_FILES,
  MAX_DEPENDENCIES,
  MAX_ENTRYPOINTS,
  MAX_INTERNAL_HOTSPOTS,
  MAX_ROUTES,
  MAX_TOP_DIRECTORIES,
  MAX_TOP_EXTENSIONS,
  ScoredEntry,
  TourSettings,
  TourSummary
} from "./codebaseTourTypes";
import { Logger } from "../utils/logger";

const IMPORT_SPECIFIER_PATTERNS: RegExp[] = [
  /\bimport\s+[^'"`]*?\sfrom\s*['"`]([^'"`]+)['"`]/gu,
  /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu,
  /\bexport\s+[^'"`]*?\sfrom\s*['"`]([^'"`]+)['"`]/gu,
  /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu
];

const SCRIPT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs"
]);


export function registerGenerateCodebaseTourCommand(logger: Logger): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.generateCodebaseTour", async () => {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) {
      void vscode.window.showWarningMessage(
        "Narrate: open a workspace folder before generating codebase tour."
      );
      return;
    }

    const settings = getTourSettings();
    const fileUris = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspace, settings.includeGlob),
      new vscode.RelativePattern(workspace, settings.excludeGlob),
      settings.maxFiles
    );

    if (fileUris.length === 0) {
      void vscode.window.showInformationMessage(
        "Narrate: no matching files found for codebase tour."
      );
      return;
    }

    const summary = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Narrate: Generating codebase tour",
        cancellable: false
      },
      async (progress) => buildTourSummary(workspace, fileUris, progress)
    );

    const report = buildTourMarkdown(summary);
    const document = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: report
    });
    await vscode.window.showTextDocument(document, { preview: false });

    logger.info(
      `Codebase tour generated: files=${summary.filesScanned}, entrypoints=${summary.likelyEntrypoints.length}, routes=${summary.routeSurface.length}`
    );
    void vscode.window.showInformationMessage(
      `Narrate Codebase Tour: scanned ${summary.filesScanned} files, found ${summary.likelyEntrypoints.length} entrypoint candidates.`
    );
  });
}

function getTourSettings(): TourSettings {
  const config = vscode.workspace.getConfiguration("narrate");
  return {
    includeGlob: config.get<string>(
      "codebaseTour.includeGlob",
      DEFAULT_CODEBASE_TOUR_INCLUDE_GLOB
    ),
    excludeGlob: config.get<string>(
      "codebaseTour.excludeGlob",
      DEFAULT_CODEBASE_TOUR_EXCLUDE_GLOB
    ),
    maxFiles: Math.max(
      1,
      config.get<number>("codebaseTour.maxFiles", DEFAULT_CODEBASE_TOUR_MAX_FILES)
    )
  };
}

async function buildTourSummary(
  workspace: vscode.WorkspaceFolder,
  fileUris: vscode.Uri[],
  progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<TourSummary> {
  const extensionCounts = new Map<string, number>();
  const directoryCounts = new Map<string, number>();
  const externalCounts = new Map<string, number>();
  const internalImportCounts = new Map<string, number>();
  const entrypoints: ScoredEntry[] = [];
  const routeSurface: string[] = [];
  const packageScripts: Array<{ file: string; scripts: string[] }> = [];

  let scannedFiles = 0;
  let testFileCount = 0;

  for (let index = 0; index < fileUris.length; index += 1) {
    const uri = fileUris[index];
    const relativePath = toSlash(vscode.workspace.asRelativePath(uri, false));
    progress.report({
      message: `${index + 1}/${fileUris.length} ${relativePath}`,
      increment: ((index + 1) / fileUris.length) * 100
    });

    const extension = path.extname(relativePath).toLowerCase();
    const topDir = getTopDir(relativePath);
    incrementCount(extensionCounts, extension || "<none>");
    incrementCount(directoryCounts, topDir);
    scannedFiles += 1;

    if (isTestPath(relativePath)) {
      testFileCount += 1;
    }

    const entrypoint = scoreEntrypoint(relativePath);
    if (entrypoint) {
      entrypoints.push(entrypoint);
    }

    if (isRouteSurfacePath(relativePath)) {
      routeSurface.push(relativePath);
    }

    if (!SCRIPT_EXTENSIONS.has(extension) && !relativePath.endsWith("/package.json")) {
      continue;
    }

    let text = "";
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      text = doc.getText();
    } catch {
      continue;
    }

    if (SCRIPT_EXTENSIONS.has(extension)) {
      const localCount = collectImportStats(relativePath, text, externalCounts);
      if (localCount > 0) {
        internalImportCounts.set(relativePath, localCount);
      }
    }

    if (relativePath.endsWith("/package.json") || relativePath === "package.json") {
      const scripts = readPackageScripts(text);
      if (scripts.length > 0) {
        packageScripts.push({
          file: relativePath,
          scripts
        });
      }
    }
  }

  const likelyEntrypoints = entrypoints
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return left.file.localeCompare(right.file);
    })
    .slice(0, MAX_ENTRYPOINTS);

  const sortedRouteSurface = [...new Set(routeSurface)]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, MAX_ROUTES);

  const topExtensions = toSortedPairs(extensionCounts, "extension").slice(0, MAX_TOP_EXTENSIONS);
  const topDirectories = toSortedPairs(directoryCounts, "name").slice(0, MAX_TOP_DIRECTORIES);
  const externalDependencies = toSortedPairs(externalCounts, "name").slice(0, MAX_DEPENDENCIES);
  const internalHotspots = toSortedPairs(internalImportCounts, "file")
    .slice(0, MAX_INTERNAL_HOTSPOTS)
    .map((item) => ({
      file: item.file,
      localImports: item.count
    }));

  return {
    generatedAtUtc: new Date().toISOString(),
    workspaceRoot: workspace.uri.fsPath,
    filesDiscovered: fileUris.length,
    filesScanned: scannedFiles,
    testFileCount,
    topExtensions,
    topDirectories,
    likelyEntrypoints,
    routeSurface: sortedRouteSurface,
    externalDependencies,
    internalHotspots,
    packageScripts
  };
}

function collectImportStats(
  relativePath: string,
  text: string,
  externalCounts: Map<string, number>
): number {
  let localImports = 0;
  for (const pattern of IMPORT_SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier) {
        continue;
      }
      if (specifier.startsWith(".")) {
        localImports += 1;
        continue;
      }
      const dep = normalizeDependencyName(specifier);
      if (!dep) {
        continue;
      }
      incrementCount(externalCounts, dep);
    }
  }

  if (isLikelyConfigFile(relativePath)) {
    localImports += 1;
  }
  return localImports;
}

function normalizeDependencyName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split("/")[0];
}

function readPackageScripts(text: string): string[] {
  try {
    const parsed = JSON.parse(text) as { scripts?: Record<string, unknown> };
    const scripts = parsed.scripts;
    if (!scripts || typeof scripts !== "object") {
      return [];
    }
    return Object.keys(scripts).sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function scoreEntrypoint(relativePath: string): ScoredEntry | undefined {
  const lower = relativePath.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  if (
    /(^|\/)(index|main|app|server|extension)\.(ts|tsx|js|jsx|mts|cts|mjs|cjs|py|go|rs|cs|java)$/u.test(
      lower
    )
  ) {
    score += 60;
    reasons.push("core entry filename");
  }
  if (/\/src\/(index|main|app)\./u.test(lower)) {
    score += 25;
    reasons.push("src entry location");
  }
  if (/\/app\/.*\/(layout|page|route)\.(ts|tsx|js|jsx)$/u.test(lower)) {
    score += 35;
    reasons.push("app router surface");
  }
  if (/\/pages\/.*\.(ts|tsx|js|jsx)$/u.test(lower)) {
    score += 25;
    reasons.push("pages router surface");
  }
  if (lower.endsWith("/package.json") || lower === "package.json") {
    score += 50;
    reasons.push("workspace manifest");
  }
  if (isLikelyConfigFile(relativePath)) {
    score += 20;
    reasons.push("runtime/build config");
  }

  if (score === 0) {
    return undefined;
  }
  return {
    file: relativePath,
    score,
    reason: reasons.join(", ")
  };
}

function isLikelyConfigFile(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  return /(^|\/)(next|vite|webpack|rollup|tsup|babel|eslint|prettier|tailwind|postcss|jest|vitest|playwright)\.config\./u.test(
    lower
  );
}

function isRouteSurfacePath(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  if (
    lower.includes("/routes/") ||
    lower.includes("/route/") ||
    lower.includes("/controllers/") ||
    lower.includes("/controller/") ||
    lower.includes("/api/")
  ) {
    return true;
  }
  if (/\/app\/.*\/route\.(ts|tsx|js|jsx)$/u.test(lower)) {
    return true;
  }
  return /(^|\/)(route|controller)\.(ts|tsx|js|jsx|py|go|java|cs)$/u.test(lower);
}

function isTestPath(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  return (
    lower.includes("/__tests__/") ||
    lower.includes("/tests/") ||
    lower.includes(".test.") ||
    lower.includes(".spec.")
  );
}

function getTopDir(relativePath: string): string {
  const segments = relativePath.split("/");
  return segments[0] || "<root>";
}

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toSortedPairs(
  map: Map<string, number>,
  keyLabel: "name" | "extension" | "file"
): Array<{ [K in typeof keyLabel]: string } & { count: number }> {
  const pairs = [...map.entries()]
    .map(([key, count]) => ({
      [keyLabel]: key,
      count
    })) as Array<{ [K in typeof keyLabel]: string } & { count: number }>;

  return pairs.sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count;
    }
    return String(left[keyLabel]).localeCompare(String(right[keyLabel]));
  });
}

function toSlash(value: string): string {
  return value.replaceAll("\\", "/");
}
