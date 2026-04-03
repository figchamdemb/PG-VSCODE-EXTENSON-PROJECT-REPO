import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { Logger } from "../utils/logger";
import { StartupContextEnforcer } from "./startupContextEnforcer";

type BridgeAction = "stop" | "resume";

type BridgePayload = {
  request_id?: string;
  action?: BridgeAction;
  requested_at_utc?: string;
  source?: string;
  status?: "pending" | "applied" | "failed";
  handled_at_utc?: string;
  message?: string;
};

const BRIDGE_FILE_NAME = "pg-enforcement-bridge.json";

export class StartupEnforcementBridge implements vscode.Disposable {
  private readonly watchers: vscode.FileSystemWatcher[] = [];
  private readonly handledRequestIds = new Set<string>();

  constructor(
    private readonly startupContextEnforcer: StartupContextEnforcer,
    private readonly logger: Logger
  ) {}

  async initialize(): Promise<void> {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      this.watchWorkspace(folder);
      await this.processBridgeFile(folder.uri.fsPath);
    }
  }

  async onDidChangeWorkspaceFolders(): Promise<void> {
    this.disposeWatchers();
    await this.initialize();
  }

  dispose(): void {
    this.disposeWatchers();
  }

  private watchWorkspace(folder: vscode.WorkspaceFolder): void {
    const pattern = new vscode.RelativePattern(
      folder,
      path.join("Memory-bank", "_generated", BRIDGE_FILE_NAME).replace(/\\/g, "/")
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const handler = () => void this.processBridgeFile(folder.uri.fsPath);
    watcher.onDidChange(handler);
    watcher.onDidCreate(handler);
    this.watchers.push(watcher);
  }

  private async processBridgeFile(workspacePath: string): Promise<void> {
    const bridgePath = path.join(workspacePath, "Memory-bank", "_generated", BRIDGE_FILE_NAME);
    if (!fs.existsSync(bridgePath)) {
      return;
    }

    let payload: BridgePayload;
    try {
      payload = JSON.parse(fs.readFileSync(bridgePath, "utf8")) as BridgePayload;
    } catch (error) {
      this.logger.warn(`Startup enforcement bridge: invalid payload at ${bridgePath} :: ${String(error)}`);
      return;
    }

    if (!payload.request_id || !payload.action || payload.status === "applied") {
      return;
    }
    if (this.handledRequestIds.has(payload.request_id)) {
      return;
    }

    this.handledRequestIds.add(payload.request_id);
    const result = await this.startupContextEnforcer.applyMandatoryEnforcementBridgeAction(
      vscode.Uri.file(workspacePath),
      payload.action,
      payload.source || "pg-cli"
    );

    const nextPayload: BridgePayload = {
      ...payload,
      status: result.ok ? "applied" : "failed",
      handled_at_utc: new Date().toISOString(),
      message: result.message
    };
    try {
      fs.writeFileSync(bridgePath, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf8");
    } catch (error) {
      this.logger.warn(`Startup enforcement bridge: failed to write ack at ${bridgePath} :: ${String(error)}`);
    }
  }

  private disposeWatchers(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers.length = 0;
  }
}