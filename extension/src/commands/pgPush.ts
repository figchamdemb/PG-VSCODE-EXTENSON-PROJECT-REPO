import { execFile } from "child_process";
import * as fs from "fs";
import * as vscode from "vscode";
import {
  CommitFileChange,
  parseCommitFileChanges,
  promptForCommitMessageWithQualityGate
} from "./pgPushCommitQuality";
import { DeadCodeGateOutcome, runDeadCodePrePushGate } from "./pgPushDeadCodeGate";
import { runPowerShellCommand } from "../governance/powerShellRunner";
import { TrustReport, TrustScoreService } from "../trust/trustScoreService";
import { RepoRootResolution, resolveRepoRoot } from "../utils/repoRootResolver";

const GIT_BUFFER_BYTES = 1024 * 1024 * 4;

type GitResult = {
  stdout: string;
  stderr: string;
};

type TrustPgPushGateMode = "off" | "relaxed" | "strict";

type TrustGateOutcome = {
  allowPush: boolean;
  mode: TrustPgPushGateMode;
  message: string;
  report?: TrustReport;
};

type PgPushFlowContext = {
  repo: RepoRootResolution;
  workspace: vscode.WorkspaceFolder;
  hasChanges: boolean;
  commitMessage?: string;
};

export function registerPgPushCommands(
  trustScoreService: TrustScoreService
): vscode.Disposable {
  const runner = async (): Promise<void> => {
    try {
      await runPgPushFlow(trustScoreService);
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

async function runPgPushFlow(trustScoreService: TrustScoreService): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showWarningMessage("Narrate: open a workspace folder before PG push.");
    return;
  }

  const repo = resolveRepoRoot({ seedPath: workspace.uri.fsPath });
  if (!repo) {
    vscode.window.showWarningMessage(
      "Narrate: unable to resolve repository root (pg.ps1) for PG push."
    );
    return;
  }

  await ensureGitWorkspace(repo.repoRoot);
  const initialChanges = await collectCommitFileChanges(repo.repoRoot);
  const hasChanges = initialChanges.length > 0;
  const commitMessage = hasChanges
    ? await promptForCommitMessageWithQualityGate(initialChanges)
    : undefined;
  if (hasChanges && !commitMessage) {
    return;
  }

  const confirmed = await vscode.window.showWarningMessage(
    `Run git add -A, git commit, and git push in:\n${repo.repoRoot}`,
    { modal: true },
    "Run PG Push"
  );
  if (confirmed !== "Run PG Push") {
    return;
  }

  const flowContext: PgPushFlowContext = {
    repo,
    workspace,
    hasChanges,
    commitMessage
  };

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Narrate: Running PG push",
      cancellable: false
    },
    async (progress) => runPgPushProgressFlow(progress, flowContext, trustScoreService)
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
  await runPrePushEnforcement(flowContext.repo);

  progress.report({ message: "Running Trust Score pre-push gate..." });
  const trustGateOutcome = await runTrustScorePrePushGate(trustScoreService);
  if (!trustGateOutcome.allowPush) {
    await maybeShowDiagnosticsRecoveryHint(trustGateOutcome, trustScoreService);
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

  showPgPushSuccessMessage(flowContext, committed, branch, trustGateOutcome, deadCodeGateOutcome);
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
  trustGateOutcome: TrustGateOutcome,
  deadCodeGateOutcome: DeadCodeGateOutcome
): void {
  const commitState = flowContext.hasChanges
    ? committed
      ? "Committed and pushed."
      : "Pushed without a new commit."
    : "No local changes to commit.";
  const trustStateNote =
    trustGateOutcome.mode === "off" ? "" : ` Trust gate: ${trustGateOutcome.mode}.`;
  const deadCodeStateNote =
    deadCodeGateOutcome.mode === "off"
      ? ""
      : ` Dead-code gate: ${deadCodeGateOutcome.mode}.`;

  vscode.window.showInformationMessage(
    `Narrate: PG push completed on branch '${branch || "current"}'. ` +
      `${commitState}${trustStateNote}${deadCodeStateNote}`
  );
}

async function runTrustScorePrePushGate(
  trustScoreService: TrustScoreService
): Promise<TrustGateOutcome> {
  const mode = getTrustGateMode();
  if (mode === "off") {
    return {
      allowPush: true,
      mode,
      message: "Trust gate mode is off.",
      report: trustScoreService.getLatestReport()
    };
  }

  const gateWithoutScore = await maybeHandleDisabledTrustScore(mode, trustScoreService);
  if (gateWithoutScore) {
    return gateWithoutScore;
  }

  await trustScoreService.refreshNow();
  const report = trustScoreService.getLatestReport();
  if (!report) {
    return handleMissingTrustScoreReport(mode);
  }

  return evaluateTrustGateFromReport(mode, report);
}

function getTrustGateMode(): TrustPgPushGateMode {
  return vscode.workspace
    .getConfiguration("narrate")
    .get<TrustPgPushGateMode>("trustScore.pgPushGateMode", "off");
}

async function maybeHandleDisabledTrustScore(
  mode: TrustPgPushGateMode,
  trustScoreService: TrustScoreService
): Promise<TrustGateOutcome | undefined> {
  if (trustScoreService.isTrustScoreEnabled()) {
    return undefined;
  }
  if (mode === "strict") {
    return {
      allowPush: false,
      mode,
      message:
        "Trust Score gate is strict but Trust Score is disabled. Enable Trust Score or change gate mode.",
      report: trustScoreService.getLatestReport()
    };
  }
  const continueAnyway = await askRelaxedGateContinue(
    "Trust Score is disabled. Continue push in relaxed mode?"
  );
  return {
    allowPush: continueAnyway,
    mode,
    message: continueAnyway ? "Proceeding in relaxed mode." : "Push canceled.",
    report: trustScoreService.getLatestReport()
  };
}

async function handleMissingTrustScoreReport(
  mode: TrustPgPushGateMode
): Promise<TrustGateOutcome> {
  if (mode === "strict") {
    return {
      allowPush: false,
      mode,
      message:
        "Strict Trust Score gate could not evaluate an active source file. Open a source file, run 'Narrate: Refresh Trust Score', then retry.",
      report: undefined
    };
  }
  const continueAnyway = await askRelaxedGateContinue(
    "Trust Score report is not available. Continue push in relaxed mode?"
  );
  return {
    allowPush: continueAnyway,
    mode,
    message: continueAnyway ? "Proceeding in relaxed mode." : "Push canceled.",
    report: undefined
  };
}

async function evaluateTrustGateFromReport(
  mode: TrustPgPushGateMode,
  report: TrustReport
): Promise<TrustGateOutcome> {
  const isBlocked = report.blockers > 0 || report.status === "red";
  if (!isBlocked) {
    return {
      allowPush: true,
      mode,
      message: `Trust Score ${report.score}/100 (${report.grade}) passed gate.`,
      report
    };
  }

  const gateMessage =
    `Trust Score is ${report.score}/100 (${report.grade}) with ${report.blockers} blocker(s)` +
    ` on ${report.file}.`;
  if (mode === "strict") {
    return {
      allowPush: false,
      mode,
      message: `${gateMessage} Strict mode blocks push until blockers are fixed.`,
      report
    };
  }

  const continueAnyway = await askRelaxedGateContinue(
    `${gateMessage} Continue push in relaxed mode?`
  );
  return {
    allowPush: continueAnyway,
    mode,
    message: continueAnyway ? "Proceeding in relaxed mode." : "Push canceled.",
    report
  };
}

async function askRelaxedGateContinue(message: string): Promise<boolean> {
  const picked = await vscode.window.showWarningMessage(
    `Narrate Trust Gate: ${message}`,
    { modal: true },
    "Continue Push"
  );
  return picked === "Continue Push";
}

async function maybeShowDiagnosticsRecoveryHint(
  outcome: TrustGateOutcome,
  trustScoreService: TrustScoreService
): Promise<void> {
  if (!outcome.report) {
    return;
  }
  const showHint = vscode.workspace
    .getConfiguration("narrate")
    .get<boolean>("trustScore.showDiagnosticsRecoveryHint", true);
  if (!showHint) {
    return;
  }
  const hasTypeScriptErrors = outcome.report.findings.some(
    (finding) => finding.ruleId === "TRUST-TS-001"
  );
  if (!hasTypeScriptErrors) {
    return;
  }

  const action = await vscode.window.showWarningMessage(
    "Narrate Trust Gate: TypeScript diagnostics are still reported. If compile passed, restart TS server and refresh Trust Score before retrying push.",
    "Restart TS + Refresh Trust",
    "Show Trust Report"
  );
  if (action === "Restart TS + Refresh Trust") {
    await vscode.commands.executeCommand("narrate.restartTypeScriptAndRefreshTrust");
    return;
  }
  if (action === "Show Trust Report") {
    await trustScoreService.showLatestReport();
  }
}

async function runPrePushEnforcement(repo: RepoRootResolution): Promise<void> {
  const config = vscode.workspace.getConfiguration("narrate");
  if (!config.get<boolean>("enforcement.prePush.enabled", true)) {
    return;
  }
  if (!fs.existsSync(repo.pgScriptPath)) {
    throw new Error(`Missing pg command script at ${repo.pgScriptPath}`);
  }

  const args = buildPrePushEnforcementArgs(repo, config);
  try {
    await runPowerShellCommand(args, repo.repoRoot);
  } catch (error) {
    throw mapPrePushEnforcementError(error);
  }
}

function buildPrePushEnforcementArgs(
  repo: RepoRootResolution,
  config: vscode.WorkspaceConfiguration
): string[] {
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    repo.pgScriptPath,
    "enforce-trigger",
    "-Phase",
    "pre-push"
  ];
  if (config.get<boolean>("enforcement.prePush.warnOnly", false)) {
    args.push("-WarnOnly");
  }

  const apiBase = config.get<string>("licensing.apiBaseUrl", "").trim();
  if (apiBase) {
    args.push("-ApiBase", apiBase);
  }
  const projectFramework =
    config.get<string>("enforcement.projectFramework", "unknown").trim() || "unknown";
  args.push("-ProjectFramework", projectFramework);
  return args;
}

function mapPrePushEnforcementError(error: unknown): Error {
  const details = getErrorText(error);
  const errorCode = getExitCode(error);
  const lowered = details.toLowerCase();
  if (
    errorCode === 2 ||
    lowered.includes("blocked by policy violations") ||
    lowered.includes("exit code 2")
  ) {
    return new Error(
      "PG policy blockers found. Run `./pg.ps1 prod` in terminal, fix blockers, then push again."
    );
  }
  return new Error(`PG enforcement preflight failed: ${details}`);
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

function getExitCode(error: unknown): number | undefined {
  const raw = (error as { code?: unknown })?.code;
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string" && /^\d+$/u.test(raw)) {
    return Number(raw);
  }
  return undefined;
}
