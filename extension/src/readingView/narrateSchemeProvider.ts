import * as vscode from "vscode";
import { NarrationEngine } from "../narration/narrationEngine";
import { NarrationMode } from "../types";
import { Logger } from "../utils/logger";
import { renderNarrationDocument } from "./renderNarration";

export class NarrateSchemeProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly cache = new Map<string, string>();

  readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(private readonly narrationEngine: NarrationEngine, private readonly logger: Logger) {}

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.cache.get(uri.toString()) ?? "Narration content not ready.";
  }

  async openNarrationView(sourceDocument: vscode.TextDocument, mode: NarrationMode): Promise<void> {
    const narrationMap = await this.narrationEngine.narrateDocument(sourceDocument, mode);
    const content = renderNarrationDocument(sourceDocument, mode, narrationMap);

    const uri = this.buildUri(sourceDocument.uri.fsPath, mode);
    this.cache.set(uri.toString(), content);
    this.onDidChangeEmitter.fire(uri);

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
    this.logger.info(`Opened narration view for ${sourceDocument.uri.fsPath} mode=${mode}`);
  }

  dispose(): void {
    this.onDidChangeEmitter.dispose();
  }

  private buildUri(filePath: string, mode: NarrationMode): vscode.Uri {
    return vscode.Uri.parse(
      `narrate://read/${encodeURIComponent(filePath)}?mode=${mode}&t=${Date.now().toString(36)}`
    );
  }
}
