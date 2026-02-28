import * as vscode from "vscode";
import {
  buildTrustReportMarkdown,
  computeTrustReport,
  getStatusBackgroundColor,
  getStatusTextColor
} from "./trustScoreAnalysis";
import { Logger } from "../utils/logger";

export type TrustSeverity = "blocker" | "warning";

export type ComponentType =
  | "controller"
  | "service"
  | "repository"
  | "component"
  | "hook"
  | "screen"
  | "page"
  | "test"
  | "unknown";

export type TrustFinding = {
  ruleId: string;
  severity: TrustSeverity;
  message: string;
  file: string;
  line?: number;
  componentType?: ComponentType;
};

export type TrustReport = {
  score: number;
  status: "green" | "yellow" | "red";
  grade: string;
  blockers: number;
  warnings: number;
  findings: TrustFinding[];
  file: string;
  lineCount: number;
  componentType: ComponentType;
  updatedAtUtc: string;
};

const ANALYZABLE_LANGUAGES = new Set([
  "typescript",
  "typescriptreact",
  "javascript",
  "javascriptreact",
  "python",
  "java",
  "go",
  "rust",
  "csharp",
  "php",
  "ruby"
]);

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

  isTrustScoreEnabled(): boolean {
    return this.isEnabled();
  }

  isAutoRefreshEnabled(): boolean {
    return this.shouldAutoRefresh();
  }

  async toggleEnabled(): Promise<boolean> {
    const nextEnabled = !this.isEnabled();
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
    if (!this.isEnabled()) {
      this.renderIdleState();
      return;
    }
    if (!force && !this.shouldAutoRefresh()) {
      this.renderManualModeState();
      return;
    }

    const active = vscode.window.activeTextEditor?.document;
    if (!active || !this.isAnalyzable(active)) {
      this.renderIdleState();
      return;
    }
    await this.evaluateDocument(active);
  }

  async onDidChangeActiveEditor(): Promise<void> {
    await this.refreshActiveEditor(false);
  }

  async onDidSaveTextDocument(document: vscode.TextDocument): Promise<void> {
    if (
      !this.isEnabled() ||
      !this.shouldAutoRefresh() ||
      !this.isAnalyzable(document)
    ) {
      return;
    }
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
    if (!this.isAnalyzable(document)) {
      return undefined;
    }
    return computeTrustReport(document);
  }

  async handleConfigurationChanged(
    event: vscode.ConfigurationChangeEvent
  ): Promise<void> {
    if (
      !event.affectsConfiguration("narrate.trustScore.enabled") &&
      !event.affectsConfiguration("narrate.trustScore.showStatusBar") &&
      !event.affectsConfiguration("narrate.trustScore.autoRefreshOnSave") &&
      !event.affectsConfiguration("narrate.trustScore.validationLibraryPolicy") &&
      !event.affectsConfiguration("narrate.trustScore.autoSuggestValidationInstall") &&
      !event.affectsConfiguration("narrate.trustScore.showDiagnosticsRecoveryHint")
    ) {
      return;
    }
    await this.refreshActiveEditor(false);
  }

  private isEnabled(): boolean {
    return vscode.workspace
      .getConfiguration("narrate")
      .get<boolean>("trustScore.enabled", true);
  }

  private shouldShowStatusBar(): boolean {
    return vscode.workspace
      .getConfiguration("narrate")
      .get<boolean>("trustScore.showStatusBar", true);
  }

  private shouldAutoRefresh(): boolean {
    return vscode.workspace
      .getConfiguration("narrate")
      .get<boolean>("trustScore.autoRefreshOnSave", true);
  }

  private shouldAutoSuggestValidationInstall(): boolean {
    return vscode.workspace
      .getConfiguration("narrate")
      .get<boolean>("trustScore.autoSuggestValidationInstall", true);
  }

  private shouldShowDiagnosticsRecoveryHint(): boolean {
    return vscode.workspace
      .getConfiguration("narrate")
      .get<boolean>("trustScore.showDiagnosticsRecoveryHint", true);
  }

  private renderIdleState(): void {
    if (!this.shouldShowStatusBar()) {
      this.statusBar.hide();
      this.reportUpdatedEmitter.fire(this.latestReport);
      return;
    }

    if (!this.isEnabled()) {
      this.statusBar.text = "$(circle-slash) Trust Off";
      this.statusBar.tooltip = "Narrate Trust Score is disabled. Toggle to enable.";
      this.statusBar.command = "narrate.toggleTrustScore";
      this.statusBar.color = undefined;
      this.statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
      this.statusBar.show();
      this.reportUpdatedEmitter.fire(undefined);
      return;
    }

    if (!this.shouldAutoRefresh()) {
      this.renderManualModeState();
      return;
    }

    this.statusBar.text = "$(shield) Trust --";
    this.statusBar.tooltip = "Save a source file to calculate Narrate Trust Score.";
    this.statusBar.command = "narrate.showTrustScoreReport";
    this.statusBar.color = undefined;
    this.statusBar.backgroundColor = undefined;
    this.statusBar.show();
    this.reportUpdatedEmitter.fire(this.latestReport);
  }

  private renderManualModeState(): void {
    if (!this.shouldShowStatusBar()) {
      this.statusBar.hide();
      this.reportUpdatedEmitter.fire(this.latestReport);
      return;
    }

    this.statusBar.text = "$(sync-ignored) Trust Manual";
    this.statusBar.tooltip =
      "Auto Trust Score refresh is off. Click to run manual refresh.";
    this.statusBar.command = "narrate.refreshTrustScore";
    this.statusBar.color = undefined;
    this.statusBar.backgroundColor = undefined;
    this.statusBar.show();
    this.reportUpdatedEmitter.fire(this.latestReport);
  }

  private async evaluateDocument(document: vscode.TextDocument): Promise<void> {
    try {
      const report = computeTrustReport(document);
      this.latestReport = report;
      this.renderReport(report);
      await this.maybeOfferValidationLibrarySetup(report);
      await this.maybeOfferDiagnosticsRecoveryHint(report);
      this.logger.info(
        `Trust Score updated: ${report.score}/100 (${report.blockers} blockers, ${report.warnings} warnings) for ${report.file}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Trust Score evaluation failed: ${message}`);
    }
  }

  private async maybeOfferValidationLibrarySetup(report: TrustReport): Promise<void> {
    if (!this.shouldAutoSuggestValidationInstall()) {
      return;
    }
    const hasValidationGap = report.findings.some(
      (finding) =>
        finding.ruleId === "TRUST-CSTD-VAL-001" ||
        finding.ruleId === "TRUST-CSTD-VAL-002"
    );
    if (!hasValidationGap) {
      return;
    }
    const now = Date.now();
    if (now - this.lastValidationSuggestionAt < 2 * 60 * 1000) {
      return;
    }
    this.lastValidationSuggestionAt = now;
    const action = await vscode.window.showWarningMessage(
      "Narrate Trust: validation setup is missing. Install a validation library (Zod recommended).",
      "Install Zod Now",
      "Choose Library",
      "Later"
    );
    if (action === "Install Zod Now") {
      await vscode.commands.executeCommand("narrate.setupValidationLibrary", "zod");
      return;
    }
    if (action === "Choose Library") {
      await vscode.commands.executeCommand("narrate.setupValidationLibrary");
    }
  }

  private async maybeOfferDiagnosticsRecoveryHint(report: TrustReport): Promise<void> {
    if (!this.shouldShowDiagnosticsRecoveryHint()) {
      return;
    }
    const hasTypeScriptBlocker = report.findings.some(
      (finding) => finding.ruleId === "TRUST-TS-001"
    );
    if (!hasTypeScriptBlocker) {
      return;
    }
    const now = Date.now();
    if (now - this.lastDiagnosticsRecoveryHintAt < 2 * 60 * 1000) {
      return;
    }
    this.lastDiagnosticsRecoveryHintAt = now;
    const action = await vscode.window.showInformationMessage(
      "Narrate Trust: TypeScript diagnostics are active. If compile already passed, restart TS server and refresh trust.",
      "Run Auto Fix",
      "Dismiss"
    );
    if (action !== "Run Auto Fix") {
      return;
    }
    await vscode.commands.executeCommand("narrate.restartTypeScriptAndRefreshTrust");
  }

  private renderReport(report: TrustReport): void {
    if (!this.shouldShowStatusBar()) {
      this.statusBar.hide();
      this.reportUpdatedEmitter.fire(report);
      return;
    }

    const icon =
      report.status === "green"
        ? "$(pass-filled)"
        : report.status === "yellow"
          ? "$(warning)"
          : "$(error)";

    this.statusBar.text = `${icon} Trust ${report.score}/100 ${report.grade}`;
    this.statusBar.tooltip =
      `Narrate Trust Score (${report.status.toUpperCase()})\n` +
      `Grade: ${report.grade}\n` +
      `Blockers: ${report.blockers}\nWarnings: ${report.warnings}\n` +
      `Auto mode: ${this.shouldAutoRefresh() ? "on-save" : "manual"}\n` +
      "Click to open trust findings report.";
    this.statusBar.command = "narrate.showTrustScoreReport";
    this.statusBar.color = getStatusTextColor(report.status);
    this.statusBar.backgroundColor = getStatusBackgroundColor(report.status);
    this.statusBar.show();
    this.reportUpdatedEmitter.fire(report);
  }

  private isAnalyzable(document: vscode.TextDocument): boolean {
    if (document.uri.scheme !== "file") {
      return false;
    }
    if (document.getText().length > 1_500_000) {
      return false;
    }
    return ANALYZABLE_LANGUAGES.has(document.languageId);
  }
}
