import * as vscode from "vscode";
import { runPowerShellCommand } from "../governance/powerShellRunner";
import { Logger } from "../utils/logger";
import { StartupContextResolution } from "./startupContextResolver";
import {
  buildPromptActions,
  currentUtcDay,
  ensureEnforcementState,
  getEnforcementState,
  getStartupRecord,
  isPromptCoolingDown,
  resolveWorkspaceTarget,
  setEnforcementState,
  setStartupRecord,
  toErrorMessage,
  truncateMessage,
  WorkspaceEnforcementState,
  WorkspaceEnforcementTarget,
  StartupSessionRecord
} from "./startupContextEnforcerSupport";
import { renderFailedStatus, renderMissingContextStatus, renderPassedStatus, renderPendingStatus, renderRunningStatus, renderStoppedStatus } from "./startupContextEnforcerStatus";

type StartupSource = "activation" | "editor-change" | "workspace-change" | "manual" | "action";

const AUTO_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

export class StartupContextEnforcer implements vscode.Disposable {
  private readonly statusBar: vscode.StatusBarItem;
  private readonly inFlight = new Map<string, Promise<boolean>>();
  private readonly promptTimestamps = new Map<string, number>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {
    this.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      98
    );
    this.statusBar.command = "narrate.runStartupForCurrentContext";
  }

  dispose(): void {
    this.statusBar.dispose();
  }

  async initialize(): Promise<void> {
    await this.refreshForCurrentContext("activation");
  }

  async ensureWorkspaceReadyForAction(
    actionLabel: string,
    seedUri?: vscode.Uri
  ): Promise<boolean> {
    return this.refreshForCurrentContext("action", seedUri, false, actionLabel);
  }

  async applyMandatoryEnforcementBridgeAction(
    workspaceUri: vscode.Uri,
    action: "stop" | "resume",
    source: string
  ): Promise<{ ok: boolean; message: string }> {
    const target = resolveWorkspaceTarget(workspaceUri);
    if (!target) {
      return {
        ok: false,
        message: `Narrate could not resolve workspace enforcement target for ${workspaceUri.fsPath}.`
      };
    }

    if (action === "stop") {
      this.applyEnforcementState(target, "stopped", `Stopped by ${source}.`);
      this.renderStopped(target, getEnforcementState(this.context, target.key));
      return {
        ok: true,
        message: `Mandatory PG enforcement stopped for ${target.label}.`
      };
    }

    this.applyEnforcementState(target, "active");
    const passed = await this.refreshForCurrentContext("manual", workspaceUri, true);
    return {
      ok: passed,
      message: passed
        ? `Mandatory PG enforcement resumed for ${target.label}.`
        : `Mandatory PG enforcement resumed for ${target.label}, but startup still needs attention.`
    };
  }

  async stopMandatoryEnforcementForCurrentWorkspace(): Promise<void> {
    const target = resolveWorkspaceTarget();
    if (!target) {
      void vscode.window.showWarningMessage(
        "Narrate: open a workspace folder before stopping PG enforcement."
      );
      return;
    }

    const picked = await vscode.window.showWarningMessage(
      `Narrate: stop mandatory PG enforcement for ${target.label}? This workspace will keep running without startup popups until you resume enforcement manually.`,
      { modal: true },
      "Stop Enforcement"
    );
    if (picked !== "Stop Enforcement") {
      return;
    }

    this.applyEnforcementState(
      target,
      "stopped",
      "Stopped explicitly from the Narrate command palette."
    );
    this.renderStopped(target, getEnforcementState(this.context, target.key));
    void vscode.window.showWarningMessage(
      `Narrate: mandatory PG enforcement stopped for ${target.label}. Use “Narrate: Resume PG Enforcement For Workspace” to turn it back on.`
    );
  }

  async resumeMandatoryEnforcementForCurrentWorkspace(): Promise<void> {
    const target = resolveWorkspaceTarget();
    if (!target) {
      void vscode.window.showWarningMessage(
        "Narrate: open a workspace folder before resuming PG enforcement."
      );
      return;
    }

    this.applyEnforcementState(target, "active");

    await this.refreshForCurrentContext("manual", target.workspaceUri, true);
  }

  async onDidChangeActiveEditor(editor?: vscode.TextEditor): Promise<void> {
    await this.refreshForCurrentContext("editor-change", editor?.document.uri);
  }

  async onDidChangeWorkspaceFolders(): Promise<void> {
    await this.refreshForCurrentContext("workspace-change");
  }

  async handleConfigurationChanged(
    event: vscode.ConfigurationChangeEvent
  ): Promise<void> {
    if (
      !event.affectsConfiguration("narrate.startupGuard.enabled") &&
      !event.affectsConfiguration("narrate.startupGuard.autoRunOnContextChange")
    ) {
      return;
    }
    await this.refreshForCurrentContext("manual");
  }

  async runStartupForCurrentContext(): Promise<boolean> {
    return this.refreshForCurrentContext("manual", undefined, true);
  }

  private async refreshForCurrentContext(
    source: StartupSource,
    seedUri?: vscode.Uri,
    isManual = false,
    actionLabel?: string
  ): Promise<boolean> {
    if (!this.isEnabled()) {
      this.statusBar.hide();
      return true;
    }

    const target = resolveWorkspaceTarget(seedUri);
    if (!target) {
      this.statusBar.hide();
      return true;
    }

    const enforcementState = ensureEnforcementState(this.context, target);
    if (enforcementState.mode === "stopped") {
      this.renderStopped(target, enforcementState);
      return true;
    }

    if (!target.resolution) {
      this.renderMissingContext(target, enforcementState);
      await this.maybePromptMissingContext(target, actionLabel);
      return false;
    }

    const resolution = target.resolution;

    const record = getStartupRecord(this.context, resolution.key);
    if (this.isPassedToday(record)) {
      this.renderPassed(resolution, record);
      return true;
    }

    if (!this.shouldAutoRun() && !isManual) {
      this.renderPending(resolution, record);
      await this.maybePromptPending(target, actionLabel);
      return false;
    }

    if (!isManual && !this.shouldAttemptAutoRetry(record)) {
      this.renderFailed(resolution, record);
      await this.showFailurePrompt(target, record?.lastError || "Startup failed for this context.", actionLabel);
      return false;
    }

    return this.runStartup(target, source, isManual, actionLabel);
  }

  private async runStartup(
    target: WorkspaceEnforcementTarget,
    source: StartupSource,
    isManual: boolean,
    actionLabel?: string
  ): Promise<boolean> {
    const resolution = target.resolution;
    if (!resolution) {
      this.renderMissingContext(target, getEnforcementState(this.context, target.key));
      await this.maybePromptMissingContext(target, actionLabel);
      return false;
    }

    const existing = this.inFlight.get(resolution.key);
    if (existing) {
      return existing;
    }

    const task = this.runStartupInternal(target, resolution, source, isManual, actionLabel)
      .finally(() => {
        this.inFlight.delete(resolution.key);
      });

    this.inFlight.set(resolution.key, task);
    return task;
  }

  private async runStartupInternal(
    target: WorkspaceEnforcementTarget,
    resolution: StartupContextResolution,
    source: StartupSource,
    isManual: boolean,
    actionLabel?: string
  ): Promise<boolean> {
    this.renderRunning(resolution);
    this.logger.info(
      `[startup-guard] running pg start for '${resolution.label}' (${source}) at ${resolution.repo.repoRoot}`
    );

    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolution.repo.pgScriptPath,
      "start",
      "-Yes",
      "-EnforcementMode",
      "strict",
      "-SkipDevProfileNotice"
    ];

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Narrate: running startup for ${resolution.label}`,
          cancellable: false
        },
        async () => runPowerShellCommand(args, resolution.repo.repoRoot)
      );

      const now = new Date().toISOString();
      const record: StartupSessionRecord = {
        day: currentUtcDay(),
        status: "passed",
        lastAttemptAtUtc: now,
        lastSuccessAtUtc: now
      };
      setStartupRecord(this.context, resolution.key, record);
      this.applyEnforcementState(target, "active", undefined, now);
      this.renderPassed(resolution, record);
      this.logger.info(
        `[startup-guard] startup passed for '${resolution.label}'`
      );

      if (isManual) {
        void vscode.window.showInformationMessage(
          `Narrate: startup passed for ${resolution.label}.`
        );
      }
      return true;
    } catch (error) {
      const message = toErrorMessage(error);
      const record: StartupSessionRecord = {
        day: currentUtcDay(),
        status: "failed",
        lastAttemptAtUtc: new Date().toISOString(),
        lastError: message
      };
      setStartupRecord(this.context, resolution.key, record);
      this.renderFailed(resolution, record);
      this.logger.warn(
        `[startup-guard] startup failed for '${resolution.label}' :: ${message}`
      );
      await this.showFailurePrompt(target, message, actionLabel);
      return false;
    }
  }

  private renderStopped(
    target: WorkspaceEnforcementTarget,
    state?: WorkspaceEnforcementState
  ): void {
    renderStoppedStatus(this.statusBar, target, state);
  }

  private renderMissingContext(
    target: WorkspaceEnforcementTarget,
    state?: WorkspaceEnforcementState
  ): void {
    renderMissingContextStatus(this.statusBar, target, state);
  }

  private renderPending(
    resolution: StartupContextResolution,
    record?: StartupSessionRecord
  ): void {
    renderPendingStatus(this.statusBar, resolution, record);
  }

  private renderRunning(resolution: StartupContextResolution): void {
    renderRunningStatus(this.statusBar, resolution);
  }

  private renderPassed(
    resolution: StartupContextResolution,
    record?: StartupSessionRecord
  ): void {
    renderPassedStatus(this.statusBar, resolution, record);
  }

  private renderFailed(
    resolution: StartupContextResolution,
    record?: StartupSessionRecord
  ): void {
    renderFailedStatus(this.statusBar, resolution, record);
  }

  private async maybePromptPending(
    target: WorkspaceEnforcementTarget,
    actionLabel?: string
  ): Promise<void> {
    const resolution = target.resolution;
    if (!resolution) {
      return;
    }
    const promptKey = `${target.key}|pending|${currentUtcDay()}|${actionLabel ?? "default"}`;
    if (isPromptCoolingDown(this.promptTimestamps, promptKey)) {
      return;
    }

    const actions = buildPromptActions(target);
    const picked = await vscode.window.showWarningMessage(
      `Narrate: mandatory PG startup is required for ${resolution.label}${actionLabel ? ` before ${actionLabel}` : ""}. Run startup now or stop enforcement explicitly.`,
      { modal: true },
      ...actions
    );
    await this.handlePromptSelection(picked, target, actionLabel);
  }

  private async showFailurePrompt(
    target: WorkspaceEnforcementTarget,
    message: string,
    actionLabel?: string
  ): Promise<void> {
    const promptKey = `${target.key}|failed|${currentUtcDay()}|${message}|${actionLabel ?? "default"}`;
    if (isPromptCoolingDown(this.promptTimestamps, promptKey)) {
      return;
    }

    const actions = buildPromptActions(target);
    const picked = await vscode.window.showErrorMessage(
      `Narrate: mandatory PG startup failed for ${target.label}${actionLabel ? ` before ${actionLabel}` : ""}. ${truncateMessage(message)}`,
      { modal: true },
      ...actions
    );
    await this.handlePromptSelection(picked, target, actionLabel);
  }

  private async maybePromptMissingContext(
    target: WorkspaceEnforcementTarget,
    actionLabel?: string
  ): Promise<void> {
    const promptKey = `${target.key}|missing-context|${currentUtcDay()}|${actionLabel ?? "default"}`;
    if (isPromptCoolingDown(this.promptTimestamps, promptKey)) {
      return;
    }

    const actions = buildPromptActions(target);
    const picked = await vscode.window.showErrorMessage(
      `Narrate: mandatory PG enforcement is active for ${target.label}, but startup context could not be resolved${actionLabel ? ` before ${actionLabel}` : ""}. Restore pg.ps1/AGENTS.md/Memory-bank integrity or stop enforcement explicitly.`,
      { modal: true },
      ...actions
    );
    await this.handlePromptSelection(picked, target, actionLabel);
  }

  private async handlePromptSelection(
    picked: string | undefined,
    target: WorkspaceEnforcementTarget,
    actionLabel?: string
  ): Promise<void> {
    if (picked === "Run Startup Now" && target.resolution) {
      setTimeout(() => {
        void this.runStartup(target, "manual", true, actionLabel);
      }, 0);
      return;
    }
    if (picked === "Retry Detection") {
      setTimeout(() => {
        void this.refreshForCurrentContext("manual", target.workspaceUri, true, actionLabel);
      }, 0);
      return;
    }
    if (picked === "Stop Enforcement") {
      this.applyEnforcementState(
        target,
        "stopped",
        actionLabel
          ? `Stopped explicitly while ${actionLabel} was blocked.`
          : "Stopped explicitly from a mandatory enforcement prompt."
      );
      this.renderStopped(target, getEnforcementState(this.context, target.key));
      return;
    }
    if (picked === "Open AGENTS.md" && target.agentsPath) {
      const document = await vscode.workspace.openTextDocument(target.agentsPath);
      await vscode.window.showTextDocument(document, { preview: false });
      return;
    }
    if (picked === "Reveal Workspace") {
      await vscode.commands.executeCommand("revealInExplorer", target.workspaceUri);
    }
  }

  private isEnabled(): boolean {
    return vscode.workspace
      .getConfiguration("narrate")
      .get<boolean>("startupGuard.enabled", true);
  }

  private shouldAutoRun(): boolean {
    return vscode.workspace
      .getConfiguration("narrate")
      .get<boolean>("startupGuard.autoRunOnContextChange", true);
  }

  private shouldAttemptAutoRetry(record?: StartupSessionRecord): boolean {
    if (!record || record.day !== currentUtcDay()) {
      return true;
    }
    if (record.status !== "failed") {
      return true;
    }
    const lastAttempt = Date.parse(record.lastAttemptAtUtc);
    if (!Number.isFinite(lastAttempt)) {
      return true;
    }
    return Date.now() - lastAttempt >= AUTO_RETRY_COOLDOWN_MS;
  }

  private isPassedToday(record?: StartupSessionRecord): boolean {
    return record?.status === "passed" && record.day === currentUtcDay();
  }

  private applyEnforcementState(
    target: WorkspaceEnforcementTarget,
    mode: "active" | "stopped",
    stopReason?: string,
    updatedAtUtc = new Date().toISOString()
  ): void {
    setEnforcementState(this.context, target.key, {
      ...(getEnforcementState(this.context, target.key) ?? {}),
      mode,
      updatedAtUtc,
      stopReason: mode === "stopped" ? stopReason : undefined,
      lastKnownLabel: target.label,
      lastKnownWorkspacePath: target.workspacePath,
      lastKnownAgentsPath: target.agentsPath,
      lastKnownEvidence: target.evidence
    });
  }
}
