import * as vscode from "vscode";
import { Logger } from "../utils/logger";
import { buildCommandHelpHtml } from "./commandHelpContent";

export class CommandHelpViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "narrate.commandHelpView";
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: false
    };
    webviewView.webview.html = buildCommandHelpHtml();
    this.logger.info("Command Help view rendered.");
  }
}
