import * as vscode from "vscode";
import {
  getStatusBackgroundColor,
  getStatusTextColor
} from "./trustScoreAnalysisUtils";
import {
  buildServerTrustErrorReport,
  fetchServerTrustReports
} from "./serverPolicyBridge";
import { LicensingSecretStorage } from "../licensing/secretStorage";
import { Logger } from "../utils/logger";
import {
  narrateConfig,
  buildReportTooltip,
  isAuthenticationRequiredReport,
  maybeOfferValidationSetup,
  maybeOfferDiagnosticsHint,
  isDocumentAnalyzable
} from "./trustScoreHelpers";
import { ANALYZABLE_LANGUAGES } from "./trustScoreTypes";
import type { TrustReport } from "./trustScoreTypes";
import { buildTrustReportMarkdown } from "./trustScoreAnalysisUtils";

export type { TrustSeverity, ComponentType, TrustFinding, TrustReport } from "./trustScoreTypes";

export class TrustScoreService implements vscode.Disposable {
  private readonly statusBar: vscode.StatusBarItem;
  private readonly licensingStorage: LicensingSecretStorage;
  private latestReport: TrustReport | undefined;
  private readonly reportUpdatedEmitter = new vscode.EventEmitter<TrustReport | undefined>();
  private lastValidationSuggestionAt = 0;
  private lastDiagnosticsRecoveryHintAt = 0;
  readonly onDidUpdateReport = this.reportUpdatedEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {
    this.licensingStorage = new LicensingSecretStorage(context);
    this.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );
    this.statusBar.command = "narrate.showTrustScoreReport";
    this.context.subscriptions.push(this.statusBar);
    this.renderIdleState();
  }

  dispose(): void {
    this.statusBar.dispose();
    this.reportUpdatedEmitter.dispose();
  }

  getLatestReport(): TrustReport | undefined {
    return this.latestReport;
  }

  isTrustScoreEnabled(): boolean { return narrateConfig("trustScore.enabled", true); }
  isAutoRefreshEnabled(): boolean { return narrateConfig("trustScore.autoRefreshOnSave", true); }

  async toggleEnabled(): Promise<boolean> {
    const nextEnabled = !narrateConfig("trustScore.enabled", true);
    const target = vscode.workspace.workspaceFolders?.length
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
    await vscode.workspace
      .getConfiguration("narrate")
      .update("trustScore.enabled", nextEnabled, target);

    if (!nextEnabled) {
      this.latestReport = undefined;
      this.renderIdleState();
    } else {
      await this.refreshNow();
    }
    return nextEnabled;
  }

  async refreshNow(): Promise<void> {
    await this.refreshActiveEditor(true);
  }

  async refreshActiveEditor(force = false): Promise<void> {
    if (!narrateConfig("trustScore.enabled", true)) { this.renderIdleState(); return; }
    if (!force && !narrateConfig("trustScore.autoRefreshOnSave", true)) { this.renderManualModeState(); return; }
    const active = vscode.window.activeTextEditor?.document;
    if (!active || !isDocumentAnalyzable(active, ANALYZABLE_LANGUAGES)) { this.renderIdleState(); return; }
    await this.evaluateDocument(active);
  }

  async onDidChangeActiveEditor(): Promise<void> {
    await this.refreshActiveEditor(false);
  }

  async onDidSaveTextDocument(document: vscode.TextDocument): Promise<void> {
    if (!narrateConfig("trustScore.enabled", true) || !narrateConfig("trustScore.autoRefreshOnSave", true) || !isDocumentAnalyzable(document, ANALYZABLE_LANGUAGES)) return;
    await this.evaluateDocument(document);
  }

  async showLatestReport(): Promise<void> {
    if (!this.latestReport) {
      void vscode.window.showInformationMessage(
        "Narrate Trust Score: no report yet. Save a source file first."
      );
      return;
    }
    const doc = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: buildTrustReportMarkdown(this.latestReport)
    });
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  async computeReportForDocument(document: vscode.TextDocument): Promise<TrustReport | undefined> {
    if (!isDocumentAnalyzable(document, ANALYZABLE_LANGUAGES)) {
      return undefined;
    }
    return this.fetchTrustReportForDocument(document);
  }

  async handleConfigurationChanged(event: vscode.ConfigurationChangeEvent): Promise<void> {
    const keys = ["enabled", "showStatusBar", "autoRefreshOnSave", "validationLibraryPolicy",
      "autoSuggestValidationInstall", "showDiagnosticsRecoveryHint"];
    if (!keys.some((k) => event.affectsConfiguration(`narrate.trustScore.${k}`))) return;
    await this.refreshActiveEditor(false);
  }

  async ensureActionAllowed(actionLabel: string): Promise<boolean> {
    if (!this.isTrustScoreEnabled()) {
      void vscode.window.showErrorMessage(
        `Narrate: ${actionLabel} is blocked until Trust Score is enabled and passes.`
      );
      return false;
    }

    await this.refreshNow();
    const report = this.latestReport;
    if (!report) {
      void vscode.window.showErrorMessage(
        `Narrate: ${actionLabel} is blocked because Trust Score could not evaluate the active file.`
      );
      return false;
    }

    if (isAuthenticationRequiredReport(report)) {
      const picked = await vscode.window.showWarningMessage(
        `Narrate: ${actionLabel} requires authentication before server trust evaluation can run. Sign in to Narrate, then refresh Trust Score.`,
        "Show Trust Report"
      );
      if (picked === "Show Trust Report") {
        await this.showLatestReport();
      }
      return false;
    }

    if (report.blockers === 0 && report.status !== "red") {
      return true;
    }

    const actions: string[] = ["Show Trust Report"];
    if (report.findings.some((finding) => finding.ruleId === "TRUST-TS-001")) {
      actions.push("Restart TS + Refresh Trust");
    }
    if (report.findings.some(isValidationFinding)) {
      actions.push("Setup Validation Library");
    }

    const picked = await vscode.window.showErrorMessage(
      `Narrate: ${actionLabel} blocked by Trust Score (${report.score}/100, ${report.blockers} blocker(s)).`,
      ...actions
    );
    if (picked === "Show Trust Report") {
      await this.showLatestReport();
    } else if (picked === "Restart TS + Refresh Trust") {
      await vscode.commands.executeCommand("narrate.restartTypeScriptAndRefreshTrust");
    } else if (picked === "Setup Validation Library") {
      await vscode.commands.executeCommand("narrate.setupValidationLibrary");
    }
    return false;
  }

  private renderIdleState(): void {
    if (!narrateConfig("trustScore.showStatusBar", true)) { this.statusBar.hide(); this.reportUpdatedEmitter.fire(this.latestReport); return; }
    if (!narrateConfig("trustScore.enabled", true)) {
      this.applyStatusBarState("$(circle-slash) Trust Off", "Narrate Trust Score is disabled. Toggle to enable.", "narrate.toggleTrustScore");
      this.statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
      this.reportUpdatedEmitter.fire(undefined);
      return;
    }
    if (!narrateConfig("trustScore.autoRefreshOnSave", true)) { this.renderManualModeState(); return; }
    this.applyStatusBarState("$(shield) Trust --", "Save a source file to calculate Narrate Trust Score.", "narrate.showTrustScoreReport");
    this.reportUpdatedEmitter.fire(this.latestReport);
  }

  private applyStatusBarState(text: string, tooltip: string, command: string): void {
    this.statusBar.text = text;
    this.statusBar.tooltip = tooltip;
    this.statusBar.command = command;
    this.statusBar.color = undefined;
    this.statusBar.backgroundColor = undefined;
    this.statusBar.show();
  }

  private renderManualModeState(): void {
    if (!narrateConfig("trustScore.showStatusBar", true)) { this.statusBar.hide(); this.reportUpdatedEmitter.fire(this.latestReport); return; }
    this.applyStatusBarState("$(sync-ignored) Trust Manual", "Auto Trust Score refresh is off. Click to run manual refresh.", "narrate.refreshTrustScore");
    this.reportUpdatedEmitter.fire(this.latestReport);
  }

  private async evaluateDocument(document: vscode.TextDocument): Promise<void> {
    try {
      const report = await this.fetchTrustReportForDocument(document);
      this.latestReport = report;
      this.renderReport(report);
      const throttleOk = this.shouldThrottle("lastValidationSuggestionAt");
      await maybeOfferValidationSetup(report, narrateConfig("trustScore.autoSuggestValidationInstall", true) && throttleOk);
      const diagThrottleOk = this.shouldThrottle("lastDiagnosticsRecoveryHintAt");
      await maybeOfferDiagnosticsHint(report, narrateConfig("trustScore.showDiagnosticsRecoveryHint", true) && diagThrottleOk);
      this.logger.info(`Trust Score updated: ${report.score}/100 (${report.blockers} blockers, ${report.warnings} warnings) for ${report.file}`);
    } catch (error) {
      this.logger.warn(`Trust Score evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async fetchTrustReportForDocument(
    document: vscode.TextDocument
  ): Promise<TrustReport> {
    try {
      const [report] = await fetchServerTrustReports(
        [document],
        this.logger,
        await this.resolveSessionToken()
      );
      if (report) {
        return report;
      }
      return buildServerTrustErrorReport(
        document,
        "Server trust evaluation returned no report for the active file."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return buildServerTrustErrorReport(
        document,
        message
      );
    }
  }

  private async resolveSessionToken(): Promise<string | undefined> {
    const secretToken = await this.licensingStorage.getAccessToken();
    if (secretToken) {
      return secretToken;
    }

    const configuredToken = vscode.workspace
      .getConfiguration("narrate")
      .get<string>("licensing.sessionToken", "")
      .trim();
    return configuredToken || undefined;
  }

  private shouldThrottle(field: "lastValidationSuggestionAt" | "lastDiagnosticsRecoveryHintAt"): boolean {
    const now = Date.now();
    if (now - this[field] < 2 * 60 * 1000) return false;
    this[field] = now;
    return true;
  }

  private renderReport(report: TrustReport): void {
    if (!narrateConfig("trustScore.showStatusBar", true)) { this.statusBar.hide(); this.reportUpdatedEmitter.fire(report); return; }
    if (isAuthenticationRequiredReport(report)) {
      this.statusBar.text = "$(key) Trust Sign-In";
      this.statusBar.tooltip = buildReportTooltip(report, narrateConfig("trustScore.autoRefreshOnSave", true));
      this.statusBar.command = "narrate.showTrustScoreReport";
      this.statusBar.color = new vscode.ThemeColor("statusBarItem.warningForeground");
      this.statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
      this.statusBar.show();
      this.reportUpdatedEmitter.fire(report);
      return;
    }

    const icon = report.status === "green" ? "$(pass-filled)" : report.status === "yellow" ? "$(warning)" : "$(error)";
    this.statusBar.text = `${icon} Trust ${report.score}/100 ${report.grade}`;
    this.statusBar.tooltip = buildReportTooltip(report, narrateConfig("trustScore.autoRefreshOnSave", true));
    this.statusBar.command = "narrate.showTrustScoreReport";
    this.statusBar.color = getStatusTextColor(report.status);
    this.statusBar.backgroundColor = getStatusBackgroundColor(report.status);
    this.statusBar.show();
    this.reportUpdatedEmitter.fire(report);
  }
}

function isValidationFinding(finding: { ruleId: string }): boolean {
  return (
    finding.ruleId === "TRUST-CSTD-VAL-001" ||
    finding.ruleId === "TRUST-CSTD-VAL-002"
  );
}
