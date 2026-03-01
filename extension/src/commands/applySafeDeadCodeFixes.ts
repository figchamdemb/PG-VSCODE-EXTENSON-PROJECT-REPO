import * as path from "path";
import * as vscode from "vscode";
import {
  DeadCodeScanResult,
  buildDeadCodeReportMarkdown,
  getDeadCodeScanSettings,
  runDeadCodeScanForWorkspace
} from "./runDeadCodeScan";
import { Logger } from "../utils/logger";

const UNUSED_DIAGNOSTIC_CODES = new Set<number>([6133, 6138, 6192, 6196]);

type FixRunStats = {
  targetFiles: number;
  changedFiles: string[];
  noChangeFiles: string[];
  failedFiles: Array<{ file: string; reason: string }>;
};

export function registerApplySafeDeadCodeFixesCommand(
  logger: Logger
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.applySafeDeadCodeFixes", async () => {
    await runApplySafeDeadCodeFixes(logger);
  });
}

async function runApplySafeDeadCodeFixes(logger: Logger): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) { void vscode.window.showWarningMessage("Narrate: open a workspace folder before applying dead-code fixes."); return; }
  const before = await scanHighConfidenceDeadCode(workspace);
  const targetFiles = collectTargetFiles(before);
  if (targetFiles.length === 0) { void vscode.window.showInformationMessage("Narrate: no high-confidence dead-code findings to auto-fix."); return; }
  if (!(await confirmSafeFixRun(targetFiles.length))) return;
  const stats = await applyOrganizeImportsForFiles(workspace, targetFiles);
  const after = await rescanDeadCode(workspace);
  await openSafeFixReport(workspace.uri.fsPath, before, after, stats);
  const reducedBy = before.highConfidenceUnused.length - after.highConfidenceUnused.length;
  logger.info(`Safe dead-code fix run completed: target=${stats.targetFiles}, changed=${stats.changedFiles.length}, highConfidenceDelta=${reducedBy}`);
  void vscode.window.showInformationMessage(
    `Narrate dead-code fixes: changed ${stats.changedFiles.length}/${stats.targetFiles} files. High-confidence findings delta: ${reducedBy >= 0 ? "-" : "+"}${Math.abs(reducedBy)}.`
  );
}

async function scanHighConfidenceDeadCode(
  workspace: vscode.WorkspaceFolder
): Promise<DeadCodeScanResult> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Narrate: Scanning high-confidence dead code",
      cancellable: false
    },
    async (progress) =>
      runDeadCodeScanForWorkspace(workspace, getDeadCodeScanSettings(), progress)
  );
}

function collectTargetFiles(before: DeadCodeScanResult): string[] {
  return Array.from(new Set(before.highConfidenceUnused.map((item) => item.file))).sort(
    (left, right) => left.localeCompare(right)
  );
}

async function confirmSafeFixRun(targetCount: number): Promise<boolean> {
  const confirm = await vscode.window.showWarningMessage(
    `Apply safe dead-code fixes on ${targetCount} file(s)? This runs organize-imports only (non-destructive import cleanup).`,
    { modal: true },
    "Apply Fixes"
  );
  return confirm === "Apply Fixes";
}

async function rescanDeadCode(workspace: vscode.WorkspaceFolder): Promise<DeadCodeScanResult> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Narrate: Re-running dead-code scan",
      cancellable: false
    },
    async (progress) =>
      runDeadCodeScanForWorkspace(workspace, getDeadCodeScanSettings(), progress)
  );
}

async function openSafeFixReport(
  workspaceRoot: string,
  before: DeadCodeScanResult,
  after: DeadCodeScanResult,
  stats: FixRunStats
): Promise<void> {
  const report = buildSafeFixReportMarkdown(workspaceRoot, before, after, stats);
  const reportDocument = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: report
  });
  await vscode.window.showTextDocument(reportDocument, { preview: false });
}

async function applyOrganizeImportsForFiles(
  workspace: vscode.WorkspaceFolder, relativeFiles: string[]
): Promise<FixRunStats> {
  const stats: FixRunStats = { targetFiles: relativeFiles.length, changedFiles: [], noChangeFiles: [], failedFiles: [] };
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Narrate: Applying safe dead-code fixes", cancellable: false },
    async (progress) => {
      for (let i = 0; i < relativeFiles.length; i++) {
        progress.report({ message: `${i + 1}/${relativeFiles.length} ${relativeFiles[i]}`, increment: relativeFiles.length === 0 ? 0 : ((i + 1) / relativeFiles.length) * 100 });
        await processSingleFile(workspace, relativeFiles[i], stats);
      }
    }
  );
  return stats;
}

async function processSingleFile(
  workspace: vscode.WorkspaceFolder, relFile: string, stats: FixRunStats
): Promise<void> {
  try {
    const fileUri = vscode.Uri.file(path.join(workspace.uri.fsPath, relFile));
    const changed = (await applyOrganizeImportsForFile(fileUri)) || (await applyUnusedVariablePrefixFixes(fileUri));
    (changed ? stats.changedFiles : stats.noChangeFiles).push(relFile);
  } catch (err) {
    stats.failedFiles.push({ file: relFile, reason: err instanceof Error ? err.message : String(err) });
  }
}

async function applyOrganizeImportsForFile(fileUri: vscode.Uri): Promise<boolean> {
  const doc = await vscode.workspace.openTextDocument(fileUri);
  const versionBefore = doc.version;
  const actions = await vscode.commands.executeCommand<Array<vscode.CodeAction | vscode.Command>>(
    "vscode.executeCodeActionProvider", fileUri,
    new vscode.Range(0, 0, doc.lineCount, 0), vscode.CodeActionKind.SourceOrganizeImports.value
  );
  if (!actions || actions.length === 0) return false;
  for (const action of actions) await executeCodeActionOrCommand(action);
  const reopened = await vscode.workspace.openTextDocument(fileUri);
  const changed = reopened.version !== versionBefore || reopened.isDirty;
  if (reopened.isDirty) await reopened.save();
  return changed;
}

async function executeCodeActionOrCommand(action: vscode.CodeAction | vscode.Command): Promise<void> {
  if (isCodeAction(action)) {
    if (action.edit) await vscode.workspace.applyEdit(action.edit);
    if (action.command) await vscode.commands.executeCommand(action.command.command, ...(action.command.arguments ?? []));
  } else {
    await vscode.commands.executeCommand(action.command, ...(action.arguments ?? []));
  }
}

function isCodeAction(
  value: vscode.CodeAction | vscode.Command
): value is vscode.CodeAction {
  return "title" in value && ("kind" in value || "edit" in value || "command" in value);
}

async function applyUnusedVariablePrefixFixes(fileUri: vscode.Uri): Promise<boolean> {
  const diagnostics = vscode.languages.getDiagnostics(fileUri);
  const unusedDiagnostics = diagnostics.filter((d) => isUnusedDiagnosticForPrefix(d));
  let changed = false;
  for (const diagnostic of unusedDiagnostics) {
    if (await tryApplyPrefixFix(fileUri, diagnostic)) changed = true;
  }
  if (changed) await saveIfDirty(fileUri);
  return changed;
}

async function tryApplyPrefixFix(fileUri: vscode.Uri, diagnostic: vscode.Diagnostic): Promise<boolean> {
  const actions = await vscode.commands.executeCommand<Array<vscode.CodeAction | vscode.Command>>(
    "vscode.executeCodeActionProvider", fileUri, diagnostic.range, vscode.CodeActionKind.QuickFix.value
  );
  if (!actions || actions.length === 0) return false;
  const prefixAction = actions.find(
    (a) => isCodeAction(a) && a.title?.toLowerCase().includes("prefix") && a.title?.toLowerCase().includes("underscore")
  );
  if (!prefixAction || !isCodeAction(prefixAction) || !prefixAction.edit) return false;
  await vscode.workspace.applyEdit(prefixAction.edit);
  return true;
}

async function saveIfDirty(fileUri: vscode.Uri): Promise<void> {
  const document = await vscode.workspace.openTextDocument(fileUri);
  if (document.isDirty) await document.save();
}

function isUnusedDiagnosticForPrefix(diagnostic: vscode.Diagnostic): boolean {
  const source = String(diagnostic.source ?? "").toLowerCase();
  if (!source.includes("ts")) {
    return false;
  }
  const code =
    typeof diagnostic.code === "object" ? diagnostic.code.value : diagnostic.code;
  return typeof code === "number" && UNUSED_DIAGNOSTIC_CODES.has(code);
}

function buildSafeFixReportMarkdown(
  workspaceRoot: string, before: DeadCodeScanResult, after: DeadCodeScanResult, stats: FixRunStats
): string {
  return [
    buildFixReportHeader(workspaceRoot, before, after, stats),
    renderFileList("Changed Files", stats.changedFiles.map((f) => `\`${f}\``)),
    renderFileList("Failed Files", stats.failedFiles.map((f) => `\`${f.file}\` - ${f.reason}`)),
    "## Post-Run Dead Code Report", "",
    buildDeadCodeReportMarkdown(workspaceRoot, after).split("\n").map((l) => `> ${l}`).join("\n")
  ].join("\n");
}

function buildFixReportHeader(
  workspaceRoot: string, before: DeadCodeScanResult, after: DeadCodeScanResult, stats: FixRunStats
): string {
  return [
    "# Narrate Safe Dead Code Fix Run", "", `UTC: ${new Date().toISOString()}`, "",
    `Workspace: ${workspaceRoot}`, "", "## Summary", "",
    `- Target files: ${stats.targetFiles}`, `- Changed files: ${stats.changedFiles.length}`,
    `- No-change files: ${stats.noChangeFiles.length}`, `- Failed files: ${stats.failedFiles.length}`,
    `- High-confidence findings: before ${before.highConfidenceUnused.length} -> after ${after.highConfidenceUnused.length}`,
    `- Medium-confidence orphans: before ${before.mediumConfidenceOrphans.length} -> after ${after.mediumConfidenceOrphans.length}`,
    `- Low-confidence orphans: before ${before.lowConfidenceOrphans.length} -> after ${after.lowConfidenceOrphans.length}`, ""
  ].join("\n");
}

function renderFileList(title: string, items: string[]): string {
  const body = items.length === 0 ? "- none" : items.map((i) => `- ${i}`).join("\n");
  return `## ${title}\n\n${body}\n`;
}
