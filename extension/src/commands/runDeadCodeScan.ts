import * as path from "path";
import * as vscode from "vscode";
import { Logger } from "../utils/logger";

type CandidateConfidence = "high" | "medium" | "low";

type UnusedSymbolCandidate = {
  file: string;
  line: number;
  code: number | string;
  message: string;
  confidence: CandidateConfidence;
};

type OrphanFileCandidate = {
  file: string;
  reason: string;
  confidence: CandidateConfidence;
};

type FileSnapshot = {
  uri: vscode.Uri;
  relativePath: string;
  canonicalPath: string;
  text: string;
  hasExportSignal: boolean;
};

export type DeadCodeScanResult = {
  generatedAtUtc: string;
  filesDiscovered: number;
  filesScanned: number;
  highConfidenceUnused: UnusedSymbolCandidate[];
  mediumConfidenceOrphans: OrphanFileCandidate[];
  lowConfidenceOrphans: OrphanFileCandidate[];
};

export type DeadCodeScanSettings = {
  includeGlob: string;
  excludeGlob: string;
  maxFiles: number;
};

export const DEFAULT_DEAD_CODE_SCAN_INCLUDE_GLOB = "**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}";
export const DEFAULT_DEAD_CODE_SCAN_EXCLUDE_GLOB =
  "**/{node_modules,.git,dist,build,out,coverage,.next,.turbo,Memory-bank,logs}/**";
export const DEFAULT_DEAD_CODE_SCAN_MAX_FILES = 600;

const IMPORT_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
  ".d.ts"
];

const HIGH_CONFIDENCE_UNUSED_DIAGNOSTIC_CODES = new Set<number>([
  6133, 6138, 6192, 6196
]);

const UNUSED_DIAGNOSTIC_PATTERNS: RegExp[] = [
  /is declared but its value is never read/iu,
  /is declared but never used/iu,
  /all imports in import declaration are unused/iu,
  /is assigned a value but never used/iu
];

const IMPORT_SPECIFIER_PATTERNS: RegExp[] = [
  /\bimport\s+[^'"`]*?\sfrom\s*['"`]([^'"`]+)['"`]/gu,
  /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu,
  /\bexport\s+[^'"`]*?\sfrom\s*['"`]([^'"`]+)['"`]/gu,
  /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gu
];

export function registerRunDeadCodeScanCommand(logger: Logger): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.runDeadCodeScan", async () => {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) {
      void vscode.window.showWarningMessage(
        "Narrate: open a workspace folder before running dead-code scan."
      );
      return;
    }

    const settings = getDeadCodeScanSettings();

    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Narrate: Running dead-code scan",
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: "Collecting source files..." });
        return runDeadCodeScanForWorkspace(workspace, settings, progress);
      }
    );

    const report = buildDeadCodeReportMarkdown(workspace.uri.fsPath, result);
    const reportDocument = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: report
    });
    await vscode.window.showTextDocument(reportDocument, { preview: false });

    const candidateCount =
      result.highConfidenceUnused.length +
      result.mediumConfidenceOrphans.length +
      result.lowConfidenceOrphans.length;
    if (candidateCount === 0) {
      logger.info("Dead-code scan completed with no candidates.");
      void vscode.window.showInformationMessage(
        "Narrate Dead Code Scan: no candidates found."
      );
      return;
    }

    logger.warn(
      `Dead-code scan found ${candidateCount} candidate(s): high=${result.highConfidenceUnused.length}, medium=${result.mediumConfidenceOrphans.length}, low=${result.lowConfidenceOrphans.length}`
    );
    void vscode.window.showWarningMessage(
      `Narrate Dead Code Scan: ${candidateCount} candidate(s) found (high ${result.highConfidenceUnused.length}, medium ${result.mediumConfidenceOrphans.length}, low ${result.lowConfidenceOrphans.length}).`
    );
  });
}

export function getDeadCodeScanSettings(): DeadCodeScanSettings {
  const config = vscode.workspace.getConfiguration("narrate");
  return {
    includeGlob: config.get<string>(
      "deadCodeScan.includeGlob",
      DEFAULT_DEAD_CODE_SCAN_INCLUDE_GLOB
    ),
    excludeGlob: config.get<string>(
      "deadCodeScan.excludeGlob",
      DEFAULT_DEAD_CODE_SCAN_EXCLUDE_GLOB
    ),
    maxFiles: Math.max(
      1,
      config.get<number>("deadCodeScan.maxFiles", DEFAULT_DEAD_CODE_SCAN_MAX_FILES)
    )
  };
}

export async function runDeadCodeScanForWorkspace(
  workspace: vscode.WorkspaceFolder,
  settings: DeadCodeScanSettings,
  progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<DeadCodeScanResult> {
  const includeGlob = settings.includeGlob;
  const excludeGlob = settings.excludeGlob;
  const maxFiles = settings.maxFiles;
  const fileUris = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspace, includeGlob),
    new vscode.RelativePattern(workspace, excludeGlob),
    maxFiles
  );

  const snapshots: FileSnapshot[] = [];
  const byCanonicalPath = new Map<string, FileSnapshot>();
  for (let index = 0; index < fileUris.length; index += 1) {
    const uri = fileUris[index];
    progress?.report({
      message: `Indexing ${index + 1}/${fileUris.length} ${vscode.workspace.asRelativePath(uri, false)}`,
      increment: fileUris.length === 0 ? 0 : ((index + 1) / fileUris.length) * 55
    });
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const relativePath = toSlashPath(vscode.workspace.asRelativePath(uri, false));
      const snapshot: FileSnapshot = {
        uri,
        relativePath,
        canonicalPath: toCanonicalPath(uri.fsPath),
        text: document.getText(),
        hasExportSignal: hasExportSignal(document.getText())
      };
      snapshots.push(snapshot);
      byCanonicalPath.set(snapshot.canonicalPath, snapshot);
    } catch {
      // Skip unreadable files while continuing the scan.
    }
  }

  progress?.report({ message: "Collecting TypeScript unused diagnostics...", increment: 15 });
  const highConfidenceUnused = collectUnusedDiagnostics(snapshots);

  progress?.report({ message: "Analyzing local import graph for orphan files...", increment: 20 });
  const { mediumConfidenceOrphans, lowConfidenceOrphans } = collectOrphanCandidates(
    snapshots,
    byCanonicalPath
  );

  return {
    generatedAtUtc: new Date().toISOString(),
    filesDiscovered: fileUris.length,
    filesScanned: snapshots.length,
    highConfidenceUnused,
    mediumConfidenceOrphans,
    lowConfidenceOrphans
  };
}

function collectUnusedDiagnostics(snapshots: FileSnapshot[]): UnusedSymbolCandidate[] {
  const candidates: UnusedSymbolCandidate[] = [];
  for (const snapshot of snapshots) {
    const diagnostics = vscode.languages.getDiagnostics(snapshot.uri);
    for (const diagnostic of diagnostics) {
      if (!isUnusedDiagnostic(diagnostic)) {
        continue;
      }
      candidates.push({
        file: snapshot.relativePath,
        line: diagnostic.range.start.line + 1,
        code:
          typeof diagnostic.code === "object"
            ? diagnostic.code.value
            : diagnostic.code ?? "unknown",
        message: flattenDiagnosticMessage(diagnostic.message),
        confidence: "high"
      });
    }
  }

  return candidates.sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }
    if (left.line !== right.line) {
      return left.line - right.line;
    }
    return String(left.code).localeCompare(String(right.code));
  });
}

function isUnusedDiagnostic(diagnostic: vscode.Diagnostic): boolean {
  const source = String(diagnostic.source ?? "").toLowerCase();
  if (!source.includes("ts")) {
    return false;
  }

  const rawCode =
    typeof diagnostic.code === "object" ? diagnostic.code.value : diagnostic.code;
  if (typeof rawCode === "number" && HIGH_CONFIDENCE_UNUSED_DIAGNOSTIC_CODES.has(rawCode)) {
    return true;
  }

  return UNUSED_DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(diagnostic.message));
}

function flattenDiagnosticMessage(message: string): string {
  return message.replace(/\s+/gu, " ").trim();
}

function collectOrphanCandidates(
  snapshots: FileSnapshot[],
  byCanonicalPath: Map<string, FileSnapshot>
): {
  mediumConfidenceOrphans: OrphanFileCandidate[];
  lowConfidenceOrphans: OrphanFileCandidate[];
} {
  const inboundCounts = new Map<string, number>();
  for (const snapshot of snapshots) {
    inboundCounts.set(snapshot.canonicalPath, 0);
  }

  for (const snapshot of snapshots) {
    for (const specifier of extractLocalSpecifiers(snapshot.text)) {
      const target = resolveLocalImportTarget(snapshot.uri.fsPath, specifier, byCanonicalPath);
      if (!target) {
        continue;
      }
      inboundCounts.set(target.canonicalPath, (inboundCounts.get(target.canonicalPath) ?? 0) + 1);
    }
  }

  const mediumConfidenceOrphans: OrphanFileCandidate[] = [];
  const lowConfidenceOrphans: OrphanFileCandidate[] = [];
  for (const snapshot of snapshots) {
    const inboundCount = inboundCounts.get(snapshot.canonicalPath) ?? 0;
    if (inboundCount > 0) {
      continue;
    }
    if (isLikelyEntrypointFile(snapshot.relativePath)) {
      continue;
    }

    const isLikelyTest = isLikelyTestOrStoryFile(snapshot.relativePath);
    if (snapshot.hasExportSignal && !isLikelyTest) {
      mediumConfidenceOrphans.push({
        file: snapshot.relativePath,
        reason: "No local imports found for an exported module.",
        confidence: "medium"
      });
      continue;
    }

    lowConfidenceOrphans.push({
      file: snapshot.relativePath,
      reason: isLikelyTest
        ? "No local imports found; likely test/story artifact."
        : "No local imports found; may be an entry invoked dynamically.",
      confidence: "low"
    });
  }

  const sorter = (left: OrphanFileCandidate, right: OrphanFileCandidate): number =>
    left.file.localeCompare(right.file);

  return {
    mediumConfidenceOrphans: mediumConfidenceOrphans.sort(sorter),
    lowConfidenceOrphans: lowConfidenceOrphans.sort(sorter)
  };
}

function extractLocalSpecifiers(sourceText: string): string[] {
  const values: string[] = [];
  for (const pattern of IMPORT_SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of sourceText.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier || !specifier.startsWith(".")) {
        continue;
      }
      values.push(specifier);
    }
  }
  return values;
}

function resolveLocalImportTarget(
  fromFilePath: string,
  specifier: string,
  byCanonicalPath: Map<string, FileSnapshot>
): FileSnapshot | undefined {
  const basePath = path.resolve(path.dirname(fromFilePath), specifier);
  const candidates = buildImportCandidates(basePath);
  for (const candidatePath of candidates) {
    const target = byCanonicalPath.get(toCanonicalPath(candidatePath));
    if (target) {
      return target;
    }
  }
  return undefined;
}

function buildImportCandidates(basePath: string): string[] {
  const values = new Set<string>();
  values.add(basePath);
  for (const extension of IMPORT_EXTENSIONS) {
    values.add(`${basePath}${extension}`);
    values.add(path.join(basePath, `index${extension}`));
  }
  return Array.from(values);
}

function hasExportSignal(sourceText: string): boolean {
  if (/\bexport\s+(default|const|function|class|type|interface|\{|\*)/u.test(sourceText)) {
    return true;
  }
  return /\bmodule\.exports\b|\bexports\.[A-Za-z_]/u.test(sourceText);
}

function isLikelyEntrypointFile(relativePath: string): boolean {
  const normalized = relativePath.toLowerCase();
  if (
    /(^|\/)(index|main|app|server|extension)\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/u.test(
      normalized
    )
  ) {
    return true;
  }
  if (/\/app\/.*\/(page|layout|route)\.(ts|tsx|js|jsx)$/u.test(normalized)) {
    return true;
  }
  if (/\/pages\/.*\.(ts|tsx|js|jsx)$/u.test(normalized)) {
    return true;
  }
  if (/\/api\/.*\.(ts|tsx|js|jsx)$/u.test(normalized)) {
    return true;
  }
  return /(^|\/)(vite|webpack|rollup|next|nuxt|astro|jest|vitest|playwright|babel|eslint|prettier|tsup|esbuild|tailwind|postcss)\.config\./u.test(
    normalized
  );
}

function isLikelyTestOrStoryFile(relativePath: string): boolean {
  const normalized = relativePath.toLowerCase();
  return /(\.test\.|\.spec\.|\.stories\.|__tests__|\/tests?\/)/u.test(normalized);
}

export function buildDeadCodeReportMarkdown(
  workspaceRoot: string,
  result: DeadCodeScanResult
): string {
  const lines: string[] = [];
  lines.push("# Narrate Dead Code Scan");
  lines.push("");
  lines.push(`UTC: ${result.generatedAtUtc}`);
  lines.push("");
  lines.push(`Workspace: ${workspaceRoot}`);
  lines.push("");
  lines.push("## Confidence Guide");
  lines.push("");
  lines.push("- `High`: TypeScript reports explicit unused declarations/imports.");
  lines.push("- `Medium`: exported file has no inbound local imports in workspace import graph.");
  lines.push("- `Low`: no inbound local imports, but file may be called dynamically.");
  lines.push("- This scan is report-only and does not auto-delete code.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Files discovered: ${result.filesDiscovered}`);
  lines.push(`- Files scanned: ${result.filesScanned}`);
  lines.push(`- High-confidence candidates: ${result.highConfidenceUnused.length}`);
  lines.push(`- Medium-confidence orphan files: ${result.mediumConfidenceOrphans.length}`);
  lines.push(`- Low-confidence orphan files: ${result.lowConfidenceOrphans.length}`);

  lines.push("");
  lines.push("## High Confidence (TypeScript Unused Diagnostics)");
  lines.push("");
  if (result.highConfidenceUnused.length === 0) {
    lines.push("- none");
  } else {
    for (const candidate of result.highConfidenceUnused) {
      lines.push(
        `- \`${candidate.file}:${candidate.line}\` [TS${candidate.code}] ${candidate.message}`
      );
    }
  }

  lines.push("");
  lines.push("## Medium Confidence (Likely Orphan Modules)");
  lines.push("");
  if (result.mediumConfidenceOrphans.length === 0) {
    lines.push("- none");
  } else {
    for (const candidate of result.mediumConfidenceOrphans) {
      lines.push(`- \`${candidate.file}\` - ${candidate.reason}`);
    }
  }

  lines.push("");
  lines.push("## Low Confidence (Manual Review Required)");
  lines.push("");
  if (result.lowConfidenceOrphans.length === 0) {
    lines.push("- none");
  } else {
    for (const candidate of result.lowConfidenceOrphans) {
      lines.push(`- \`${candidate.file}\` - ${candidate.reason}`);
    }
  }

  lines.push("");
  lines.push("## Safe Cleanup Workflow");
  lines.push("");
  lines.push("- Use report candidates as review targets; do not bulk delete blindly.");
  lines.push(
    "- Optional guided flow: run `Narrate: Create Dead Code Cleanup Branch` before making cleanup edits."
  );
  lines.push(
    "- Optional safe autofix: run `Narrate: Apply Safe Dead Code Fixes` (organize imports on high-confidence files only)."
  );
  lines.push("- For import cleanup, run VS Code `Source Action: Organize Imports`.");
  lines.push(
    "- For stale diagnostics, run `Narrate: Restart TypeScript + Refresh Trust Score` then re-run this scan."
  );
  lines.push("- Re-run compile/tests after each cleanup batch before PG Push.");

  return lines.join("\n");
}

function toCanonicalPath(filePath: string): string {
  return path.normalize(filePath).toLowerCase();
}

function toSlashPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}
