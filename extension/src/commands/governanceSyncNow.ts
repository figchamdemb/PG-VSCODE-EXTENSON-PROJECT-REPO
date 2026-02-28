import * as vscode from "vscode";
import {
  GovernanceDecisionSyncWorker,
  GovernanceSyncRunResult
} from "../governance/decisionSyncWorker";

export function registerGovernanceSyncNowCommand(
  worker: GovernanceDecisionSyncWorker
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.governanceSyncNow", async () => {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Narrate: Running governance sync",
        cancellable: false
      },
      async () => {
        const result = await worker.runOnce("manual", true);
        reportResult(result);
      }
    );
  });
}

function reportResult(result: GovernanceSyncRunResult): void {
  if (result.ok && !result.skipped) {
    void vscode.window.showInformationMessage(`Narrate: ${result.message}`);
    return;
  }
  if (result.ok && result.skipped) {
    void vscode.window.showInformationMessage(`Narrate: ${result.message}`);
    return;
  }
  void vscode.window.showWarningMessage(`Narrate: ${result.message}`);
}
