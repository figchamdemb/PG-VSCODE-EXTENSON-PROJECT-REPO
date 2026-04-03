import { execFile } from "child_process";
import * as vscode from "vscode";
import {
  CommitFileChange,
  CommitQualityGateOutcome,
  parseCommitFileChanges,
  promptForCommitMessageWithQualityGate
} from "./pgPushCommitQuality";
import { DeadCodeGateOutcome, runDeadCodePrePushGate } from "./pgPushDeadCodeGate";
import {
  EnforcementGateOutcome,
  runEnforcementPrePushGate,
  showEnforcementBlockedActions,
  writeGateReport
} from "./pgPushEnforcementGate";
import {
  TrustGateOutcome,
  runTrustScorePrePushGate,
  showTrustBlockedActions,
  writeTrustGateReport
} from "./pgPushTrustGate";
import { showPgRootGuidance } from "./pgRootGuidance";
import { StartupContextEnforcer } from "../startup/startupContextEnforcer";
import { TrustScoreService } from "../trust/trustScoreService";
import { RepoRootResolution, resolveRepoRoot } from "../utils/repoRootResolver";
import { ensureDevProfileReady } from "./devProfilePreflight";

const GIT_BUFFER_BYTES = 1024 * 1024 * 4;

type GitResult = {
  stdout: string;
  stderr: string;
};

type PgPushFlowContext = {
  repo: RepoRootResolution;
  workspace: vscode.WorkspaceFolder;
  hasChanges: boolean;
  commitMessage?: string;
  commitQualityOutcome?: CommitQualityGateOutcome;
};

export function registerPgPushCommands(
  trustScoreService: TrustScoreService,
  startupContextEnforcer: StartupContextEnforcer
): vscode.Disposable {
  const runner = async (): Promise<void> => {
    try {
      await runPgPushFlow(trustScoreService, startupContextEnforcer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: PG push failed. ${message}`);
    }
  };

  return vscode.Disposable.from(
    vscode.commands.registerCommand("narrate.pgPush", runner),
    vscode.commands.registerCommand("narrate.pgGit", runner)
  );
}

async function validatePgPushPrereqs(): Promise<{ workspace: vscode.WorkspaceFolder; repo: RepoRootResolution } | null> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showWarningMessage("Narrate: open a workspace folder before PG push.");
    return null;
  }
  const repo = resolveRepoRoot({ seedPath: workspace.uri.fsPath });
  if (!repo) {
    await showPgRootGuidance("PG push");
    return null;
  }
  return { workspace, repo };
}

async function runPgPushFlow(
  trustScoreService: TrustScoreService,
  startupContextEnforcer: StartupContextEnforcer
): Promise<void> {
  const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!(await startupContextEnforcer.ensureWorkspaceReadyForAction("running PG push", workspaceUri))) {
    return;
  }
  const prereqs = await validatePgPushPrereqs();
  if (!prereqs) return;
  const { workspace, repo } = prereqs;
  const canContinue = await ensureDevProfileReady(repo, "PG push");
  if (!canContinue) return;

  await ensureGitWorkspace(repo.repoRoot);
  const initialChanges = await collectCommitFileChanges(repo.repoRoot);
  const hasChanges = initialChanges.length > 0;
  const commitResult = hasChanges ? await promptForCommitMessageWithQualityGate(initialChanges) : undefined;
  if (hasChanges && !commitResult) return;

  const confirmed = await vscode.window.showWarningMessage(
    `Run git add -A, git commit, and git push in:\n${repo.repoRoot}`,
    { modal: true }, "Run PG Push"
  );
  if (confirmed !== "Run PG Push") return;

  const ctx: PgPushFlowContext = { repo, workspace, hasChanges, commitMessage: commitResult?.message, commitQualityOutcome: commitResult };
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Narrate: Running PG push", cancellable: false },
    async (progress) => runPgPushProgressFlow(progress, ctx, trustScoreService)
  );
}

async function collectCommitFileChanges(repoRoot: string): Promise<CommitFileChange[]> {
  const status = await runGit(["status", "--porcelain"], repoRoot);
  return parseCommitFileChanges(status.stdout);
}

async function runPgPushProgressFlow(
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  flowContext: PgPushFlowContext,
  trustScoreService: TrustScoreService
): Promise<void> {
  progress.report({ message: "Running PG enforcement preflight..." });
  const enforcementOutcome = await runEnforcementPrePushGate(flowContext.repo);
  writeGateReport(enforcementOutcome, flowContext.repo);
  if (!enforcementOutcome.allowPush) {
    await showEnforcementBlockedActions(enforcementOutcome, flowContext.repo);
    throw new Error(enforcementOutcome.message);
  }

  progress.report({ message: "Running Trust Score pre-push gate..." });
  const trustGateOutcome = await runTrustScorePrePushGate(trustScoreService);
  writeTrustGateReport(trustGateOutcome, flowContext.repo);
  if (!trustGateOutcome.allowPush) {
    await showTrustBlockedActions(trustGateOutcome, trustScoreService);
    throw new Error(trustGateOutcome.message);
  }

  progress.report({ message: "Running dead-code pre-push gate..." });
  const deadCodeGateOutcome = await runDeadCodePrePushGate(flowContext.workspace);
  if (!deadCodeGateOutcome.allowPush) {
    throw new Error(deadCodeGateOutcome.message);
  }

  const committed = await stageAndCommitChangesIfNeeded(progress, flowContext);

  progress.report({ message: "Pushing to remote..." });
  await runGit(["push"], flowContext.repo.repoRoot);
  const branch = (
    await runGit(["rev-parse", "--abbrev-ref", "HEAD"], flowContext.repo.repoRoot)
  ).stdout.trim();

  showPgPushSuccessMessage(
    flowContext, committed, branch, enforcementOutcome, trustGateOutcome, deadCodeGateOutcome
  );
}

function buildCommitQualityNote(outcome?: CommitQualityGateOutcome): string {
  if (!outcome || outcome.mode === "off") {
    return "";
  }
  if (outcome.qualityPassed) {
    return " Commit quality: passed.";
  }
  if (outcome.overridden) {
    return ` Commit quality: overridden (${outcome.mode}).`;
  }
  return ` Commit quality: ${outcome.mode}.`;
}

async function stageAndCommitChangesIfNeeded(
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  flowContext: PgPushFlowContext
): Promise<boolean> {
  if (!flowContext.hasChanges) {
    return false;
  }

  progress.report({ message: "Staging files (git add -A)..." });
  await runGit(["add", "-A"], flowContext.repo.repoRoot);

  progress.report({ message: "Creating commit..." });
  try {
    await runGit(
      ["commit", "-m", (flowContext.commitMessage ?? "").trim()],
      flowContext.repo.repoRoot
    );
    return true;
  } catch (error) {
    if (!getErrorText(error).toLowerCase().includes("nothing to commit")) {
      throw error;
    }
    return false;
  }
}

function showPgPushSuccessMessage(
  flowContext: PgPushFlowContext,
  committed: boolean,
  branch: string,
  enforcementOutcome: EnforcementGateOutcome,
  trustGateOutcome: TrustGateOutcome,
  deadCodeGateOutcome: DeadCodeGateOutcome
): void {
  const commitState = flowContext.hasChanges
    ? committed
      ? "Committed and pushed."
      : "Pushed without a new commit."
    : "No local changes to commit.";
  const enforcementNote = enforcementOutcome.status === "skipped" ? ""
    : ` Enforcement: ${enforcementOutcome.status} [${enforcementOutcome.profile}].`;
  const trustStateNote =
    trustGateOutcome.mode === "off" ? ""
      : trustGateOutcome.score !== null
        ? ` Trust: ${trustGateOutcome.status} (${trustGateOutcome.score}/100).`
        : ` Trust gate: ${trustGateOutcome.mode}.`;
  const deadCodeStateNote =
    deadCodeGateOutcome.mode === "off"
      ? ""
      : ` Dead-code gate: ${deadCodeGateOutcome.mode}.`;
  const commitQualityNote = buildCommitQualityNote(flowContext.commitQualityOutcome);

  vscode.window.showInformationMessage(
    `Narrate: PG push completed on branch '${branch || "current"}'. ` +
      `${commitState}${enforcementNote}${trustStateNote}${deadCodeStateNote}${commitQualityNote}`
  );
}

async function ensureGitWorkspace(workspaceRoot: string): Promise<void> {
  try {
    const inside = await runGit(["rev-parse", "--is-inside-work-tree"], workspaceRoot);
    if (inside.stdout.trim() !== "true") {
      throw new Error("Workspace is not a git repository.");
    }
  } catch (error) {
    throw new Error(`Workspace is not a git repository. ${getErrorText(error)}`);
  }
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
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    );
  });
}

function getErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
