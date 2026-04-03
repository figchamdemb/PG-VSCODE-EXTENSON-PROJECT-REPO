import * as vscode from "vscode";
import { StartupContextResolution } from "./startupContextResolver";
import {
  buildTooltip,
  StartupSessionRecord,
  WorkspaceEnforcementState,
  WorkspaceEnforcementTarget
} from "./startupContextEnforcerSupport";

export function renderStoppedStatus(
  statusBar: vscode.StatusBarItem,
  target: WorkspaceEnforcementTarget,
  state?: WorkspaceEnforcementState
): void {
  statusBar.text = "$(circle-slash) PG Enforce Off";
  statusBar.tooltip = [
    `Mandatory PG enforcement is stopped for ${target.label}.`,
    state?.stopReason ? `Reason: ${state.stopReason}` : undefined,
    `Workspace: ${target.workspacePath}`,
    state?.updatedAtUtc ? `Updated: ${state.updatedAtUtc}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
  statusBar.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.warningBackground"
  );
  statusBar.color = undefined;
  statusBar.command = "narrate.resumeMandatoryEnforcement";
  statusBar.show();
}

export function renderMissingContextStatus(
  statusBar: vscode.StatusBarItem,
  target: WorkspaceEnforcementTarget,
  state?: WorkspaceEnforcementState
): void {
  statusBar.text = "$(error) PG Context Missing";
  statusBar.tooltip = [
    `Mandatory PG enforcement is active for ${target.label}, but startup context could not be resolved.`,
    `Evidence: ${target.evidence}`,
    `Workspace: ${target.workspacePath}`,
    target.agentsPath ? `AGENTS: ${target.agentsPath}` : undefined,
    state?.updatedAtUtc ? `Enforcement active since: ${state.updatedAtUtc}` : undefined,
    "Restore pg.ps1/startup context or stop enforcement explicitly."
  ]
    .filter(Boolean)
    .join("\n");
  statusBar.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.errorBackground"
  );
  statusBar.color = new vscode.ThemeColor("statusBarItem.errorForeground");
  statusBar.command = "narrate.runStartupForCurrentContext";
  statusBar.show();
}

export function renderPendingStatus(
  statusBar: vscode.StatusBarItem,
  resolution: StartupContextResolution,
  record?: StartupSessionRecord
): void {
  statusBar.text = "$(warning) PG Start Needed";
  statusBar.tooltip = buildTooltip(
    resolution,
    "Startup has not been completed for this context today.",
    record
  );
  statusBar.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.warningBackground"
  );
  statusBar.color = undefined;
  statusBar.command = "narrate.runStartupForCurrentContext";
  statusBar.show();
}

export function renderRunningStatus(
  statusBar: vscode.StatusBarItem,
  resolution: StartupContextResolution
): void {
  statusBar.text = "$(sync~spin) PG Start";
  statusBar.tooltip = `Narrate startup is running for ${resolution.label}.`;
  statusBar.backgroundColor = undefined;
  statusBar.color = undefined;
  statusBar.command = "narrate.runStartupForCurrentContext";
  statusBar.show();
}

export function renderPassedStatus(
  statusBar: vscode.StatusBarItem,
  resolution: StartupContextResolution,
  record?: StartupSessionRecord
): void {
  statusBar.text = "$(pass-filled) PG Start";
  statusBar.tooltip = buildTooltip(
    resolution,
    "Startup passed for the current context today.",
    record
  );
  statusBar.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.prominentBackground"
  );
  statusBar.color = undefined;
  statusBar.command = "narrate.runStartupForCurrentContext";
  statusBar.show();
}

export function renderFailedStatus(
  statusBar: vscode.StatusBarItem,
  resolution: StartupContextResolution,
  record?: StartupSessionRecord
): void {
  statusBar.text = "$(error) PG Start Failed";
  statusBar.tooltip = buildTooltip(
    resolution,
    record?.lastError || "Startup failed for this context.",
    record
  );
  statusBar.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.errorBackground"
  );
  statusBar.color = new vscode.ThemeColor("statusBarItem.errorForeground");
  statusBar.command = "narrate.runStartupForCurrentContext";
  statusBar.show();
}