import * as vscode from "vscode";
import {
  getCurrentEduDetailLevel,
  getCurrentMode,
  getCurrentReadingPaneMode,
  getCurrentReadingSnippetMode,
  getCurrentReadingViewMode
} from "../commands/modeState";
import { FeatureGateService } from "../licensing/featureGates";
import { NarrationMode } from "../types";

type StatusBarItems = {
  modeStatus: vscode.StatusBarItem;
  viewStatus: vscode.StatusBarItem;
  paneStatus: vscode.StatusBarItem;
  snippetStatus: vscode.StatusBarItem;
  eduDetailStatus: vscode.StatusBarItem;
  refreshStatus: vscode.StatusBarItem;
  planStatus: vscode.StatusBarItem;
};

export type StatusRefreshers = {
  refreshStatusBar: (mode: NarrationMode) => void;
  refreshReadingControls: () => void;
  refreshAllStatusBars: () => void;
};

type StatusTone = "default" | "critical" | "caution";

export function createStatusBarItems(context: vscode.ExtensionContext): StatusBarItems {
  const items = {
    modeStatus: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100),
    viewStatus: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99),
    paneStatus: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98),
    snippetStatus: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 97),
    eduDetailStatus: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 96),
    refreshStatus: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 95),
    planStatus: vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  };
  context.subscriptions.push(
    items.modeStatus,
    items.viewStatus,
    items.paneStatus,
    items.snippetStatus,
    items.eduDetailStatus,
    items.refreshStatus,
    items.planStatus
  );
  return items;
}

export function createStatusRefreshers(
  context: vscode.ExtensionContext,
  featureGates: FeatureGateService,
  statusBars: StatusBarItems
): StatusRefreshers {
  const refreshStatusBar = (mode: NarrationMode): void => {
    statusBars.modeStatus.text = `Narrate Reading: ${formatTwoChoiceStatus(
      mode === "dev",
      "Dev",
      "Edu"
    )}`;
    statusBars.modeStatus.tooltip =
      "Switch Narrate mode. The active option is shown in [brackets].";
    statusBars.modeStatus.command = "narrate.switchNarrationMode";
    applyStatusTone(statusBars.modeStatus, "critical");
    statusBars.modeStatus.show();

    statusBars.planStatus.text = `Plan: ${featureGates.getPlanLabel()}`;
    statusBars.planStatus.tooltip =
      "Narrate licensing status. Use Narrate: License Status for details.";
    applyStatusTone(statusBars.planStatus, "default");
    statusBars.planStatus.show();
  };

  const refreshReadingControls = (): void => {
    const showControls = vscode.workspace
      .getConfiguration("narrate")
      .get<boolean>("reading.showStatusBarControls", true);
    if (!showControls) {
      hideReadingControlStatusBars(statusBars);
      return;
    }
    setReadingControlStatusBars(context, statusBars);
  };

  return {
    refreshStatusBar,
    refreshReadingControls,
    refreshAllStatusBars: () => {
      refreshStatusBar(getCurrentMode(context));
      refreshReadingControls();
    }
  };
}

function hideReadingControlStatusBars(statusBars: StatusBarItems): void {
  statusBars.viewStatus.hide();
  statusBars.paneStatus.hide();
  statusBars.snippetStatus.hide();
  statusBars.eduDetailStatus.hide();
  statusBars.refreshStatus.hide();
}

function setReadingControlStatusBars(
  context: vscode.ExtensionContext,
  statusBars: StatusBarItems
): void {
  setReadingViewStatus(statusBars.viewStatus, getCurrentReadingViewMode(context));
  setReadingPaneStatus(statusBars.paneStatus, getCurrentReadingPaneMode(context));
  setReadingSnippetStatus(statusBars.snippetStatus, getCurrentReadingSnippetMode(context));
  setEduDetailStatus(statusBars.eduDetailStatus, getCurrentEduDetailLevel(context));
  setReadingRefreshStatus(statusBars.refreshStatus);
}

function setReadingViewStatus(item: vscode.StatusBarItem, mode: "exact" | "section"): void {
  item.text = `Narrate View: ${formatTwoChoiceStatus(mode === "exact", "Exact", "Section")}`;
  item.tooltip =
    "Switch Narrate reading view mode. The active option is shown in [brackets].";
  item.command = "narrate.switchReadingViewMode";
  applyStatusTone(item, "caution");
  item.show();
}

function setReadingPaneStatus(
  item: vscode.StatusBarItem,
  mode: "sideBySide" | "fullPage"
): void {
  item.text = `Narrate Pane: ${formatTwoChoiceStatus(mode === "sideBySide", "Split", "Full")}`;
  item.tooltip =
    "Switch Narrate reading pane mode. The active option is shown in [brackets].";
  item.command = "narrate.switchReadingPaneMode";
  applyStatusTone(item, "default");
  item.show();
}

function setReadingSnippetStatus(
  item: vscode.StatusBarItem,
  mode: "withSource" | "narrationOnly"
): void {
  item.text = `Narrate Source: ${formatTwoChoiceStatus(
    mode === "withSource",
    "Code+Meaning",
    "Meaning"
  )}`;
  item.tooltip =
    "Toggle code snippet display in exact mode. The active option is shown in [brackets].";
  item.command = "narrate.switchReadingSnippetMode";
  applyStatusTone(item, "default");
  item.show();
}

function setEduDetailStatus(
  item: vscode.StatusBarItem,
  detailLevel: "standard" | "beginner" | "fullBeginner"
): void {
  item.text = `Narrate Explain: ${formatThreeChoiceStatus([
    { label: "Standard", active: detailLevel === "standard" },
    { label: "Beginner", active: detailLevel === "beginner" },
    { label: "Full", active: detailLevel === "fullBeginner" }
  ])}`;
  item.tooltip =
    "Toggle education detail depth. The active option is shown in [brackets].";
  item.command = "narrate.switchEduDetailLevel";
  applyStatusTone(item, "default");
  item.show();
}

function setReadingRefreshStatus(item: vscode.StatusBarItem): void {
  item.text = "$(refresh) Narrate";
  item.tooltip = "Refresh current narration";
  item.command = "narrate.refreshReadingView";
  applyStatusTone(item, "default");
  item.show();
}

function formatTwoChoiceStatus(activeLeft: boolean, leftLabel: string, rightLabel: string): string {
  return activeLeft ? `[${leftLabel}] ${rightLabel}` : `${leftLabel} [${rightLabel}]`;
}

function formatThreeChoiceStatus(
  options: Array<{ label: string; active: boolean }>
): string {
  return options.map((option) => (option.active ? `[${option.label}]` : option.label)).join(" ");
}

function applyStatusTone(item: vscode.StatusBarItem, tone: StatusTone): void {
  if (tone === "critical") {
    item.color = new vscode.ThemeColor("statusBarItem.errorForeground");
    item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    return;
  }
  if (tone === "caution") {
    item.color = new vscode.ThemeColor("statusBarItem.warningForeground");
    item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    return;
  }
  item.color = undefined;
  item.backgroundColor = undefined;
}
