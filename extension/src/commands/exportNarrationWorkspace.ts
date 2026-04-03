import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { FeatureGateService } from "../licensing/featureGates";
import { NarrationEngine } from "../narration/narrationEngine";
import { renderNarrationDocument } from "../readingView/renderNarration";
import { StartupContextEnforcer } from "../startup/startupContextEnforcer";
import { TrustScoreService } from "../trust/trustScoreService";
import { getCurrentMode } from "./modeState";
import { resolveExportBaseDir, sanitizePathSegment, toWorkspaceRelativePath } from "./exportUtils";

export function registerExportNarrationWorkspaceCommand(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine,
  gates: FeatureGateService,
  trustScoreService: TrustScoreService,
  startupContextEnforcer: StartupContextEnforcer
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.exportNarrationWorkspace", async () => {
    await runExportNarrationWorkspace(
      context,
      narrationEngine,
      gates,
      trustScoreService,
      startupContextEnforcer
    );
  });
}

type WorkspaceExportConfig = {
  includeGlob: string;
  excludeGlob: string;
  maxFiles: number;
  maxCharsPerFile: number;
};

type WorkspaceExportStats = {
  exportedCount: number;
  skippedCount: number;
};

async function runExportNarrationWorkspace(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine,
  gates: FeatureGateService,
  trustScoreService: TrustScoreService,
  startupContextEnforcer: StartupContextEnforcer
): Promise<void> {
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!(await startupContextEnforcer.ensureWorkspaceReadyForAction("exporting workspace narration", workspaceUri))) {
    return;
  }
  const allowed = await gates.requireProFeature("Export Narration (Workspace)");
  if (!allowed) {
    return;
  }
  if (!(await trustScoreService.ensureActionAllowed("Export Narration (Workspace)"))) {
    return;
  }

  if (!vscode.workspace.workspaceFolders?.length) {
    vscode.window.showWarningMessage("Narrate: open a workspace folder first.");
    return;
  }

  const mode = getCurrentMode(context);
  const runDir = await createWorkspaceExportRunDir(context);
  const config = readWorkspaceExportConfig();
  const files = await vscode.workspace.findFiles(config.includeGlob, config.excludeGlob, config.maxFiles);
  if (files.length === 0) {
    vscode.window.showWarningMessage("Narrate: no files matched workspace export glob.");
    return;
  }

  const indexLines = createWorkspaceExportIndex(mode, files.length);
  const stats = await exportWorkspaceFiles(
    files,
    config.maxCharsPerFile,
    mode,
    runDir,
    narrationEngine,
    indexLines
  );
  await openWorkspaceExportIndex(runDir, indexLines, stats);
}

async function createWorkspaceExportRunDir(
  context: vscode.ExtensionContext
): Promise<string> {
  const exportBaseDir = await resolveExportBaseDir(context);
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(exportBaseDir, `workspace-export-${runTimestamp}`);
  await fs.mkdir(runDir, { recursive: true });
  return runDir;
}

function readWorkspaceExportConfig(): WorkspaceExportConfig {
  const config = vscode.workspace.getConfiguration("narrate.export");
  return {
    includeGlob: config.get<string>(
      "includeGlob",
      "**/*.{ts,tsx,js,jsx,java,kt,kts,py,go,rs,cs,cpp,c,h,hpp,json,yml,yaml,sql,xml,html,css,scss,swift,dart,md}"
    ),
    excludeGlob: config.get<string>(
      "excludeGlob",
      "**/{node_modules,dist,build,.git,.next,coverage,.venv,venv,.gradle,target,out}/**"
    ),
    maxFiles: config.get<number>("maxFiles", 120),
    maxCharsPerFile: config.get<number>("maxCharsPerFile", 40000)
  };
}

function createWorkspaceExportIndex(mode: "dev" | "edu", matchedFiles: number): string[] {
  return [
    "# Narrate Workspace Export",
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${mode}`,
    `Matched files: ${matchedFiles}`,
    ""
  ];
}

async function exportWorkspaceFiles(
  files: vscode.Uri[],
  maxCharsPerFile: number,
  mode: "dev" | "edu",
  runDir: string,
  narrationEngine: NarrationEngine,
  indexLines: string[]
): Promise<WorkspaceExportStats> {
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
        reportWorkspaceExportProgress(progress, idx, files.length, file.fsPath);
        const outcome = await exportSingleWorkspaceFile(
          file,
          maxCharsPerFile,
          mode,
          runDir,
          narrationEngine,
          indexLines
        );
        if (outcome === "exported") {
          exportedCount += 1;
        } else {
          skippedCount += 1;
        }
      }
    }
  );

  return { exportedCount, skippedCount };
}

function reportWorkspaceExportProgress(
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  index: number,
  total: number,
  filePath: string
): void {
  progress.report({
    message: `${index + 1}/${total} ${path.basename(filePath)}`,
    increment: Math.max(1, Math.floor(100 / total))
  });
}

async function exportSingleWorkspaceFile(
  file: vscode.Uri,
  maxCharsPerFile: number,
  mode: "dev" | "edu",
  runDir: string,
  narrationEngine: NarrationEngine,
  indexLines: string[]
): Promise<"exported" | "skipped"> {
  try {
    const doc = await vscode.workspace.openTextDocument(file);
    if (doc.getText().length > maxCharsPerFile) {
      indexLines.push(`- SKIPPED (too large): \`${toWorkspaceRelativePath(file.fsPath)}\``);
      return "skipped";
    }

    const narrations = await narrationEngine.narrateDocument(doc, mode);
    const rendered = renderNarrationDocument(doc, mode, narrations, "section", {
      snippetMode: "withSource",
      eduDetailLevel: "standard"
    });
    const targetPath = buildWorkspaceExportTargetPath(runDir, file.fsPath, mode);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, rendered, "utf8");

    const relativePath = toWorkspaceRelativePath(file.fsPath);
    indexLines.push(`- EXPORTED: \`${relativePath}\` -> \`${path.relative(runDir, targetPath)}\``);
    return "exported";
  } catch {
    indexLines.push(`- SKIPPED (read/export error): \`${toWorkspaceRelativePath(file.fsPath)}\``);
    return "skipped";
  }
}

function buildWorkspaceExportTargetPath(
  runDir: string,
  sourcePath: string,
  mode: "dev" | "edu"
): string {
  const relativePath = toWorkspaceRelativePath(sourcePath);
  const normalizedRelative = relativePath.split(path.sep).map(sanitizePathSegment).join(path.sep);
  return path.join(runDir, `${normalizedRelative}.narrate.${mode}.md`);
}

async function openWorkspaceExportIndex(
  runDir: string,
  indexLines: string[],
  stats: WorkspaceExportStats
): Promise<void> {
  indexLines.unshift(`Summary: exported=${stats.exportedCount}, skipped=${stats.skippedCount}`, "");
  const indexPath = path.join(runDir, "index.md");
  await fs.writeFile(indexPath, indexLines.join("\n"), "utf8");
  const indexDoc = await vscode.workspace.openTextDocument(indexPath);
  await vscode.window.showTextDocument(indexDoc, { preview: false });

  vscode.window.showInformationMessage(
    `Narrate: workspace export complete. exported=${stats.exportedCount}, skipped=${stats.skippedCount}`
  );
}
