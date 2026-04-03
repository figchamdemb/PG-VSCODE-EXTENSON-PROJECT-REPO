import * as vscode from "vscode";
import { Logger } from "../utils/logger";
import { ReadingSessionState } from "./narrateSchemeProvider";

const SYNC_REVEAL_CONTEXT = 2;

export class ReadingSelectionSyncService implements vscode.Disposable {
  private readonly counterpartDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("editor.rangeHighlightBackground"),
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: new vscode.ThemeColor("editor.rangeHighlightBorder")
  });

  private isApplying = false;

  constructor(private readonly logger: Logger) {}

  dispose(): void {
    this.counterpartDecoration.dispose();
  }

  async onDidChangeSelection(event: vscode.TextEditorSelectionChangeEvent): Promise<void> {
    if (this.isApplying) {
      return;
    }

    const mapping = getSelectionMapping(event.textEditor.document.uri);
    if (!mapping || mapping.viewMode !== "exact") {
      this.clearSelectionDecorations();
      return;
    }

    const targetEditors = vscode.window.visibleTextEditors.filter((editor) => {
      if (editor.document.uri.toString() === event.textEditor.document.uri.toString()) {
        return false;
      }
      const candidate = getSelectionMapping(editor.document.uri);
      return (
        !!candidate &&
        candidate.viewMode === "exact" &&
        candidate.sourceUri.toString() === mapping.sourceUri.toString()
      );
    });

    if (!targetEditors.length) {
      this.clearCounterpartDecorations(event.textEditor.document.uri);
      return;
    }

    const ranges = toWholeLineRanges(event.selections);
    if (!ranges.length) {
      this.clearCounterpartDecorations(event.textEditor.document.uri);
      return;
    }

    this.isApplying = true;
    try {
      event.textEditor.setDecorations(this.counterpartDecoration, ranges);
      for (const editor of targetEditors) {
        editor.setDecorations(this.counterpartDecoration, ranges);
        revealPrimaryRange(editor, ranges[0]);
      }
    } finally {
      this.isApplying = false;
    }
  }

  async syncFromActiveEditor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    await this.onDidChangeSelection({
      kind: vscode.TextEditorSelectionChangeKind.Command,
      selections: editor.selections,
      textEditor: editor
    });
  }

  private clearSelectionDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.counterpartDecoration, []);
    }
  }

  private clearCounterpartDecorations(activeUri: vscode.Uri): void {
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === activeUri.toString()) {
        continue;
      }
      editor.setDecorations(this.counterpartDecoration, []);
    }
  }
}

type SelectionMapping = {
  sourceUri: vscode.Uri;
  viewMode: ReadingSessionState["viewMode"];
};

function getSelectionMapping(uri: vscode.Uri): SelectionMapping | undefined {
  if (uri.scheme === "file") {
    return { sourceUri: uri, viewMode: "exact" };
  }
  if (uri.scheme !== "narrate" || uri.authority !== "read") {
    return undefined;
  }

  const encodedPath = uri.path.startsWith("/") ? uri.path.slice(1) : uri.path;
  if (!encodedPath) {
    return undefined;
  }

  try {
    const sourcePath = decodeURIComponent(encodedPath);
    const params = new URLSearchParams(uri.query);
    return {
      sourceUri: vscode.Uri.file(sourcePath),
      viewMode: params.get("view") === "section" ? "section" : "exact"
    };
  } catch {
    return undefined;
  }
}

function toWholeLineRanges(selections: readonly vscode.Selection[]): vscode.Range[] {
  const ranges: vscode.Range[] = [];
  for (const selection of selections) {
    const startLine = Math.min(selection.start.line, selection.end.line);
    const endLine = Math.max(selection.start.line, selection.end.line);
    for (let line = startLine; line <= endLine; line += 1) {
      ranges.push(new vscode.Range(line, 0, line, 0));
    }
  }
  return mergeAdjacentRanges(ranges);
}

function mergeAdjacentRanges(ranges: vscode.Range[]): vscode.Range[] {
  if (!ranges.length) {
    return [];
  }
  const sorted = ranges.slice().sort((left, right) => left.start.line - right.start.line);
  const merged: vscode.Range[] = [];
  let currentStart = sorted[0].start.line;
  let currentEnd = sorted[0].end.line;

  for (let index = 1; index < sorted.length; index += 1) {
    const range = sorted[index];
    if (range.start.line <= currentEnd + 1) {
      currentEnd = Math.max(currentEnd, range.end.line);
      continue;
    }
    merged.push(new vscode.Range(currentStart, 0, currentEnd, 0));
    currentStart = range.start.line;
    currentEnd = range.end.line;
  }

  merged.push(new vscode.Range(currentStart, 0, currentEnd, 0));
  return merged;
}

function revealPrimaryRange(editor: vscode.TextEditor, range: vscode.Range): void {
  const revealTarget = new vscode.Range(
    Math.max(0, range.start.line - SYNC_REVEAL_CONTEXT),
    0,
    range.end.line + SYNC_REVEAL_CONTEXT,
    0
  );
  editor.revealRange(revealTarget, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}