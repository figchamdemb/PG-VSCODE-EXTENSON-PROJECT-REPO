import * as vscode from "vscode";
import {
  EduDetailLevel,
  NarrationMode,
  ReadingPaneMode,
  ReadingSnippetMode,
  ReadingViewMode
} from "../types";

const MODE_KEY = "narrate.mode";
const VIEW_MODE_KEY = "narrate.reading.viewMode";
const PANE_MODE_KEY = "narrate.reading.paneMode";
const SNIPPET_MODE_KEY = "narrate.reading.snippetMode";
const EDU_DETAIL_LEVEL_KEY = "narrate.reading.eduDetailLevel";

export function getCurrentMode(context: vscode.ExtensionContext): NarrationMode {
  const stored = context.workspaceState.get<string>(MODE_KEY);
  if (stored === "dev" || stored === "edu") {
    return stored;
  }
  const configured = vscode.workspace.getConfiguration("narrate").get<string>("defaultMode", "dev");
  return configured === "edu" ? "edu" : "dev";
}

export async function setCurrentMode(context: vscode.ExtensionContext, mode: NarrationMode): Promise<void> {
  await context.workspaceState.update(MODE_KEY, mode);
}

export function getCurrentReadingViewMode(context: vscode.ExtensionContext): ReadingViewMode {
  const stored = context.workspaceState.get<string>(VIEW_MODE_KEY);
  if (stored === "exact" || stored === "section") {
    return stored;
  }
  const configured = vscode.workspace
    .getConfiguration("narrate")
    .get<string>("reading.defaultViewMode", "exact");
  return configured === "section" ? "section" : "exact";
}

export async function setCurrentReadingViewMode(
  context: vscode.ExtensionContext,
  mode: ReadingViewMode
): Promise<void> {
  await context.workspaceState.update(VIEW_MODE_KEY, mode);
}

export function getCurrentReadingPaneMode(context: vscode.ExtensionContext): ReadingPaneMode {
  const stored = context.workspaceState.get<string>(PANE_MODE_KEY);
  if (stored === "sideBySide" || stored === "fullPage") {
    return stored;
  }
  const configured = vscode.workspace
    .getConfiguration("narrate")
    .get<string>("reading.defaultPaneMode", "sideBySide");
  return configured === "fullPage" ? "fullPage" : "sideBySide";
}

export async function setCurrentReadingPaneMode(
  context: vscode.ExtensionContext,
  mode: ReadingPaneMode
): Promise<void> {
  await context.workspaceState.update(PANE_MODE_KEY, mode);
}

export function getCurrentReadingSnippetMode(context: vscode.ExtensionContext): ReadingSnippetMode {
  const stored = context.workspaceState.get<string>(SNIPPET_MODE_KEY);
  if (stored === "withSource" || stored === "narrationOnly") {
    return stored;
  }
  const configured = vscode.workspace
    .getConfiguration("narrate")
    .get<string>("reading.defaultSnippetMode", "withSource");
  return configured === "narrationOnly" ? "narrationOnly" : "withSource";
}

export async function setCurrentReadingSnippetMode(
  context: vscode.ExtensionContext,
  mode: ReadingSnippetMode
): Promise<void> {
  await context.workspaceState.update(SNIPPET_MODE_KEY, mode);
}

export function getCurrentEduDetailLevel(context: vscode.ExtensionContext): EduDetailLevel {
  const stored = context.workspaceState.get<string>(EDU_DETAIL_LEVEL_KEY);
  if (stored === "standard" || stored === "beginner" || stored === "fullBeginner") {
    return stored;
  }
  const configured = vscode.workspace
    .getConfiguration("narrate")
    .get<string>("reading.defaultEduDetailLevel", "standard");
  if (configured === "fullBeginner") {
    return "fullBeginner";
  }
  return configured === "beginner" ? "beginner" : "standard";
}

export async function setCurrentEduDetailLevel(
  context: vscode.ExtensionContext,
  level: EduDetailLevel
): Promise<void> {
  await context.workspaceState.update(EDU_DETAIL_LEVEL_KEY, level);
}
