import * as vscode from "vscode";
import {
  buildDeadCodeReportMarkdown,
  DeadCodeScanResult,
  getDeadCodeScanSettings,
  runDeadCodeScanForWorkspace
} from "./runDeadCodeScan";

type DeadCodePgPushGateMode = "off" | "relaxed" | "strict";

export type DeadCodeGateOutcome = {
  allowPush: boolean;
  mode: DeadCodePgPushGateMode;
  message: string;
  result?: DeadCodeScanResult;
};

export async function runDeadCodePrePushGate(
  workspace: vscode.WorkspaceFolder
): Promise<DeadCodeGateOutcome> {
  const config = vscode.workspace.getConfiguration("narrate");
  const mode = config.get<DeadCodePgPushGateMode>(
    "deadCodeScan.pgPushGateMode",
    "off"
  );

  if (mode === "off") {
    return { allowPush: true, mode, message: "Dead-code gate mode is off." };
  }

  let result: DeadCodeScanResult;
  try {
    result = await runDeadCodeScanForWorkspace(workspace, getDeadCodeScanSettings());
  } catch (error) {
    return handleDeadCodeScanFailure(mode, error);
  }

  const highCount = result.highConfidenceUnused.length;
  if (highCount === 0) {
    return {
      allowPush: true,
      mode,
      message: "Dead-code gate passed (no high-confidence findings).",
      result
    };
  }
  return mode === "strict"
    ? runStrictDeadCodeGate(workspace, mode, result)
    : runRelaxedDeadCodeGate(workspace, mode, result);
}

async function handleDeadCodeScanFailure(
  mode: DeadCodePgPushGateMode,
  error: unknown
): Promise<DeadCodeGateOutcome> {
  const details = getErrorText(error);
  if (mode === "strict") {
    return {
      allowPush: false,
      mode,
      message: `Dead-code gate failed to scan workspace. ${details}`
    };
  }
  const picked = await vscode.window.showWarningMessage(
    `Narrate Dead Code Gate: dead-code scan failed (${details}). Continue push in relaxed mode?`,
    { modal: true },
    "Continue Push"
  );
  const continueAnyway = picked === "Continue Push";
  return {
    allowPush: continueAnyway,
    mode,
    message: continueAnyway ? "Proceeding in relaxed mode." : "Push canceled."
  };
}

async function runStrictDeadCodeGate(
  workspace: vscode.WorkspaceFolder,
  mode: DeadCodePgPushGateMode,
  initialResult: DeadCodeScanResult
): Promise<DeadCodeGateOutcome> {
  let currentResult = initialResult;

  while (true) {
    const highCount = currentResult.highConfidenceUnused.length;
    if (highCount === 0) {
      return {
        allowPush: true,
        mode,
        message: "Dead-code gate passed after safe fix + recheck.",
        result: currentResult
      };
    }

    const picked = await vscode.window.showErrorMessage(
      `Narrate Dead Code Gate: ${highCount} high-confidence finding(s) detected. Strict mode blocks push until resolved.`,
      "Apply Safe Fixes + Recheck",
      "Open Dead Code Report",
      "Cancel Push"
    );

    if (picked === "Apply Safe Fixes + Recheck") {
      const refreshed = await applySafeFixesAndRescan(workspace);
      if (refreshed) {
        currentResult = refreshed;
      }
      continue;
    }
    if (picked === "Open Dead Code Report") {
      await openDeadCodeReport(workspace, currentResult);
      continue;
    }
    return {
      allowPush: false,
      mode,
      message:
        `${highCount} high-confidence dead-code finding(s) remain. ` +
        "Strict mode blocks push until resolved.",
      result: currentResult
    };
  }
}

async function runRelaxedDeadCodeGate(
  workspace: vscode.WorkspaceFolder,
  mode: DeadCodePgPushGateMode,
  initialResult: DeadCodeScanResult
): Promise<DeadCodeGateOutcome> {
  let currentResult = initialResult;

  while (true) {
    const highCount = currentResult.highConfidenceUnused.length;
    if (highCount === 0) {
      return {
        allowPush: true,
        mode,
        message: "Dead-code gate passed after safe fix + recheck.",
        result: currentResult
      };
    }

    const picked = await vscode.window.showWarningMessage(
      `Narrate Dead Code Gate: ${highCount} high-confidence finding(s) detected. Continue push in relaxed mode?`,
      { modal: true },
      "Continue Push",
      "Apply Safe Fixes + Recheck",
      "Open Dead Code Report"
    );
    if (picked === "Continue Push") {
      return {
        allowPush: true,
        mode,
        message: "Proceeding in relaxed mode.",
        result: currentResult
      };
    }
    if (picked === "Apply Safe Fixes + Recheck") {
      const refreshed = await applySafeFixesAndRescan(workspace);
      if (refreshed) {
        currentResult = refreshed;
      }
      continue;
    }
    if (picked === "Open Dead Code Report") {
      await openDeadCodeReport(workspace, currentResult);
      continue;
    }
    return {
      allowPush: false,
      mode,
      message: "Push canceled.",
      result: currentResult
    };
  }
}

async function applySafeFixesAndRescan(
  workspace: vscode.WorkspaceFolder
): Promise<DeadCodeScanResult | undefined> {
  try {
    await vscode.commands.executeCommand("narrate.applySafeDeadCodeFixes");
  } catch (error) {
    void vscode.window.showWarningMessage(
      `Narrate Dead Code Gate: safe fix command failed. ${getErrorText(error)}`
    );
    return undefined;
  }

  try {
    return await runDeadCodeScanForWorkspace(workspace, getDeadCodeScanSettings());
  } catch (error) {
    void vscode.window.showWarningMessage(
      `Narrate Dead Code Gate: recheck failed after safe fix. ${getErrorText(error)}`
    );
    return undefined;
  }
}

async function openDeadCodeReport(
  workspace: vscode.WorkspaceFolder,
  result: DeadCodeScanResult
): Promise<void> {
  const report = buildDeadCodeReportMarkdown(workspace.uri.fsPath, result);
  const reportDocument = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: report
  });
  await vscode.window.showTextDocument(reportDocument, { preview: false });
}

function getErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
