import { execFile } from "child_process";
import * as vscode from "vscode";
import {
  buildDeadCodeReportMarkdown,
  getDeadCodeScanSettings,
  runDeadCodeScanForWorkspace
} from "./runDeadCodeScan";
import { Logger } from "../utils/logger";
import { resolveRepoRoot } from "../utils/repoRootResolver";

const GIT_BUFFER_BYTES = 1024 * 1024 * 4;

type GitResult = {
  stdout: string;
  stderr: string;
};

export function registerCreateDeadCodeCleanupBranchCommand(
  logger: Logger
): vscode.Disposable {
  return vscode.commands.registerCommand(
    "narrate.createDeadCodeCleanupBranch",
    async () => {
      await runCreateDeadCodeCleanupBranch(logger);
    }
  );
}

async function runCreateDeadCodeCleanupBranch(logger: Logger): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    void vscode.window.showWarningMessage(
      "Narrate: open a workspace folder before creating cleanup branch."
    );
    return;
  }

  const repo = resolveRepoRoot({ seedPath: workspace.uri.fsPath });
  if (!repo) {
    void vscode.window.showWarningMessage(
      "Narrate: unable to resolve repository root for cleanup branch command."
    );
    return;
  }

  await ensureGitWorkspace(repo.repoRoot);
  const proceed = await confirmDirtyWorkspace(repo.repoRoot);
  if (!proceed) {
    return;
  }

  const deadCodeResult = await runDeadCodePreparationScan(workspace);
  const candidateCount = countDeadCodeCandidates(deadCodeResult);
  const canContinue = await confirmBranchWhenNoCandidates(candidateCount);
  if (!canContinue) {
    return;
  }

  const branchName = await promptBranchName();
  if (!branchName) {
    return;
  }

  const switched = await createOrSwitchBranch(repo.repoRoot, branchName);
  if (!switched) {
    return;
  }

  await openDeadCodeReport(workspace, deadCodeResult);
  logger.info(
    `Dead-code cleanup branch ready: ${branchName} (candidates=${candidateCount})`
  );
  void vscode.window.showInformationMessage(
    `Narrate: ready on branch '${branchName}'. Dead-code candidates: ${candidateCount}.`
  );
}

async function runDeadCodePreparationScan(
  workspace: vscode.WorkspaceFolder
): Promise<Awaited<ReturnType<typeof runDeadCodeScanForWorkspace>>> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Narrate: Preparing dead-code cleanup branch",
      cancellable: false
    },
    async (progress) => {
      progress.report({ message: "Running dead-code scan..." });
      return runDeadCodeScanForWorkspace(workspace, getDeadCodeScanSettings(), progress);
    }
  );
}

function countDeadCodeCandidates(
  deadCodeResult: Awaited<ReturnType<typeof runDeadCodeScanForWorkspace>>
): number {
  return (
    deadCodeResult.highConfidenceUnused.length +
    deadCodeResult.mediumConfidenceOrphans.length +
    deadCodeResult.lowConfidenceOrphans.length
  );
}

async function confirmBranchWhenNoCandidates(candidateCount: number): Promise<boolean> {
  if (candidateCount > 0) {
    return true;
  }

  const createAnyway = await vscode.window.showInformationMessage(
    "Narrate: dead-code scan found no candidates. Create cleanup branch anyway?",
    { modal: true },
    "Create Branch"
  );
  return createAnyway === "Create Branch";
}

async function ensureGitWorkspace(repoRoot: string): Promise<void> {
  const inside = await runGit(["rev-parse", "--is-inside-work-tree"], repoRoot);
  if (inside.stdout.trim() !== "true") {
    throw new Error("Workspace is not a git repository.");
  }
}

async function confirmDirtyWorkspace(repoRoot: string): Promise<boolean> {
  const status = await runGit(["status", "--porcelain"], repoRoot);
  if (!status.stdout.trim()) {
    return true;
  }
  const picked = await vscode.window.showWarningMessage(
    "Narrate: workspace has uncommitted changes. Creating/switching branch will carry these changes. Continue?",
    { modal: true },
    "Continue"
  );
  return picked === "Continue";
}

async function promptBranchName(): Promise<string | undefined> {
  const defaultName = buildDefaultBranchName();
  const value = await vscode.window.showInputBox({
    title: "Narrate Dead-Code Cleanup Branch",
    prompt: "Branch name for dead-code cleanup work",
    value: defaultName,
    ignoreFocusOut: true,
    validateInput: (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        return "Branch name is required.";
      }
      if (!/^[A-Za-z0-9._/-]+$/u.test(trimmed)) {
        return "Use letters, numbers, ., _, /, or - only.";
      }
      return undefined;
    }
  });
  if (!value) {
    return undefined;
  }
  return value.trim();
}

function buildDefaultBranchName(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const min = String(now.getUTCMinutes()).padStart(2, "0");
  return `dead-code-cleanup-${yyyy}${mm}${dd}-${hh}${min}`;
}

async function createOrSwitchBranch(
  repoRoot: string,
  branchName: string
): Promise<boolean> {
  const existing = await runGit(["branch", "--list", branchName], repoRoot);
  if (existing.stdout.trim()) {
    const picked = await vscode.window.showWarningMessage(
      `Narrate: branch '${branchName}' already exists.`,
      { modal: true },
      "Switch to Existing Branch"
    );
    if (picked !== "Switch to Existing Branch") {
      return false;
    }
    await runGit(["checkout", branchName], repoRoot);
    return true;
  }

  await runGit(["checkout", "-b", branchName], repoRoot);
  return true;
}

async function openDeadCodeReport(
  workspace: vscode.WorkspaceFolder,
  result: Awaited<ReturnType<typeof runDeadCodeScanForWorkspace>>
): Promise<void> {
  const report = buildDeadCodeReportMarkdown(workspace.uri.fsPath, result);
  const reportDocument = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: report
  });
  await vscode.window.showTextDocument(reportDocument, { preview: false });
}

async function runGit(args: string[], cwd: string): Promise<GitResult> {
  return new Promise<GitResult>((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd, windowsHide: true, maxBuffer: GIT_BUFFER_BYTES },
      (error, stdout, stderr) => {
        if (error) {
          const details = [stderr, stdout, error.message]
            .map((item) => item?.trim())
            .filter(Boolean)
            .join(" | ");
          reject(new Error(details || `git ${args.join(" ")} failed`));
          return;
        }
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      }
    );
  });
}
