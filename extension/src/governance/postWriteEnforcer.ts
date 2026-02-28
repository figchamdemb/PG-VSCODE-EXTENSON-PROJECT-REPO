import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { runPowerShellCommand } from "./powerShellRunner";
import { Logger } from "../utils/logger";
import { resolveRepoRoot } from "../utils/repoRootResolver";

type PendingTimer = ReturnType<typeof setTimeout>;

export class PostWriteEnforcer implements vscode.Disposable {
  private readonly logger: Logger;
  private readonly timers = new Map<string, PendingTimer>();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async onDidSaveTextDocument(document: vscode.TextDocument): Promise<void> {
    if (document.isUntitled || document.uri.scheme !== "file") {
      return;
    }
    if (!this.isEnabled()) {
      return;
    }
    const filePath = document.uri.fsPath;
    if (this.shouldSkipPath(filePath)) {
      return;
    }
    const repo = resolveRepoRoot({ seedUri: document.uri });
    if (!repo) {
      return;
    }

    const existing = this.timers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const debounceMs = this.getDebounceMs();
    const timer = setTimeout(() => {
      this.timers.delete(filePath);
      void this.runEnforcement(repo.repoRoot, repo.pgScriptPath, filePath);
    }, debounceMs);
    this.timers.set(filePath, timer);
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private async runEnforcement(
    workspaceRoot: string,
    pgScriptPath: string,
    filePath: string
  ): Promise<void> {
    if (!fs.existsSync(pgScriptPath)) {
      this.logger.warn(`Post-write enforcement skipped: missing pg script at ${pgScriptPath}`);
      return;
    }

    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      pgScriptPath,
      "enforce-trigger",
      "-Phase",
      "post-write",
      "-ChangedPath",
      filePath
    ];

    if (this.isWarnOnly()) {
      args.push("-WarnOnly");
    }

    const apiBase = this.getApiBase();
    if (apiBase) {
      args.push("-ApiBase", apiBase);
    }

    const projectFramework = this.getProjectFramework();
    if (projectFramework) {
      args.push("-ProjectFramework", projectFramework);
    }

    try {
      const result = await runPowerShellCommand(args, workspaceRoot);
      if (result.stdout) {
        this.logger.info(`[post-write] ${path.basename(filePath)} :: ${result.stdout}`);
      }
      if (result.stderr) {
        this.logger.warn(`[post-write] ${path.basename(filePath)} stderr :: ${result.stderr}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorCode = getExitCode(error);
      const lowered = message.toLowerCase();
      const isPolicyBlocker =
        errorCode === 2 ||
        lowered.includes("blocked by policy violations") ||
        lowered.includes("exit code 2");
      if (isPolicyBlocker) {
        this.logger.warn(`[post-write] policy blocker after save: ${filePath} :: ${message}`);
        if (this.shouldShowNotifications()) {
          void vscode.window.showWarningMessage(
            "Narrate: policy blockers found after save. Check the Narrate output channel."
          );
        }
        return;
      }
      this.logger.error(`[post-write] enforcement failed for ${filePath} :: ${message}`);
      if (this.shouldShowNotifications()) {
        void vscode.window.showWarningMessage(
          "Narrate: post-write enforcement failed. Check local PG server/token and output channel."
        );
      }
    }
  }

  private shouldSkipPath(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, "/").toLowerCase();
    if (normalized.includes("/node_modules/")) {
      return true;
    }
    if (normalized.includes("/.git/")) {
      return true;
    }
    return false;
  }

  private isEnabled(): boolean {
    const config = vscode.workspace.getConfiguration("narrate");
    return config.get<boolean>("enforcement.postWrite.enabled", true);
  }

  private isWarnOnly(): boolean {
    const config = vscode.workspace.getConfiguration("narrate");
    return config.get<boolean>("enforcement.postWrite.warnOnly", true);
  }

  private getDebounceMs(): number {
    const config = vscode.workspace.getConfiguration("narrate");
    const value = config.get<number>("enforcement.postWrite.debounceMs", 1200);
    if (!Number.isFinite(value)) {
      return 1200;
    }
    return Math.max(200, Math.floor(value));
  }

  private shouldShowNotifications(): boolean {
    const config = vscode.workspace.getConfiguration("narrate");
    return config.get<boolean>("enforcement.postWrite.showNotifications", false);
  }

  private getApiBase(): string {
    const config = vscode.workspace.getConfiguration("narrate");
    return config.get<string>("licensing.apiBaseUrl", "").trim();
  }

  private getProjectFramework(): string {
    const config = vscode.workspace.getConfiguration("narrate");
    return config.get<string>("enforcement.projectFramework", "unknown").trim() || "unknown";
  }
}

function getExitCode(error: unknown): number | undefined {
  const raw = (error as { code?: unknown })?.code;
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    return Number(raw);
  }
  return undefined;
}
