import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import {
  resolveStartupContext,
  StartupContextResolution
} from "./startupContextResolver";

export type StartupStatus = "passed" | "failed";
export type WorkspaceEvidence = "pg" | "memory-bank" | "agents";

export type StartupSessionRecord = {
  day: string;
  status: StartupStatus;
  lastAttemptAtUtc: string;
  lastSuccessAtUtc?: string;
  lastError?: string;
};

type StartupSessionMap = Record<string, StartupSessionRecord>;

export type WorkspaceEnforcementState = {
  mode: "active" | "stopped";
  updatedAtUtc: string;
  stopReason?: string;
  lastKnownLabel?: string;
  lastKnownWorkspacePath?: string;
  lastKnownAgentsPath?: string;
  lastKnownEvidence?: WorkspaceEvidence;
};

type WorkspaceEnforcementMap = Record<string, WorkspaceEnforcementState>;

export type WorkspaceEnforcementTarget = {
  key: string;
  label: string;
  workspacePath: string;
  workspaceUri: vscode.Uri;
  agentsPath?: string;
  evidence: WorkspaceEvidence;
  resolution?: StartupContextResolution;
};

const STORAGE_KEY = "narrate.startupContextSessions.v1";
const ENFORCEMENT_STORAGE_KEY = "narrate.mandatoryWorkspaceEnforcement.v1";
const PROMPT_COOLDOWN_MS = 15 * 1000;

export function getStartupRecord(
  context: vscode.ExtensionContext,
  key: string
): StartupSessionRecord | undefined {
  const all = context.workspaceState.get<StartupSessionMap>(STORAGE_KEY, {});
  return all[key];
}

export function setStartupRecord(
  context: vscode.ExtensionContext,
  key: string,
  record: StartupSessionRecord
): void {
  const all = context.workspaceState.get<StartupSessionMap>(STORAGE_KEY, {});
  all[key] = record;
  void context.workspaceState.update(STORAGE_KEY, all);
}

export function getEnforcementState(
  context: vscode.ExtensionContext,
  key: string
): WorkspaceEnforcementState | undefined {
  const all = context.workspaceState.get<WorkspaceEnforcementMap>(
    ENFORCEMENT_STORAGE_KEY,
    {}
  );
  return all[key];
}

export function setEnforcementState(
  context: vscode.ExtensionContext,
  key: string,
  state: WorkspaceEnforcementState
): void {
  const all = context.workspaceState.get<WorkspaceEnforcementMap>(
    ENFORCEMENT_STORAGE_KEY,
    {}
  );
  all[key] = state;
  void context.workspaceState.update(ENFORCEMENT_STORAGE_KEY, all);
}

export function ensureEnforcementState(
  context: vscode.ExtensionContext,
  target: WorkspaceEnforcementTarget
): WorkspaceEnforcementState {
  const existing = getEnforcementState(context, target.key);
  const desired: WorkspaceEnforcementState = {
    mode: existing?.mode ?? "active",
    updatedAtUtc: existing?.updatedAtUtc ?? new Date().toISOString(),
    stopReason: existing?.stopReason,
    lastKnownLabel: target.label,
    lastKnownWorkspacePath: target.workspacePath,
    lastKnownAgentsPath: target.agentsPath,
    lastKnownEvidence: target.evidence
  };

  if (!existing || hasEnforcementMetadataChanged(existing, desired)) {
    setEnforcementState(context, target.key, desired);
    return desired;
  }

  return existing;
}

export function resolveWorkspaceTarget(
  seedUri?: vscode.Uri
): WorkspaceEnforcementTarget | undefined {
  const resolution = resolveStartupContext({ seedUri });
  if (resolution) {
    const workspaceFolder =
      vscode.workspace.getWorkspaceFolder(vscode.Uri.file(resolution.contextDirectory)) ||
      pickWorkspaceFolder(seedUri);
    const workspacePath = workspaceFolder?.uri.fsPath ?? resolution.repo.repoRoot;
    return {
      key: toWorkspaceKey(workspacePath),
      label: resolution.label,
      workspacePath,
      workspaceUri: vscode.Uri.file(workspacePath),
      agentsPath: resolution.agentsPath,
      evidence: "pg",
      resolution
    };
  }

  const workspaceFolder = pickWorkspaceFolder(seedUri);
  if (!workspaceFolder) {
    return undefined;
  }

  const workspacePath = workspaceFolder.uri.fsPath;
  const agentsPath = path.join(workspacePath, "AGENTS.md");
  const memoryBankPath = path.join(workspacePath, "Memory-bank");
  const hasAgents = fs.existsSync(agentsPath);
  const hasMemoryBank = fs.existsSync(memoryBankPath);
  if (!hasAgents && !hasMemoryBank) {
    return undefined;
  }

  return {
    key: toWorkspaceKey(workspacePath),
    label: workspaceFolder.name || path.basename(workspacePath) || "current workspace",
    workspacePath,
    workspaceUri: workspaceFolder.uri,
    agentsPath: hasAgents ? agentsPath : undefined,
    evidence: hasMemoryBank ? "memory-bank" : "agents"
  };
}

export function isPromptCoolingDown(
  promptTimestamps: Map<string, number>,
  promptKey: string
): boolean {
  const lastPromptAt = promptTimestamps.get(promptKey);
  const now = Date.now();
  if (lastPromptAt && now - lastPromptAt < PROMPT_COOLDOWN_MS) {
    return true;
  }
  promptTimestamps.set(promptKey, now);
  return false;
}

export function buildPromptActions(target: WorkspaceEnforcementTarget): string[] {
  const actions = target.resolution ? ["Run Startup Now"] : ["Retry Detection"];
  if (target.agentsPath) {
    actions.push("Open AGENTS.md");
  }
  actions.push("Reveal Workspace", "Stop Enforcement");
  return actions;
}

export function buildTooltip(
  resolution: StartupContextResolution,
  headline: string,
  record?: StartupSessionRecord
): string {
  const lines = [
    headline,
    `Context: ${resolution.label}`,
    `Repo root: ${resolution.repo.repoRoot}`
  ];
  if (resolution.agentsPath) {
    lines.push(`AGENTS: ${resolution.agentsPath}`);
  }
  if (record?.lastSuccessAtUtc) {
    lines.push(`Last success: ${record.lastSuccessAtUtc}`);
  }
  if (record?.lastError) {
    lines.push(`Last error: ${truncateMessage(record.lastError)}`);
  }
  return lines.join("\n");
}

export function currentUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return summarizeStartupCliMessage(raw);
}

export function truncateMessage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= 220) {
    return trimmed;
  }
  return `${trimmed.slice(0, 217)}...`;
}

function pickWorkspaceFolder(seedUri?: vscode.Uri): vscode.WorkspaceFolder | undefined {
  if (seedUri) {
    const seeded = vscode.workspace.getWorkspaceFolder(seedUri);
    if (seeded) {
      return seeded;
    }
  }
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const active = vscode.workspace.getWorkspaceFolder(activeUri);
    if (active) {
      return active;
    }
  }
  return vscode.workspace.workspaceFolders?.[0];
}

function toWorkspaceKey(workspacePath: string): string {
  return `workspace:${path.resolve(workspacePath).toLowerCase()}`;
}

function hasEnforcementMetadataChanged(
  current: WorkspaceEnforcementState,
  desired: WorkspaceEnforcementState
): boolean {
  return (
    current.lastKnownLabel !== desired.lastKnownLabel ||
    current.lastKnownWorkspacePath !== desired.lastKnownWorkspacePath ||
    current.lastKnownAgentsPath !== desired.lastKnownAgentsPath ||
    current.lastKnownEvidence !== desired.lastKnownEvidence
  );
}

function summarizeStartupCliMessage(raw: string): string {
  const cleaned = stripAnsiArtifacts(raw)
    .replace(/\r/g, "")
    .trim();
  if (!cleaned) {
    return "Startup failed for this context.";
  }

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isShellNoiseLine(line));

  if (!lines.length) {
    return cleaned;
  }

  const preferredStart = lines.findIndex(
    (line) =>
      line.startsWith("Map-structure gate:") ||
      line.startsWith("Dev profile") ||
      line.startsWith("Local dev profile") ||
      line.startsWith("start_memory_bank_session.py failed") ||
      line.startsWith("generate_memory_bank.py failed") ||
      line.startsWith("build_frontend_summary.py failed")
  );

  const relevant = preferredStart >= 0 ? lines.slice(preferredStart) : lines;
  return relevant.join(" ");
}

function stripAnsiArtifacts(value: string): string {
  return value
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\[[0-9;]+m/g, "");
}

function isShellNoiseLine(line: string): boolean {
  return (
    line === "Line |" ||
    /^\d+\s*\|/.test(line) ||
    /^~+$/.test(line) ||
    line.startsWith("Exception:") ||
    line.startsWith("Command failed:") ||
    line.startsWith("Command exited with code")
  );
}