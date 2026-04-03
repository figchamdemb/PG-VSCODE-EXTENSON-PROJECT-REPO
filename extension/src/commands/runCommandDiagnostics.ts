import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { runPowerShellCommand } from "../governance/powerShellRunner";
import { Logger } from "../utils/logger";
import { RepoRootResolution, resolveRepoRoot } from "../utils/repoRootResolver";
import { showPgRootGuidance } from "./pgRootGuidance";

type DiagnosticCategory = "Infrastructure" | "Extension" | "Data";

type DiagnosticPlan = {
  label: string;
  category: DiagnosticCategory;
  args: string[];
  fixHint: string;
};

type DiagnosticResult = {
  label: string;
  category: DiagnosticCategory;
  ok: boolean;
  output: string;
  fixHint: string;
};

const DIAGNOSTICS_DIR = path.join("Memory-bank", "_generated");
const DIAGNOSTICS_LATEST_FILE = "command-diagnostics-latest.md";
const DIAGNOSTICS_LATEST_JSON_FILE = "command-diagnostics-latest.json";

type DiagnosticArtifacts = {
  latestMarkdownPath: string;
  latestJsonPath: string;
  snapshotMarkdownPath: string;
  snapshotJsonPath: string;
};

export function registerRunCommandDiagnosticsCommand(
  logger: Logger
): vscode.Disposable {
  return vscode.commands.registerCommand(
    "narrate.runCommandDiagnostics",
    async () => runCommandDiagnostics(logger)
  );
}

async function runCommandDiagnostics(logger: Logger): Promise<void> {
  const repo = resolveRepoRoot();
  if (!repo) {
    await showPgRootGuidance("command diagnostics");
    return;
  }

  const results = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Narrate: Running command diagnostics",
      cancellable: false
    },
    async (progress) => runDiagnostics(repo, logger, progress)
  );

  const artifacts = await showDiagnosticsReport(results, repo);
  await showDiagnosticsCompletionMessage(results, artifacts);
  await maybeOfferTypeScriptRecoveryHint();
}

async function runDiagnostics(
  repo: RepoRootResolution,
  logger: Logger,
  progress: vscode.Progress<{ message?: string }>
): Promise<DiagnosticResult[]> {
  const plans = buildPlans(repo.pgScriptPath);
  const results: DiagnosticResult[] = [];
  for (const plan of plans) {
    progress.report({ message: plan.label });
    const result = await runPlan(plan, repo.repoRoot, logger);
    results.push(result);
  }
  return results;
}

function buildPlans(pgScriptPath: string): DiagnosticPlan[] {
  return [
    buildBackendHealthPlan(),
    buildSlackHealthPlan(),
    buildDevProfilePlan(pgScriptPath),
    buildGovernanceWorkerPlan(pgScriptPath),
    buildNarrateFlowPlan(pgScriptPath),
    buildExtensionCompilePlan(),
    buildDbIndexMaintenancePlan(pgScriptPath)
  ];
}

function buildBackendHealthPlan(): DiagnosticPlan {
  return {
    label: "Backend /health",
    category: "Infrastructure",
    args: [
      "-NoProfile",
      "-Command",
      "$r = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 8; if ($r.ok -eq $true) { Write-Output 'ok=true' } else { Write-Output ('ok=' + $r.ok); exit 2 }"
    ],
    fixHint: "Start backend: cd server && npm run start"
  };
}

function buildSlackHealthPlan(): DiagnosticPlan {
  return {
    label: "Slack integration health",
    category: "Infrastructure",
    args: [
      "-NoProfile",
      "-Command",
      "$r = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8787/integrations/slack/health' -TimeoutSec 8; if ($r.ok -eq $true -and $r.commands_enabled -eq $true) { Write-Output ('ok=true commands_enabled=' + $r.commands_enabled) } else { Write-Output ($r | ConvertTo-Json -Depth 5); exit 2 }"
    ],
    fixHint:
      "Ensure SLACK_COMMANDS_ENABLED=true and server is restarted with valid Slack env."
  };
}

function buildDevProfilePlan(pgScriptPath: string): DiagnosticPlan {
  return {
    label: "Local dev profile check",
    category: "Infrastructure",
    args: [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      pgScriptPath,
      "dev-profile",
      "-DevProfileAction",
      "check"
    ],
    fixHint:
      "Run: .\\pg.ps1 dev-profile -DevProfileAction init, then set required fields."
  };
}

function buildGovernanceWorkerPlan(pgScriptPath: string): DiagnosticPlan {
  return {
    label: "Governance worker one-shot",
    category: "Infrastructure",
    args: [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      pgScriptPath,
      "governance-worker",
      "-Once"
    ],
    fixHint:
      "If token missing, run governance-login first. If no events, create/finalize a new thread."
  };
}

function buildNarrateFlowPlan(pgScriptPath: string): DiagnosticPlan {
  return {
    label: "Narrate flow baseline check",
    category: "Extension",
    args: [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      pgScriptPath,
      "narrate-check",
      "-SkipCompile"
    ],
    fixHint:
      "Run .\\pg.ps1 narrate-check for full compile + flow wiring validation report."
  };
}

function buildExtensionCompilePlan(): DiagnosticPlan {
  return {
    label: "Extension TypeScript compile",
    category: "Extension",
    args: [
      "-NoProfile",
      "-Command",
      "Push-Location extension; npm run compile 2>&1 | Out-String; if ($LASTEXITCODE -ne 0) { exit 2 }; Pop-Location"
    ],
    fixHint:
      "Fix TypeScript errors shown in compile output, then retry."
  };
}

function buildDbIndexMaintenancePlan(pgScriptPath: string): DiagnosticPlan {
  return {
    label: "DB index maintenance check",
    category: "Data",
    args: [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      pgScriptPath,
      "db-index-check"
    ],
    fixHint:
      "Run .\\pg.ps1 db-index-fix-plan -DbMaxRows 5 to generate remediation SQL."
  };
}

async function runPlan(
  plan: DiagnosticPlan,
  workspaceRoot: string,
  logger: Logger
): Promise<DiagnosticResult> {
  try {
    const result = await runPowerShellCommand(plan.args, workspaceRoot);
    const output = normalizeOutput(result.stdout, result.stderr);
    logger.info(`Diagnostics: ${plan.label} -> PASS`);
    return { label: plan.label, category: plan.category, ok: true, output, fixHint: plan.fixHint };
  } catch (error) {
    const output = error instanceof Error ? error.message : String(error);
    logger.warn(`Diagnostics: ${plan.label} -> FAIL | ${output}`);
    return { label: plan.label, category: plan.category, ok: false, output, fixHint: plan.fixHint };
  }
}

async function showDiagnosticsReport(
  results: DiagnosticResult[],
  repo: RepoRootResolution
): Promise<DiagnosticArtifacts | null> {
  const createdAt = new Date();
  const markdown = buildDiagnosticsReportMarkdown(results, repo, createdAt);
  const doc = await vscode.workspace.openTextDocument({
    content: markdown,
    language: "markdown"
  });
  await vscode.window.showTextDocument(doc, { preview: false });
  const jsonPayload = buildDiagnosticsReportJson(results, repo, createdAt);
  return writeDiagnosticsArtifacts(markdown, jsonPayload, repo.repoRoot, createdAt);
}

function buildDiagnosticsReportMarkdown(
  results: DiagnosticResult[],
  repo: RepoRootResolution,
  createdAt: Date
): string {
  const lines: string[] = [];
  lines.push("# Narrate Command Diagnostics");
  lines.push("");
  lines.push(`UTC: ${createdAt.toISOString()}`);
  lines.push("");
  lines.push("## Context");
  lines.push("");
  lines.push(`- resolved_repo_root: ${repo.repoRoot}`);
  lines.push(`- resolved_pg_script: ${repo.pgScriptPath}`);
  lines.push(`- resolution_start_path: ${repo.startPath}`);
  lines.push("");
  const categories: DiagnosticCategory[] = ["Infrastructure", "Extension", "Data"];
  for (const cat of categories) {
    const group = results.filter((r) => r.category === cat);
    if (group.length === 0) continue;
    lines.push(`## ${cat}`);
    lines.push("");
    for (const result of group) {
      lines.push(`### ${result.ok ? "PASS" : "FAIL"} - ${result.label}`);
      lines.push("");
      lines.push("Output:");
      lines.push("```text");
      lines.push(result.output || "(no output)");
      lines.push("```");
      lines.push("");
      if (!result.ok) {
        lines.push(`Fix: ${result.fixHint}`);
        lines.push("");
      }
    }
  }
  return lines.join("\n");
}

function buildDiagnosticsReportJson(
  results: DiagnosticResult[],
  repo: RepoRootResolution,
  createdAt: Date
): string {
  const summary = {
    total: results.length,
    passed: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length
  };
  const payload = {
    generated_utc: createdAt.toISOString(),
    context: {
      resolved_repo_root: repo.repoRoot,
      resolved_pg_script: repo.pgScriptPath,
      resolution_start_path: repo.startPath
    },
    summary,
    checks: results.map((item) => ({
      label: item.label,
      category: item.category,
      ok: item.ok,
      output: item.output,
      fix_hint: item.fixHint
    }))
  };
  return JSON.stringify(payload, null, 2);
}

async function writeDiagnosticsArtifacts(
  markdown: string,
  jsonPayload: string,
  repoRoot: string,
  createdAt: Date
): Promise<DiagnosticArtifacts | null> {
  const targetDir = path.join(repoRoot, DIAGNOSTICS_DIR);
  try {
    await fs.mkdir(targetDir, { recursive: true });
    const latestMarkdownPath = path.join(targetDir, DIAGNOSTICS_LATEST_FILE);
    const latestJsonPath = path.join(targetDir, DIAGNOSTICS_LATEST_JSON_FILE);
    const timestampBase = buildTimestampedReportNameBase(createdAt);
    const snapshotMarkdownPath = path.join(targetDir, `${timestampBase}.md`);
    const snapshotJsonPath = path.join(targetDir, `${timestampBase}.json`);

    await fs.writeFile(latestMarkdownPath, markdown, "utf8");
    await fs.writeFile(latestJsonPath, jsonPayload, "utf8");
    await fs.writeFile(snapshotMarkdownPath, markdown, "utf8");
    await fs.writeFile(snapshotJsonPath, jsonPayload, "utf8");

    return {
      latestMarkdownPath,
      latestJsonPath,
      snapshotMarkdownPath,
      snapshotJsonPath
    };
  } catch {
    return null;
  }
}

function buildTimestampedReportNameBase(now: Date): string {
  const safeUtc = now.toISOString().replace(/[:.]/g, "-");
  return `command-diagnostics-${safeUtc}`;
}

async function showDiagnosticsCompletionMessage(
  results: DiagnosticResult[],
  artifacts: DiagnosticArtifacts | null
): Promise<void> {
  const failed = results.filter((item) => !item.ok).length;
  const level = failed === 0 ? "info" : "warn";
  const message = buildDiagnosticsCompletionMessage(failed, artifacts);
  const action = await showCompletionMessage(level, message, artifacts);
  if (!action || !artifacts) {
    return;
  }

  if (action === "Open Latest Report") {
    await vscode.commands.executeCommand(
      "vscode.open",
      vscode.Uri.file(artifacts.latestMarkdownPath)
    );
    return;
  }
  if (action === "Open Diagnostics Folder") {
    await vscode.commands.executeCommand(
      "revealFileInOS",
      vscode.Uri.file(artifacts.latestMarkdownPath)
    );
    return;
  }
  if (action === "Copy Latest Path") {
    await vscode.env.clipboard.writeText(artifacts.latestMarkdownPath);
    void vscode.window.showInformationMessage(
      "Narrate: copied diagnostics report path."
    );
  }
}

function buildDiagnosticsCompletionMessage(
  failed: number,
  artifacts: DiagnosticArtifacts | null
): string {
  if (!artifacts) {
    return failed === 0
      ? "Narrate: diagnostics passed."
      : `Narrate: diagnostics found ${failed} issue(s). See report for fixes.`;
  }
  if (failed === 0) {
    return `Narrate: diagnostics passed. Markdown + JSON saved in Memory-bank/_generated.`;
  }
  return `Narrate: diagnostics found ${failed} issue(s). Markdown + JSON saved in Memory-bank/_generated.`;
}

async function showCompletionMessage(
  level: "info" | "warn",
  message: string,
  artifacts: DiagnosticArtifacts | null
): Promise<string | undefined> {
  const actions = artifacts
    ? ["Open Latest Report", "Open Diagnostics Folder", "Copy Latest Path"]
    : [];
  if (level === "warn") {
    return vscode.window.showWarningMessage(message, ...actions);
  }
  return vscode.window.showInformationMessage(message, ...actions);
}

function normalizeOutput(stdout: string, stderr: string): string {
  const out = stdout.trim();
  const err = stderr.trim();
  if (out && err) {
    return `${out}\n${err}`;
  }
  return out || err;
}

async function maybeOfferTypeScriptRecoveryHint(): Promise<void> {
  const shouldShowHint = vscode.workspace
    .getConfiguration("narrate")
    .get<boolean>("trustScore.showDiagnosticsRecoveryHint", true);
  if (!shouldShowHint || !hasTypeScriptErrorDiagnostics()) {
    return;
  }

  const action = await vscode.window.showInformationMessage(
    "Narrate: TypeScript errors are still in Problems. If compile passed, run the TS auto-fix flow now.",
    "Run Auto Fix",
    "Open Problems"
  );
  if (action === "Run Auto Fix") {
    await vscode.commands.executeCommand("narrate.restartTypeScriptAndRefreshTrust");
    return;
  }
  if (action === "Open Problems") {
    await vscode.commands.executeCommand("workbench.actions.view.problems");
  }
}

function hasTypeScriptErrorDiagnostics(): boolean {
  return vscode.languages.getDiagnostics().some(([, diagnostics]) =>
    diagnostics.some(
      (item) =>
        item.severity === vscode.DiagnosticSeverity.Error &&
        typeof item.source === "string" &&
        item.source.toLowerCase().includes("ts")
    )
  );
}
