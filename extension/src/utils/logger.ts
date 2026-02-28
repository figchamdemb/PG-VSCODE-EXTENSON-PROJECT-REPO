import * as vscode from "vscode";
import { sanitizeLogMessage } from "./logSanitization";

export class Logger {
  private readonly output: vscode.OutputChannel;

  constructor(channelName = "Narrate") {
    this.output = vscode.window.createOutputChannel(channelName);
  }

  info(message: string): void {
    this.output.appendLine(`[INFO] ${sanitizeLogMessage(message)}`);
  }

  warn(message: string): void {
    this.output.appendLine(`[WARN] ${sanitizeLogMessage(message)}`);
  }

  error(message: string): void {
    this.output.appendLine(`[ERROR] ${sanitizeLogMessage(message)}`);
  }

  dispose(): void {
    this.output.dispose();
  }
}
