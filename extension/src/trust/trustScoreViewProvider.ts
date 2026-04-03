import * as vscode from "vscode";
import {
  TrustFinding,
  TrustReport,
  TrustScoreService
} from "./trustScoreService";
import { isAuthenticationRequiredReport } from "./trustScoreHelpers";

type TrustTreeNode =
  | { kind: "summary"; report: TrustReport | undefined; enabled: boolean; auto: boolean }
  | { kind: "mode"; enabled: boolean; auto: boolean }
  | { kind: "updated"; report: TrustReport | undefined }
  | { kind: "findingHeader"; report: TrustReport }
  | { kind: "finding"; finding: TrustFinding };

export class TrustScoreViewProvider
  implements vscode.TreeDataProvider<TrustTreeNode>, vscode.Disposable {
  static readonly viewId = "narrate.trustScoreView";

  private readonly treeDataChangedEmitter = new vscode.EventEmitter<
    TrustTreeNode | undefined | null | void
  >();
  readonly onDidChangeTreeData = this.treeDataChangedEmitter.event;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly trustScoreService: TrustScoreService) {
    this.disposables.push(
      this.trustScoreService.onDidUpdateReport(() => {
        this.refresh();
      })
    );
  }

  dispose(): void {
    this.treeDataChangedEmitter.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  refresh(): void {
    this.treeDataChangedEmitter.fire();
  }

  getTreeItem(element: TrustTreeNode): vscode.TreeItem {
    if (element.kind === "summary") {
      return this.buildSummaryItem(element.report, element.enabled, element.auto);
    }

    if (element.kind === "mode") {
      const item = new vscode.TreeItem(
        `Mode: ${element.enabled ? (element.auto ? "Auto (on save)" : "Manual") : "Disabled"}`,
        vscode.TreeItemCollapsibleState.None
      );
      item.iconPath = new vscode.ThemeIcon("settings-gear");
      item.tooltip =
        "Trust Score mode. Use toggle action to enable/disable and refresh action for manual runs.";
      return item;
    }

    if (element.kind === "updated") {
      const value = element.report ? element.report.updatedAtUtc : "not available";
      const item = new vscode.TreeItem(
        `Updated: ${value}`,
        vscode.TreeItemCollapsibleState.None
      );
      item.iconPath = new vscode.ThemeIcon("history");
      return item;
    }

    if (element.kind === "findingHeader") {
      const item = new vscode.TreeItem(
        `Findings (${element.report.findings.length})`,
        vscode.TreeItemCollapsibleState.None
      );
      item.iconPath = new vscode.ThemeIcon("list-unordered");
      return item;
    }

    return this.buildFindingItem(element.finding);
  }

  getChildren(element?: TrustTreeNode): TrustTreeNode[] {
    if (element) {
      return [];
    }

    const report = this.trustScoreService.getLatestReport();
    const enabled = this.trustScoreService.isTrustScoreEnabled();
    const auto = this.trustScoreService.isAutoRefreshEnabled();
    const nodes: TrustTreeNode[] = [
      { kind: "summary", report, enabled, auto },
      { kind: "mode", enabled, auto },
      { kind: "updated", report }
    ];

    if (!report) {
      return nodes;
    }

    nodes.push({ kind: "findingHeader", report });

    const MAX_VISIBLE_FINDINGS = 25;
    for (const finding of report.findings.slice(0, MAX_VISIBLE_FINDINGS)) {
      nodes.push({ kind: "finding", finding });
    }

    return nodes;
  }

  private buildSummaryItem(
    report: TrustReport | undefined,
    enabled: boolean,
    auto: boolean
  ): vscode.TreeItem {
    if (!enabled) {
      const item = new vscode.TreeItem(
        "Trust Score: Disabled",
        vscode.TreeItemCollapsibleState.None
      );
      item.description = "toggle to enable";
      item.iconPath = new vscode.ThemeIcon(
        "circle-slash",
        new vscode.ThemeColor("testing.iconQueued")
      );
      item.tooltip = "Trust Score checks are currently disabled.";
      return item;
    }

    if (!report) {
      const modeLabel = auto ? "auto" : "manual";
      const item = new vscode.TreeItem(
        "Trust Score: Pending",
        vscode.TreeItemCollapsibleState.None
      );
      item.description = modeLabel;
      item.iconPath = new vscode.ThemeIcon(
        "clock",
        new vscode.ThemeColor("testing.iconQueued")
      );
      item.tooltip =
        "No Trust Score report yet. Save a file (auto mode) or click refresh (manual mode).";
      return item;
    }

    if (isAuthenticationRequiredReport(report)) {
      const item = new vscode.TreeItem(
        "Trust Score: Sign-in required",
        vscode.TreeItemCollapsibleState.None
      );
      item.description = "server auth";
      item.iconPath = new vscode.ThemeIcon(
        "key",
        new vscode.ThemeColor("testing.iconQueued")
      );
      item.tooltip =
        "Server-backed trust evaluation requires a valid Narrate sign-in session. Open the trust report for the exact authentication requirement.";
      item.command = {
        title: "Show Trust Score Report",
        command: "narrate.showTrustScoreReport"
      };
      return item;
    }

    const label = `Trust Score: ${report.score}/100`;
    const statusLabel = `${report.status.toUpperCase()} ${report.grade}`;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = statusLabel;
    item.iconPath = resolveSummaryIcon(report.status);
    item.tooltip =
      `Status: ${report.status.toUpperCase()}\n` +
      `Grade: ${report.grade}\n` +
      `Blockers: ${report.blockers}\n` +
      `Warnings: ${report.warnings}\n` +
      `File: ${report.file}`;
    item.command = {
      title: "Show Trust Score Report",
      command: "narrate.showTrustScoreReport"
    };
    return item;
  }

  private buildFindingItem(finding: TrustFinding): vscode.TreeItem {
    const prefix = finding.severity === "blocker" ? "BLOCKER" : "WARN";
    const line = finding.line ? `:${finding.line}` : "";
    const item = new vscode.TreeItem(
      `[${prefix}] ${finding.ruleId}`,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = `${finding.file}${line}`;
    item.tooltip = `${finding.message}`;
    item.iconPath =
      finding.severity === "blocker"
        ? new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"))
        : new vscode.ThemeIcon("warning", new vscode.ThemeColor("testing.iconQueued"));
    item.command = {
      title: "Open Trust Finding",
      command: "narrate.openTrustFindingLocation",
      arguments: [finding]
    };
    return item;
  }
}

function resolveSummaryIcon(status: TrustReport["status"]): vscode.ThemeIcon {
  if (status === "green") {
    return new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("testing.iconPassed"));
  }
  if (status === "yellow") {
    return new vscode.ThemeIcon("warning", new vscode.ThemeColor("testing.iconQueued"));
  }
  return new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"));
}

export async function openTrustFindingLocation(
  finding: TrustFinding
): Promise<void> {
  if (!finding.file) {
    return;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, finding.file);
  const document = await vscode.workspace.openTextDocument(fileUri);
  const editor = await vscode.window.showTextDocument(document, { preview: false });

  if (finding.line && finding.line > 0) {
    const line = Math.min(finding.line - 1, Math.max(0, document.lineCount - 1));
    const position = new vscode.Position(line, 0);
    const range = new vscode.Range(position, position);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }
}
