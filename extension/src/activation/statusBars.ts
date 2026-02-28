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
    statusBars.modeStatus.text = `Narrate: Reading (${mode.toUpperCase()})`;
    statusBars.modeStatus.tooltip = "Switch Narrate mode";
    statusBars.modeStatus.command = "narrate.switchNarrationMode";
    statusBars.modeStatus.show();

    statusBars.planStatus.text = `Plan: ${featureGates.getPlanLabel()}`;
    statusBars.planStatus.tooltip =
      "Narrate licensing status. Use Narrate: License Status for details.";
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
  item.text = `Narrate View: ${mode === "exact" ? "Exact" : "Section"}`;
  item.tooltip = "Switch Narrate reading view mode";
  item.command = "narrate.switchReadingViewMode";
  item.show();
}

function setReadingPaneStatus(
  item: vscode.StatusBarItem,
  mode: "sideBySide" | "fullPage"
): void {
  item.text = `Narrate Pane: ${mode === "sideBySide" ? "Split" : "Full"}`;
  item.tooltip = "Switch Narrate reading pane mode";
  item.command = "narrate.switchReadingPaneMode";
  item.show();
}

function setReadingSnippetStatus(
  item: vscode.StatusBarItem,
  mode: "withSource" | "narrationOnly"
): void {
  item.text = `Narrate Source: ${mode === "withSource" ? "Code+Meaning" : "Meaning"}`;
  item.tooltip = "Toggle code snippet display in exact mode";
  item.command = "narrate.switchReadingSnippetMode";
  item.show();
}

function setEduDetailStatus(
  item: vscode.StatusBarItem,
  detailLevel: "standard" | "beginner" | "fullBeginner"
): void {
  const label =
    detailLevel === "fullBeginner"
      ? "Full Beginner"
      : detailLevel === "beginner"
        ? "Beginner"
        : "Standard";
  item.text = `Narrate Explain: ${label}`;
  item.tooltip = "Toggle education detail depth";
  item.command = "narrate.switchEduDetailLevel";
  item.show();
}

function setReadingRefreshStatus(item: vscode.StatusBarItem): void {
  item.text = "$(refresh) Narrate";
  item.tooltip = "Refresh current narration";
  item.command = "narrate.refreshReadingView";
  item.show();
}
