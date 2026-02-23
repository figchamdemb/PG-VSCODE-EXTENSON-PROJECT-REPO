import * as vscode from "vscode";
import { NarrationEngine } from "../narration/narrationEngine";
import { getCurrentMode } from "./modeState";

export function registerRequestChangePromptCommand(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.requestChangePrompt", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("Narrate: open a source file first.");
      return;
    }

    const document = editor.document;
    const selection = editor.selection;
    const hasSelection = !selection.isEmpty;
    const startLine = (hasSelection ? selection.start.line : editor.selection.active.line) + 1;
    const endLine = (hasSelection ? selection.end.line : editor.selection.active.line) + 1;
    const mode = getCurrentMode(context);

    const userRequest = await vscode.window.showInputBox({
      title: "Narrate Request Change",
      prompt: "Describe the change you want",
      ignoreFocusOut: true,
      validateInput(value) {
        if (!value.trim()) {
          return "Change request cannot be empty.";
        }
        return undefined;
      }
    });
    if (!userRequest) {
      return;
    }

    const codeSnippet = document.getText(
      new vscode.Range(startLine - 1, 0, endLine - 1, document.lineAt(endLine - 1).text.length)
    );
    const narrations = await narrationEngine.narrateRange(document, mode, startLine, endLine);
    const prompt = buildChangePrompt({
      filePath: document.uri.fsPath,
      startLine,
      endLine,
      codeSnippet,
      narrationMode: mode,
      narrations,
      userRequest
    });

    await vscode.env.clipboard.writeText(prompt);
    const promptDoc = await vscode.workspace.openTextDocument({ content: prompt, language: "markdown" });
    await vscode.window.showTextDocument(promptDoc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
    vscode.window.showInformationMessage("Narrate: prompt copied to clipboard.");
  });
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
  const narrationBlock =
    payload.narrations.length > 0
      ? payload.narrations.map((item) => `- [${item.lineNumber}] ${item.narration}`).join("\n")
      : "- No narration available for selected lines.";

  return [
    "You are editing a codebase. Apply the smallest possible change.",
    "",
    `File: ${payload.filePath}`,
    `Target lines: ${payload.startLine}-${payload.endLine}`,
    "",
    "Current code:",
    "```",
    payload.codeSnippet,
    "```",
    "",
    `Current meaning (${payload.narrationMode}):`,
    narrationBlock,
    "",
    "Change request:",
    payload.userRequest,
    "",
    "Constraints:",
    "- Do not modify unrelated files unless strictly necessary.",
    "- Keep behavior unchanged outside requested scope.",
    "- Prefer minimal unified diff.",
    "",
    "Output:",
    "- Provide a unified diff patch only."
  ].join("\n");
}
