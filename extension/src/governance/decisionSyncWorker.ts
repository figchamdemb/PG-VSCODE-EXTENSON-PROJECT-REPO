import * as path from "path";
import * as vscode from "vscode";
import { runPowerShellCommand } from "./powerShellRunner";
import { Logger } from "../utils/logger";
import { resolveRepoRoot } from "../utils/repoRootResolver";

export type GovernanceSyncRunResult = {
  ok: boolean;
  skipped: boolean;
  message: string;
  details: string;
};

export class GovernanceDecisionSyncWorker implements vscode.Disposable {
  private readonly logger: Logger;
  private intervalHandle: ReturnType<typeof setInterval> | undefined;
  private inFlight = false;
  private lastWarningAtMs = 0;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  start(): void {
    this.reconfigure("startup");
  }

  handleConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
    if (!this.affectsGovernanceSettings(event)) {
      return;
    }
    this.reconfigure("config-change");
  }

  dispose(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
  }

  async runOnce(trigger: "manual" | "auto", force = false): Promise<GovernanceSyncRunResult> {
    const inFlightSkip = this.buildInFlightSkipResult();
    if (inFlightSkip) {
      return inFlightSkip;
    }

    const config = vscode.workspace.getConfiguration("narrate");
    const eligibility = this.evaluateRunEligibility(config, force);
    if (eligibility) {
      return eligibility;
    }

    const repo = resolveRepoRoot();
    if (!repo) {
      return this.buildMissingRepoSkipResult();
    }

    const args = this.buildWorkerArgs(config, repo.repoRoot, repo.pgScriptPath);
    return this.executeWorkerRun(trigger, args, repo.repoRoot);
  }

  private buildInFlightSkipResult(): GovernanceSyncRunResult | undefined {
    if (!this.inFlight) {
      return undefined;
    }
    return {
      ok: true,
      skipped: true,
      message: "Governance sync already running.",
      details: ""
    };
  }

  private evaluateRunEligibility(
    config: vscode.WorkspaceConfiguration,
    force: boolean
  ): GovernanceSyncRunResult | undefined {
    const enabled = config.get<boolean>("governance.autoSync.enabled", true);
    if (!force && !enabled) {
      return {
        ok: true,
        skipped: true,
        message: "Governance auto-sync is disabled.",
        details: ""
      };
    }

    if (!this.shouldRequireBackendMode()) {
      return undefined;
    }

    const mode = config.get<string>("licensing.mode", "placeholder").trim().toLowerCase();
    if (mode === "backend") {
      return undefined;
    }
    return {
      ok: true,
      skipped: true,
      message: "Governance sync skipped because licensing mode is not backend.",
      details: mode
    };
  }

  private buildMissingRepoSkipResult(): GovernanceSyncRunResult {
    return {
      ok: true,
      skipped: true,
      message: "Governance sync skipped because repository root (pg.ps1) could not be resolved.",
      details: ""
    };
  }

  private buildWorkerArgs(
    config: vscode.WorkspaceConfiguration,
    workspaceRoot: string,
    pgScript: string
  ): string[] {
    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      pgScript,
      "governance-worker",
      "-Once"
    ];

    const apiBase = config.get<string>("licensing.apiBaseUrl", "").trim();
    if (apiBase) {
      args.push("-ApiBase", apiBase);
    }

    const stateFile = this.resolveStateFile(workspaceRoot);
    if (stateFile) {
      args.push("-StateFile", stateFile);
    }

    if (config.get<boolean>("governance.autoSync.dryRun", false)) {
      args.push("-DryRun");
    }
    return args;
  }

  private async executeWorkerRun(
    trigger: "manual" | "auto",
    args: string[],
    workspaceRoot: string
  ): Promise<GovernanceSyncRunResult> {
    this.inFlight = true;
    try {
      const result = await runPowerShellCommand(args, workspaceRoot);
      return this.buildSuccessRunResult(trigger, result.stdout, result.stderr);
    } catch (error) {
      return this.buildFailedRunResult(trigger, error);
    } finally {
      this.inFlight = false;
    }
  }

  private buildSuccessRunResult(
    trigger: "manual" | "auto",
    stdout: string,
    stderr: string
  ): GovernanceSyncRunResult {
    const output = [stdout, stderr].filter(Boolean).join(" | ").trim();
    const summary = summarizeWorkerOutput(output);
    if (summary.activityDetected || trigger === "manual") {
      this.logger.info(`[governance-sync] ${summary.message}`);
    }
    return {
      ok: true,
      skipped: false,
      message: summary.message,
      details: output
    };
  }

  private buildFailedRunResult(
    trigger: "manual" | "auto",
    error: unknown
  ): GovernanceSyncRunResult {
    const details = error instanceof Error ? error.message : String(error);
    const message = classifyGovernanceSyncError(details);
    this.logger.warn(`[governance-sync] ${message} :: ${details}`);
    if (this.shouldShowNotifications() && this.shouldEmitWarning(trigger)) {
      void vscode.window.showWarningMessage(`Narrate: ${message}`);
    }
    return {
      ok: false,
      skipped: false,
      message,
      details
    };
  }

  private reconfigure(reason: string): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }

    if (!this.isAutoEnabled()) {
      this.logger.info(`[governance-sync] auto-sync disabled (${reason}).`);
      return;
    }

    const intervalMs = this.getIntervalMs();
    this.intervalHandle = setInterval(() => {
      void this.runOnce("auto");
    }, intervalMs);

    this.logger.info(`[governance-sync] auto-sync enabled (${reason}), interval=${intervalMs}ms.`);
    void this.runOnce("auto");
  }

  private isAutoEnabled(): boolean {
    const config = vscode.workspace.getConfiguration("narrate");
    return config.get<boolean>("governance.autoSync.enabled", true);
  }

  private getIntervalMs(): number {
    const config = vscode.workspace.getConfiguration("narrate");
    const seconds = config.get<number>("governance.autoSync.intervalSeconds", 30);
    if (!Number.isFinite(seconds)) {
      return 30000;
    }
    return Math.max(10, Math.floor(seconds)) * 1000;
  }

  private shouldRequireBackendMode(): boolean {
    const config = vscode.workspace.getConfiguration("narrate");
    return config.get<boolean>("governance.autoSync.requireBackendMode", true);
  }

  private shouldShowNotifications(): boolean {
    const config = vscode.workspace.getConfiguration("narrate");
    return config.get<boolean>("governance.autoSync.showNotifications", false);
  }

  private shouldEmitWarning(trigger: "manual" | "auto"): boolean {
    if (trigger === "manual") {
      return true;
    }
    const now = Date.now();
    if (now - this.lastWarningAtMs < 300000) {
      return false;
    }
    this.lastWarningAtMs = now;
    return true;
  }

  private resolveStateFile(workspaceRoot: string): string | undefined {
    const config = vscode.workspace.getConfiguration("narrate");
    const raw = config.get<string>("governance.stateFile", "").trim();
    if (!raw) {
      return undefined;
    }
    return path.isAbsolute(raw) ? raw : path.join(workspaceRoot, raw);
  }

  private affectsGovernanceSettings(event: vscode.ConfigurationChangeEvent): boolean {
    const keys = [
      "narrate.governance.autoSync.enabled",
      "narrate.governance.autoSync.intervalSeconds",
      "narrate.governance.autoSync.showNotifications",
      "narrate.governance.autoSync.dryRun",
      "narrate.governance.autoSync.requireBackendMode",
      "narrate.governance.stateFile",
      "narrate.licensing.mode",
      "narrate.licensing.apiBaseUrl"
    ];
    return keys.some((key) => event.affectsConfiguration(key));
  }
}

function summarizeWorkerOutput(output: string): { message: string; activityDetected: boolean } {
  const text = output.toLowerCase();
  if (!text || text.includes("no new governance events")) {
    return {
      message: "No new governance decisions.",
      activityDetected: false
    };
  }
  if (text.includes("acked event")) {
    return {
      message: "Governance decision synced and acknowledged.",
      activityDetected: true
    };
  }
  if (text.includes("pulled") && text.includes("event")) {
    return {
      message: "Governance events pulled.",
      activityDetected: true
    };
  }
  return {
    message: "Governance sync completed.",
    activityDetected: true
  };
}

function classifyGovernanceSyncError(details: string): string {
  const lowered = details.toLowerCase();
  if (lowered.includes("no access token in state")) {
    return "Governance sync requires login. Run `./pg.ps1 governance-login` in workspace terminal.";
  }
  if (lowered.includes("invalid bearer token")) {
    return "Governance sync token is invalid. Re-run `./pg.ps1 governance-login`.";
  }
  if (lowered.includes("could not connect") || lowered.includes("actively refused")) {
    return "Governance sync cannot reach local server.";
  }
  return "Governance sync failed.";
}
