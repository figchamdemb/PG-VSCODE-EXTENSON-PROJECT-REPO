import * as vscode from "vscode";

export class Logger {
  private readonly output: vscode.OutputChannel;

  constructor(channelName = "Narrate") {
    this.output = vscode.window.createOutputChannel(channelName);
  }

  info(message: string): void {
    this.output.appendLine(`[INFO] ${message}`);
  }

  warn(message: string): void {
    this.output.appendLine(`[WARN] ${message}`);
  }

  error(message: string): void {
    this.output.appendLine(`[ERROR] ${message}`);
  }

  dispose(): void {
    this.output.dispose();
  }
}
