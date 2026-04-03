import * as vscode from "vscode";
import { NarrationEngine } from "../narration/narrationEngine";
import {
  EduDetailLevel,
  NarrationMode,
  ReadingPaneMode,
  ReadingSnippetMode,
  ReadingViewMode
} from "../types";
import { Logger } from "../utils/logger";
import { renderNarrationDocument } from "./renderNarration";

export interface ReadingSessionState {
  sourceUri: vscode.Uri;
  mode: NarrationMode;
  viewMode: ReadingViewMode;
  paneMode: ReadingPaneMode;
  snippetMode: ReadingSnippetMode;
  eduDetailLevel: EduDetailLevel;
  lastOpenedAt: string;
}

type OpenNarrationOptions = {
  viewMode?: ReadingViewMode;
  paneMode?: ReadingPaneMode;
  snippetMode?: ReadingSnippetMode;
  eduDetailLevel?: EduDetailLevel;
};

export class NarrateSchemeProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly cache = new Map<string, string>();
  private lastSession: ReadingSessionState | undefined;

  readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(private readonly narrationEngine: NarrationEngine, private readonly logger: Logger) {}

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.cache.get(uri.toString()) ?? "Narration content not ready.";
  }

  async openNarrationView(
    sourceDocument: vscode.TextDocument,
    mode: NarrationMode,
    options: OpenNarrationOptions = {}
  ): Promise<void> {
    const viewMode = options.viewMode ?? this.getDefaultViewMode();
    const paneMode = options.paneMode ?? this.getDefaultPaneMode();
    const snippetMode = options.snippetMode ?? this.getDefaultSnippetMode();
    const eduDetailLevel = options.eduDetailLevel ?? this.getDefaultEduDetailLevel();
    const narrationMap = await this.narrationEngine.narrateDocument(sourceDocument, mode);
    const content = renderNarrationDocument(sourceDocument, mode, narrationMap, viewMode, {
      snippetMode,
      eduDetailLevel
    });

    const uri = this.buildUri(sourceDocument.uri.fsPath, mode, viewMode, paneMode, snippetMode, eduDetailLevel);
    this.cache.set(uri.toString(), content);
    this.onDidChangeEmitter.fire(uri);
    this.lastSession = {
      sourceUri: sourceDocument.uri,
      mode,
      viewMode,
      paneMode,
      snippetMode,
      eduDetailLevel,
      lastOpenedAt: new Date().toISOString()
    };

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: this.resolveViewColumn(paneMode),
      preserveFocus: paneMode === "sideBySide"
    });
    this.logger.info(
      `Opened narration view for ${sourceDocument.uri.fsPath} mode=${mode} viewMode=${viewMode} paneMode=${paneMode} snippetMode=${snippetMode} eduDetailLevel=${eduDetailLevel}`
    );
  }

  getLastSession(): ReadingSessionState | undefined {
    return this.lastSession;
  }

  async openNarrationFromContext(
    options: Partial<ReadingSessionState> = {}
  ): Promise<boolean> {
    const activeEditor = vscode.window.activeTextEditor;
    const activeDocument = activeEditor?.document;
    if (activeDocument && activeDocument.uri.scheme !== "narrate") {
      await this.openNarrationView(activeDocument, options.mode ?? this.getDefaultNarrationMode(), {
        viewMode: options.viewMode ?? this.lastSession?.viewMode ?? this.getDefaultViewMode(),
        paneMode: options.paneMode ?? this.lastSession?.paneMode ?? this.getDefaultPaneMode(),
        snippetMode: options.snippetMode ?? this.lastSession?.snippetMode ?? this.getDefaultSnippetMode(),
        eduDetailLevel:
          options.eduDetailLevel ?? this.lastSession?.eduDetailLevel ?? this.getDefaultEduDetailLevel()
      });
      return true;
    }

    const fromActiveNarration = activeDocument ? this.tryParseNarrationUri(activeDocument.uri) : undefined;
    const sourceUri = options.sourceUri ?? fromActiveNarration?.sourceUri ?? this.lastSession?.sourceUri;
    if (!sourceUri) {
      return false;
    }

    try {
      const sourceDocument = await vscode.workspace.openTextDocument(sourceUri);
      const mode =
        options.mode ??
        fromActiveNarration?.mode ??
        this.lastSession?.mode ??
        this.getDefaultNarrationMode();
      const viewMode =
        options.viewMode ??
        fromActiveNarration?.viewMode ??
        this.lastSession?.viewMode ??
        this.getDefaultViewMode();
      const paneMode =
        options.paneMode ??
        fromActiveNarration?.paneMode ??
        this.lastSession?.paneMode ??
        this.getDefaultPaneMode();
      const snippetMode =
        options.snippetMode ??
        fromActiveNarration?.snippetMode ??
        this.lastSession?.snippetMode ??
        this.getDefaultSnippetMode();
      const eduDetailLevel =
        options.eduDetailLevel ??
        fromActiveNarration?.eduDetailLevel ??
        this.lastSession?.eduDetailLevel ??
        this.getDefaultEduDetailLevel();

      await this.openNarrationView(sourceDocument, mode, { viewMode, paneMode, snippetMode, eduDetailLevel });
      return true;
    } catch (error) {
      this.logger.warn(`Failed to reopen narration source: ${String(error)}`);
      return false;
    }
  }

  dispose(): void {
    this.onDidChangeEmitter.dispose();
  }

  private buildUri(
    filePath: string,
    mode: NarrationMode,
    viewMode: ReadingViewMode,
    paneMode: ReadingPaneMode,
    snippetMode: ReadingSnippetMode,
    eduDetailLevel: EduDetailLevel
  ): vscode.Uri {
    return vscode.Uri.parse(
      `narrate://read/${encodeURIComponent(filePath)}?mode=${mode}&view=${viewMode}&pane=${paneMode}&snippet=${snippetMode}&edu=${eduDetailLevel}&t=${Date.now().toString(36)}`
    );
  }

  private tryParseNarrationUri(uri: vscode.Uri): ReadingSessionState | undefined {
    if (uri.scheme !== "narrate" || uri.authority !== "read") {
      return undefined;
    }
    const encodedPath = uri.path.startsWith("/") ? uri.path.slice(1) : uri.path;
    if (!encodedPath) {
      return undefined;
    }

    let sourcePath = "";
    try {
      sourcePath = decodeURIComponent(encodedPath);
    } catch {
      return undefined;
    }

    const params = new URLSearchParams(uri.query);
    const modeParam = params.get("mode");
    const viewParam = params.get("view");
    const paneParam = params.get("pane");
    const snippetParam = params.get("snippet");
    const eduParam = params.get("edu");

    const mode: NarrationMode = modeParam === "edu" ? "edu" : "dev";
    const viewMode: ReadingViewMode = viewParam === "section" ? "section" : "exact";
    const paneMode: ReadingPaneMode = paneParam === "fullPage" ? "fullPage" : "sideBySide";
    const snippetMode: ReadingSnippetMode = snippetParam === "narrationOnly" ? "narrationOnly" : "withSource";
    const eduDetailLevel: EduDetailLevel =
      eduParam === "fullBeginner" ? "fullBeginner" : eduParam === "beginner" ? "beginner" : "standard";

    return {
      sourceUri: vscode.Uri.file(sourcePath),
      mode,
      viewMode,
      paneMode,
      snippetMode,
      eduDetailLevel,
      lastOpenedAt: new Date().toISOString()
    };
  }

  private resolveViewColumn(paneMode: ReadingPaneMode): vscode.ViewColumn {
    if (paneMode === "sideBySide") {
      return vscode.ViewColumn.Beside;
    }
    return vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Active;
  }

  private getDefaultNarrationMode(): NarrationMode {
    const configured = vscode.workspace.getConfiguration("narrate").get<string>("defaultMode", "dev");
    return configured === "edu" ? "edu" : "dev";
  }

  private getDefaultViewMode(): ReadingViewMode {
    const configured = vscode.workspace
      .getConfiguration("narrate")
      .get<string>("reading.defaultViewMode", "exact");
    return configured === "section" ? "section" : "exact";
  }

  private getDefaultPaneMode(): ReadingPaneMode {
    const configured = vscode.workspace
      .getConfiguration("narrate")
      .get<string>("reading.defaultPaneMode", "sideBySide");
    return configured === "fullPage" ? "fullPage" : "sideBySide";
  }

  private getDefaultSnippetMode(): ReadingSnippetMode {
    const configured = vscode.workspace
      .getConfiguration("narrate")
      .get<string>("reading.defaultSnippetMode", "withSource");
    return configured === "narrationOnly" ? "narrationOnly" : "withSource";
  }

  private getDefaultEduDetailLevel(): EduDetailLevel {
    const configured = vscode.workspace
      .getConfiguration("narrate")
      .get<string>("reading.defaultEduDetailLevel", "standard");
    if (configured === "fullBeginner") {
      return "fullBeginner";
    }
    return configured === "beginner" ? "beginner" : "standard";
  }
}
