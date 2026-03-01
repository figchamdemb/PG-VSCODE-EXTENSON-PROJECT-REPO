import * as vscode from "vscode";
import { NarrationEngine } from "../narration/narrationEngine";
import { getCurrentMode } from "./modeState";

export function registerRequestChangePromptCommand(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.requestChangePrompt", async () => {
    await runRequestChangePrompt(context, narrationEngine);
  });
}

async function runRequestChangePrompt(
  context: vscode.ExtensionContext, narrationEngine: NarrationEngine
): Promise<void> {
  const editorCtx = getEditorContext();
  if (!editorCtx) return;
  const userRequest = await getUserChangeRequest();
  if (!userRequest) return;
  const { document, startLine, endLine } = editorCtx;
  const mode = getCurrentMode(context);
  const codeSnippet = document.getText(
    new vscode.Range(startLine - 1, 0, endLine - 1, document.lineAt(endLine - 1).text.length)
  );
  const narrations = await narrationEngine.narrateRange(document, mode, startLine, endLine);
  const prompt = buildChangePrompt({ filePath: document.uri.fsPath, startLine, endLine, codeSnippet, narrationMode: mode, narrations, userRequest });
  await presentPrompt(prompt);
}

function getEditorContext(): { document: vscode.TextDocument; startLine: number; endLine: number } | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { vscode.window.showWarningMessage("Narrate: open a source file first."); return null; }
  const sel = editor.selection;
  const hasSelection = !sel.isEmpty;
  return {
    document: editor.document,
    startLine: (hasSelection ? sel.start.line : sel.active.line) + 1,
    endLine: (hasSelection ? sel.end.line : sel.active.line) + 1
  };
}

async function getUserChangeRequest(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title: "Narrate Request Change", prompt: "Describe the change you want",
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? undefined : "Change request cannot be empty.")
  });
}

async function presentPrompt(prompt: string): Promise<void> {
  await vscode.env.clipboard.writeText(prompt);
  const doc = await vscode.workspace.openTextDocument({ content: prompt, language: "markdown" });
  await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
  vscode.window.showInformationMessage("Narrate: prompt copied to clipboard.");
}

interface PromptPayload {
  filePath: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  narrationMode: "dev" | "edu";
  narrations: Array<{ lineNumber: number; narration: string }>;
  userRequest: string;
}

function buildChangePrompt(payload: PromptPayload): string {
  const narrationBlock = payload.narrations.length > 0
    ? payload.narrations.map((i) => `- [${i.lineNumber}] ${i.narration}`).join("\n")
    : "- No narration available for selected lines.";
  return [
    "You are editing a codebase. Apply the smallest possible change.", "",
    `File: ${payload.filePath}`, `Target lines: ${payload.startLine}-${payload.endLine}`, "",
    "Current code:", "```", payload.codeSnippet, "```", "",
    `Current meaning (${payload.narrationMode}):`, narrationBlock, "",
    "Change request:", payload.userRequest, "",
    "Constraints:", "- Do not modify unrelated files unless strictly necessary.",
    "- Keep behavior unchanged outside requested scope.", "- Prefer minimal unified diff.", "",
    "Output:", "- Provide a unified diff patch only."
  ].join("\n");
}
