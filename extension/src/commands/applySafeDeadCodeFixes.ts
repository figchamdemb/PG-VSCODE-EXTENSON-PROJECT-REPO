import * as path from "path";
import * as vscode from "vscode";
import {
  DeadCodeScanResult,
  buildDeadCodeReportMarkdown,
  getDeadCodeScanSettings,
  runDeadCodeScanForWorkspace
} from "./runDeadCodeScan";
import { Logger } from "../utils/logger";

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
  if (!workspace) {
    void vscode.window.showWarningMessage(
      "Narrate: open a workspace folder before applying dead-code fixes."
    );
    return;
  }

  const before = await scanHighConfidenceDeadCode(workspace);
  const targetFiles = collectTargetFiles(before);
  if (targetFiles.length === 0) {
    void vscode.window.showInformationMessage(
      "Narrate: no high-confidence dead-code findings to auto-fix."
    );
    return;
  }

  const confirmed = await confirmSafeFixRun(targetFiles.length);
  if (!confirmed) {
    return;
  }

  const stats = await applyOrganizeImportsForFiles(workspace, targetFiles);
  const after = await rescanDeadCode(workspace);

  await openSafeFixReport(workspace.uri.fsPath, before, after, stats);
  const reducedBy = before.highConfidenceUnused.length - after.highConfidenceUnused.length;
  logger.info(
    `Safe dead-code fix run completed: target=${stats.targetFiles}, changed=${stats.changedFiles.length}, highConfidenceDelta=${reducedBy}`
  );
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
  workspace: vscode.WorkspaceFolder,
  relativeFiles: string[]
): Promise<FixRunStats> {
  const changedFiles: string[] = [];
  const noChangeFiles: string[] = [];
  const failedFiles: Array<{ file: string; reason: string }> = [];

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Narrate: Applying safe dead-code fixes",
      cancellable: false
    },
    async (progress) => {
      for (let index = 0; index < relativeFiles.length; index += 1) {
        const relativeFile = relativeFiles[index];
        progress.report({
          message: `${index + 1}/${relativeFiles.length} ${relativeFile}`,
          increment:
            relativeFiles.length === 0
              ? 0
              : ((index + 1) / relativeFiles.length) * 100
        });

        try {
          const fileUri = vscode.Uri.file(path.join(workspace.uri.fsPath, relativeFile));
          const changed = await applyOrganizeImportsForFile(fileUri);
          if (changed) {
            changedFiles.push(relativeFile);
          } else {
            noChangeFiles.push(relativeFile);
          }
        } catch (error) {
          failedFiles.push({
            file: relativeFile,
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  );

  return {
    targetFiles: relativeFiles.length,
    changedFiles,
    noChangeFiles,
    failedFiles
  };
}

async function applyOrganizeImportsForFile(fileUri: vscode.Uri): Promise<boolean> {
  const document = await vscode.workspace.openTextDocument(fileUri);
  const versionBefore = document.version;
  const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
  const actions = await vscode.commands.executeCommand<Array<vscode.CodeAction | vscode.Command>>(
    "vscode.executeCodeActionProvider",
    fileUri,
    fullRange,
    vscode.CodeActionKind.SourceOrganizeImports.value
  );

  if (!actions || actions.length === 0) {
    return false;
  }

  for (const action of actions) {
    if (isCodeAction(action)) {
      if (action.edit) {
        await vscode.workspace.applyEdit(action.edit);
      }
      if (action.command) {
        await vscode.commands.executeCommand(
          action.command.command,
          ...(action.command.arguments ?? [])
        );
      }
      continue;
    }
    await vscode.commands.executeCommand(
      action.command,
      ...(action.arguments ?? [])
    );
  }

  const reopened = await vscode.workspace.openTextDocument(fileUri);
  const changed = reopened.version !== versionBefore || reopened.isDirty;
  if (reopened.isDirty) {
    await reopened.save();
  }
  return changed;
}

function isCodeAction(
  value: vscode.CodeAction | vscode.Command
): value is vscode.CodeAction {
  return "title" in value && ("kind" in value || "edit" in value || "command" in value);
}

function buildSafeFixReportMarkdown(
  workspaceRoot: string,
  before: DeadCodeScanResult,
  after: DeadCodeScanResult,
  stats: FixRunStats
): string {
  const lines: string[] = [];
  lines.push("# Narrate Safe Dead Code Fix Run");
  lines.push("");
  lines.push(`UTC: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Workspace: ${workspaceRoot}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Target files: ${stats.targetFiles}`);
  lines.push(`- Changed files: ${stats.changedFiles.length}`);
  lines.push(`- No-change files: ${stats.noChangeFiles.length}`);
  lines.push(`- Failed files: ${stats.failedFiles.length}`);
  lines.push(
    `- High-confidence findings: before ${before.highConfidenceUnused.length} -> after ${after.highConfidenceUnused.length}`
  );
  lines.push(
    `- Medium-confidence orphans: before ${before.mediumConfidenceOrphans.length} -> after ${after.mediumConfidenceOrphans.length}`
  );
  lines.push(
    `- Low-confidence orphans: before ${before.lowConfidenceOrphans.length} -> after ${after.lowConfidenceOrphans.length}`
  );

  lines.push("");
  lines.push("## Changed Files");
  lines.push("");
  if (stats.changedFiles.length === 0) {
    lines.push("- none");
  } else {
    for (const file of stats.changedFiles) {
      lines.push(`- \`${file}\``);
    }
  }

  lines.push("");
  lines.push("## Failed Files");
  lines.push("");
  if (stats.failedFiles.length === 0) {
    lines.push("- none");
  } else {
    for (const failure of stats.failedFiles) {
      lines.push(`- \`${failure.file}\` - ${failure.reason}`);
    }
  }

  lines.push("");
  lines.push("## Post-Run Dead Code Report");
  lines.push("");
  lines.push(
    buildDeadCodeReportMarkdown(workspaceRoot, after)
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n")
  );

  return lines.join("\n");
}
