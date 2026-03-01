import * as vscode from "vscode";
import {
  buildTrustReportMarkdown,
  computeTrustReport,
  getStatusBackgroundColor,
  getStatusTextColor
} from "./trustScoreAnalysis";
import { fetchServerPolicyFindings } from "./serverPolicyBridge";
import { Logger } from "../utils/logger";
import {
  narrateConfig,
  mergeServerFindings,
  buildReportTooltip,
  maybeOfferValidationSetup,
  maybeOfferDiagnosticsHint,
  isDocumentAnalyzable
} from "./trustScoreHelpers";
import { ANALYZABLE_LANGUAGES } from "./trustScoreTypes";
import type { TrustReport } from "./trustScoreTypes";

export type { TrustSeverity, ComponentType, TrustFinding, TrustReport } from "./trustScoreTypes";

export class TrustScoreService implements vscode.Disposable {
  private readonly statusBar: vscode.StatusBarItem;
  private latestReport: TrustReport | undefined;
  private readonly reportUpdatedEmitter = new vscode.EventEmitter<TrustReport | undefined>();
  private lastValidationSuggestionAt = 0;
  private lastDiagnosticsRecoveryHintAt = 0;
  readonly onDidUpdateReport = this.reportUpdatedEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {
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

  computeReportForDocument(document: vscode.TextDocument): TrustReport | undefined {
    return isDocumentAnalyzable(document, ANALYZABLE_LANGUAGES) ? computeTrustReport(document) : undefined;
  }

  async handleConfigurationChanged(event: vscode.ConfigurationChangeEvent): Promise<void> {
    const keys = ["enabled", "showStatusBar", "autoRefreshOnSave", "validationLibraryPolicy",
      "autoSuggestValidationInstall", "showDiagnosticsRecoveryHint", "serverPolicyEnabled"];
    if (!keys.some((k) => event.affectsConfiguration(`narrate.trustScore.${k}`))) return;
    await this.refreshActiveEditor(false);
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
      const report = computeTrustReport(document);
      const serverFindings = await fetchServerPolicyFindings(report.file, document.getText(), report.lineCount, this.logger);
      if (serverFindings.length > 0) mergeServerFindings(report, serverFindings);
      this.latestReport = report;
      this.renderReport(report);
      const throttleOk = this.shouldThrottle("lastValidationSuggestionAt");
      await maybeOfferValidationSetup(report, narrateConfig("trustScore.autoSuggestValidationInstall", true) && throttleOk);
      const diagThrottleOk = this.shouldThrottle("lastDiagnosticsRecoveryHintAt");
      await maybeOfferDiagnosticsHint(report, narrateConfig("trustScore.showDiagnosticsRecoveryHint", true) && diagThrottleOk);
      this.logger.info(`Trust Score updated: ${report.score}/100 (${report.blockers} blockers, ${report.warnings} warnings, server:${serverFindings.length}) for ${report.file}`);
    } catch (error) {
      this.logger.warn(`Trust Score evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private shouldThrottle(field: "lastValidationSuggestionAt" | "lastDiagnosticsRecoveryHintAt"): boolean {
    const now = Date.now();
    if (now - this[field] < 2 * 60 * 1000) return false;
    this[field] = now;
    return true;
  }

  private renderReport(report: TrustReport): void {
    if (!narrateConfig("trustScore.showStatusBar", true)) { this.statusBar.hide(); this.reportUpdatedEmitter.fire(report); return; }
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
