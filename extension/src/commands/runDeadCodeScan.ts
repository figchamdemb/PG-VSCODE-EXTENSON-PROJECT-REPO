import * as path from "path";
import * as vscode from "vscode";
import { buildDeadCodeReportMarkdown } from "./deadCodeReport";
import { Logger } from "../utils/logger";

export { buildDeadCodeReportMarkdown };

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
      void vscode.window.showWarningMessage("Narrate: open a workspace folder before running dead-code scan.");
      return;
    }
    const settings = getDeadCodeScanSettings();
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Narrate: Running dead-code scan", cancellable: false },
      async (progress) => {
        progress.report({ message: "Collecting source files..." });
        return runDeadCodeScanForWorkspace(workspace, settings, progress);
      }
    );
    await showDeadCodeReport(result, logger);
  });
}

async function showDeadCodeReport(result: DeadCodeScanResult, logger: Logger): Promise<void> {
  const report = buildDeadCodeReportMarkdown(".", result);
  const doc = await vscode.workspace.openTextDocument({ language: "markdown", content: report });
  await vscode.window.showTextDocument(doc, { preview: false });

  const count = result.highConfidenceUnused.length + result.mediumConfidenceOrphans.length + result.lowConfidenceOrphans.length;
  if (count === 0) {
    logger.info("Dead-code scan completed with no candidates.");
    void vscode.window.showInformationMessage("Narrate Dead Code Scan: no candidates found.");
    return;
  }
  logger.warn(`Dead-code scan found ${count} candidate(s): high=${result.highConfidenceUnused.length}, medium=${result.mediumConfidenceOrphans.length}, low=${result.lowConfidenceOrphans.length}`);
  void vscode.window.showWarningMessage(`Narrate Dead Code Scan: ${count} candidate(s) found (high ${result.highConfidenceUnused.length}, medium ${result.mediumConfidenceOrphans.length}, low ${result.lowConfidenceOrphans.length}).`);
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
  const fileUris = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspace, settings.includeGlob),
    new vscode.RelativePattern(workspace, settings.excludeGlob),
    settings.maxFiles
  );
  const { snapshots, byCanonicalPath } = await buildFileSnapshots(fileUris, progress);
  progress?.report({ message: "Collecting TypeScript unused diagnostics...", increment: 15 });
  const highConfidenceUnused = collectUnusedDiagnostics(snapshots);
  progress?.report({ message: "Analyzing local import graph for orphan files...", increment: 20 });
  const { mediumConfidenceOrphans, lowConfidenceOrphans } = collectOrphanCandidates(snapshots, byCanonicalPath);
  return {
    generatedAtUtc: new Date().toISOString(), filesDiscovered: fileUris.length,
    filesScanned: snapshots.length, highConfidenceUnused, mediumConfidenceOrphans, lowConfidenceOrphans
  };
}

async function buildFileSnapshots(
  fileUris: vscode.Uri[], progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<{ snapshots: FileSnapshot[]; byCanonicalPath: Map<string, FileSnapshot> }> {
  const snapshots: FileSnapshot[] = [];
  const byCanonicalPath = new Map<string, FileSnapshot>();
  for (let i = 0; i < fileUris.length; i++) {
    const uri = fileUris[i];
    progress?.report({
      message: `Indexing ${i + 1}/${fileUris.length} ${vscode.workspace.asRelativePath(uri, false)}`,
      increment: fileUris.length === 0 ? 0 : ((i + 1) / fileUris.length) * 55
    });
    try {
      const snap = await buildSingleSnapshot(uri);
      snapshots.push(snap);
      byCanonicalPath.set(snap.canonicalPath, snap);
    } catch { /* skip unreadable files */ }
  }
  return { snapshots, byCanonicalPath };
}

async function buildSingleSnapshot(uri: vscode.Uri): Promise<FileSnapshot> {
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();
  return {
    uri, relativePath: toSlashPath(vscode.workspace.asRelativePath(uri, false)),
    canonicalPath: toCanonicalPath(uri.fsPath), text,
    hasExportSignal: hasExportSignal(text)
  };
}

function collectUnusedDiagnostics(snapshots: FileSnapshot[]): UnusedSymbolCandidate[] {
  const candidates: UnusedSymbolCandidate[] = [];
  for (const snap of snapshots) {
    for (const d of vscode.languages.getDiagnostics(snap.uri)) {
      if (!isUnusedDiagnostic(d)) continue;
      candidates.push({
        file: snap.relativePath, line: d.range.start.line + 1,
        code: typeof d.code === "object" ? d.code.value : d.code ?? "unknown",
        message: flattenDiagnosticMessage(d.message), confidence: "high"
      });
    }
  }
  return candidates.sort(compareUnusedCandidates);
}

function compareUnusedCandidates(a: UnusedSymbolCandidate, b: UnusedSymbolCandidate): number {
  return a.file.localeCompare(b.file) || a.line - b.line || String(a.code).localeCompare(String(b.code));
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
  snapshots: FileSnapshot[], byCanonicalPath: Map<string, FileSnapshot>
): { mediumConfidenceOrphans: OrphanFileCandidate[]; lowConfidenceOrphans: OrphanFileCandidate[] } {
  const inboundCounts = buildInboundCounts(snapshots, byCanonicalPath);
  const medium: OrphanFileCandidate[] = [];
  const low: OrphanFileCandidate[] = [];
  for (const snap of snapshots) {
    if ((inboundCounts.get(snap.canonicalPath) ?? 0) > 0) continue;
    if (isLikelyEntrypointFile(snap.relativePath)) continue;
    classifyOrphan(snap, medium, low);
  }
  const cmp = (a: OrphanFileCandidate, b: OrphanFileCandidate) => a.file.localeCompare(b.file);
  return { mediumConfidenceOrphans: medium.sort(cmp), lowConfidenceOrphans: low.sort(cmp) };
}

function buildInboundCounts(
  snapshots: FileSnapshot[], byCanonicalPath: Map<string, FileSnapshot>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const snap of snapshots) counts.set(snap.canonicalPath, 0);
  for (const snap of snapshots) {
    for (const specifier of extractLocalSpecifiers(snap.text)) {
      const target = resolveLocalImportTarget(snap.uri.fsPath, specifier, byCanonicalPath);
      if (target) counts.set(target.canonicalPath, (counts.get(target.canonicalPath) ?? 0) + 1);
    }
  }
  return counts;
}

function classifyOrphan(
  snap: FileSnapshot, medium: OrphanFileCandidate[], low: OrphanFileCandidate[]
): void {
  const isTest = isLikelyTestOrStoryFile(snap.relativePath);
  if (snap.hasExportSignal && !isTest) {
    medium.push({ file: snap.relativePath, reason: "No local imports found for an exported module.", confidence: "medium" });
    return;
  }
  low.push({
    file: snap.relativePath, confidence: "low",
    reason: isTest ? "No local imports found; likely test/story artifact." : "No local imports found; may be an entry invoked dynamically."
  });
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

const ENTRYPOINT_PATTERNS: Array<{ regex: RegExp; target: string }> = [
  { regex: /(^|\/)(index|main|app|server|extension)\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/u, target: "direct" },
  { regex: /\/app\/.*\/(page|layout|route)\.(ts|tsx|js|jsx)$/u, target: "nextjs" },
  { regex: /\/pages\/.*\.(ts|tsx|js|jsx)$/u, target: "pages" },
  { regex: /\/api\/.*\.(ts|tsx|js|jsx)$/u, target: "api" },
  { regex: /(^|\/)(vite|webpack|rollup|next|nuxt|astro|jest|vitest|playwright|babel|eslint|prettier|tsup|esbuild|tailwind|postcss)\.config\./u, target: "config" },
  { regex: /\.(module|controller|service|component|directive|guard|pipe|interceptor|filter|gateway|resolver)\.(ts|js)$/u, target: "framework" },
  { regex: /(^|\/)(middleware|worker|sw|service-worker|setup|teardown|global-setup|global-teardown)\.(ts|tsx|js|jsx|mts)$/u, target: "infra" },
  { regex: /(^|\/)bin\//u, target: "bin" },
  { regex: /\+(page|layout|error|server)\.(ts|js|svelte)$/u, target: "sveltekit" },
  { regex: /\/(prisma|migrations|seeds?)\//u, target: "prisma" },
];

function isLikelyEntrypointFile(relativePath: string): boolean {
  const normalized = relativePath.toLowerCase();
  return ENTRYPOINT_PATTERNS.some((p) => p.regex.test(normalized));
}

function isLikelyTestOrStoryFile(relativePath: string): boolean {
  const normalized = relativePath.toLowerCase();
  return /(\.test\.|\.spec\.|\.stories\.|__tests__|\/tests?\/)/u.test(normalized);
}

function toCanonicalPath(filePath: string): string {
  return path.normalize(filePath).toLowerCase();
}

function toSlashPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}
