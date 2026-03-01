// PG Prod enforcement gate for pre-push — structured result + quick-action UX
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { runPowerShellCommand } from "../governance/powerShellRunner";
import { RepoRootResolution } from "../utils/repoRootResolver";

type ProdProfile = "auto" | "legacy" | "standard" | "strict";
type CheckStatus = "pass" | "blocked" | "error" | "skipped";

type EnforcementJsonResult = {
  phase: string;
  status: "pass" | "blocked" | "error" | "warn";
  blocker_count: number;
  warning_count: number;
  checks_run: string[];
  check_results: Record<string, CheckStatus>;
  warn_only: boolean;
};

export type EnforcementGateOutcome = {
  allowPush: boolean;
  status: "pass" | "blocked" | "error" | "skipped";
  profile: string;
  blockerCount: number;
  warningCount: number;
  failedChecks: string[];
  message: string;
  jsonResult?: EnforcementJsonResult;
};

export async function runEnforcementPrePushGate(
  repo: RepoRootResolution
): Promise<EnforcementGateOutcome> {
  const config = vscode.workspace.getConfiguration("narrate");

  if (!config.get<boolean>("enforcement.prePush.enabled", true)) {
    return buildSkipped("Enforcement preflight disabled.");
  }
  if (!fs.existsSync(repo.pgScriptPath)) {
    return buildError(`Missing pg command script at ${repo.pgScriptPath}`);
  }

  const profile = resolveProfile(config);
  const args = buildArgs(repo, config, profile);
  let rawOutput = "";

  try {
    const result = await runPowerShellCommand(args, repo.repoRoot);
    rawOutput = result.stdout;
  } catch (error) {
    rawOutput = error instanceof Error ? error.message : String(error);
    const parsed = parseJsonResult(rawOutput);

    if (parsed) {
      return buildFromParsed(parsed, profile, config);
    }
    return buildFromExitCode(error, rawOutput, profile);
  }

  const parsed = parseJsonResult(rawOutput);
  if (parsed) {
    return buildFromParsed(parsed, profile, config);
  }
  return { allowPush: true, status: "pass", profile, blockerCount: 0,
    warningCount: 0, failedChecks: [], message: "Enforcement preflight passed." };
}

export async function showEnforcementBlockedActions(
  outcome: EnforcementGateOutcome,
  repo: RepoRootResolution
): Promise<void> {
  if (outcome.allowPush || outcome.status === "skipped") {
    return;
  }

  const summaryParts: string[] = [];
  if (outcome.blockerCount > 0) {
    summaryParts.push(`${outcome.blockerCount} blocker(s)`);
  }
  if (outcome.warningCount > 0) {
    summaryParts.push(`${outcome.warningCount} warning(s)`);
  }
  if (outcome.failedChecks.length > 0) {
    summaryParts.push(`failed: ${outcome.failedChecks.join(", ")}`);
  }

  const detail = summaryParts.length > 0
    ? summaryParts.join(" — ")
    : outcome.message;

  const profileLabel = outcome.profile !== "auto"
    ? ` [profile: ${outcome.profile}]`
    : "";

  const actions: string[] = [
    "Run PG Prod in Terminal",
    "Open Enforcement Report"
  ];
  if (outcome.failedChecks.includes("coding")) {
    actions.push("Run PG Self-Check");
  }

  const picked = await vscode.window.showErrorMessage(
    `PG Push blocked${profileLabel}: ${detail}`,
    ...actions
  );

  if (picked === "Run PG Prod in Terminal") {
    await openProdTerminal(repo);
  } else if (picked === "Open Enforcement Report") {
    await openGateReport(repo);
  } else if (picked === "Run PG Self-Check") {
    await openSelfCheckTerminal(repo);
  }
}

export function writeGateReport(
  outcome: EnforcementGateOutcome,
  repo: RepoRootResolution
): void {
  const generatedDir = path.join(repo.repoRoot, "Memory-bank", "_generated");
  if (!fs.existsSync(generatedDir)) {
    return;
  }
  const reportPath = path.join(generatedDir, "enforcement-gate-latest.md");
  const lines: string[] = [
    "# Enforcement Gate Report",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Phase:** pre-push`,
    `**Profile:** ${outcome.profile}`,
    `**Status:** ${outcome.status}`,
    `**Blockers:** ${outcome.blockerCount}`,
    `**Warnings:** ${outcome.warningCount}`,
    ""
  ];

  if (outcome.failedChecks.length > 0) {
    lines.push("## Failed Checks");
    for (const check of outcome.failedChecks) {
      lines.push(`- **${check}**: blocked`);
    }
    lines.push("");
  }

  if (outcome.jsonResult?.check_results) {
    lines.push("## Check Results");
    lines.push("| Check | Status |");
    lines.push("|---|---|");
    for (const [check, status] of Object.entries(outcome.jsonResult.check_results)) {
      const icon = status === "pass" ? "✅" : status === "blocked" ? "❌"
        : status === "skipped" ? "⏭️" : "⚠️";
      lines.push(`| ${check} | ${icon} ${status} |`);
    }
    lines.push("");
  }

  lines.push("## Remediation");
  lines.push("");
  if (outcome.failedChecks.includes("dependency")) {
    lines.push("- **Dependency blockers:** Run `./pg.ps1 prod -ProdProfile legacy` to see dependency-only issues, then fix or update affected packages.");
  }
  if (outcome.failedChecks.includes("coding")) {
    lines.push("- **Coding blockers:** Run `./pg.ps1 self-check -WarnOnly` to see coding standard violations. Fix files over 500 lines, oversized functions, missing input validation, or query optimization issues.");
  }
  if (outcome.failedChecks.includes("db-index")) {
    lines.push("- **DB index blockers:** Run `./pg.ps1 db-index-fix-plan` to generate a remediation SQL checklist.");
  }
  lines.push("");
  lines.push("---");
  lines.push("*Generated by Narrate PG Push enforcement gate.*");

  try {
    fs.writeFileSync(reportPath, lines.join("\n"), "utf-8");
  } catch {
    // non-critical — silently skip if write fails
  }
}

// ── Internal helpers ──

function resolveProfile(config: vscode.WorkspaceConfiguration): string {
  const raw = config.get<ProdProfile>("enforcement.prePush.prodProfile", "auto");
  if (raw === "auto") {
    return "standard";
  }
  return raw;
}

function buildArgs(
  repo: RepoRootResolution,
  config: vscode.WorkspaceConfiguration,
  profile: string
): string[] {
  const args = [
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", repo.pgScriptPath,
    "enforce-trigger", "-Phase", "pre-push",
    "-Json"
  ];

  if (config.get<boolean>("enforcement.prePush.warnOnly", false)) {
    args.push("-WarnOnly");
  }

  const apiBase = config.get<string>("licensing.apiBaseUrl", "").trim();
  if (apiBase) {
    args.push("-ApiBase", apiBase);
  }

  const framework = config.get<string>(
    "enforcement.projectFramework", "unknown"
  ).trim() || "unknown";
  args.push("-ProjectFramework", framework);

  if (profile === "standard" || profile === "strict") {
    args.push("-EnableDbIndexMaintenanceCheck");
  }

  return args;
}

function parseJsonResult(rawOutput: string): EnforcementJsonResult | undefined {
  const marker = "PG_ENFORCEMENT_JSON:";
  const idx = rawOutput.indexOf(marker);
  if (idx < 0) {
    return undefined;
  }
  const jsonStart = idx + marker.length;
  const lineEnd = rawOutput.indexOf("\n", jsonStart);
  const jsonStr = lineEnd < 0
    ? rawOutput.slice(jsonStart).trim()
    : rawOutput.slice(jsonStart, lineEnd).trim();
  try {
    return JSON.parse(jsonStr) as EnforcementJsonResult;
  } catch {
    return undefined;
  }
}

function buildFromParsed(
  parsed: EnforcementJsonResult,
  profile: string,
  config: vscode.WorkspaceConfiguration
): EnforcementGateOutcome {
  const failedChecks = Object.entries(parsed.check_results)
    .filter(([, s]) => s === "blocked")
    .map(([name]) => name);

  const isWarnOnly = config.get<boolean>("enforcement.prePush.warnOnly", false);

  if (parsed.status === "pass") {
    return {
      allowPush: true, status: "pass", profile,
      blockerCount: 0, warningCount: parsed.warning_count,
      failedChecks: [], message: "Enforcement preflight passed.",
      jsonResult: parsed
    };
  }

  if (parsed.status === "blocked") {
    const allow = isWarnOnly || parsed.warn_only;
    return {
      allowPush: allow,
      status: "blocked", profile,
      blockerCount: parsed.blocker_count,
      warningCount: parsed.warning_count,
      failedChecks,
      message: allow
        ? `Enforcement found ${parsed.blocker_count} blocker(s) (warn mode — continuing).`
        : `Enforcement blocked: ${parsed.blocker_count} blocker(s) in ${failedChecks.join(", ")}.`,
      jsonResult: parsed
    };
  }

  // error or warn
  const allow = isWarnOnly || parsed.warn_only;
  return {
    allowPush: allow,
    status: parsed.status === "warn" ? "blocked" : "error",
    profile,
    blockerCount: parsed.blocker_count,
    warningCount: parsed.warning_count,
    failedChecks,
    message: allow
      ? `Enforcement encountered issues (warn mode — continuing).`
      : `Enforcement failed with ${parsed.blocker_count} blocker(s).`,
    jsonResult: parsed
  };
}

function buildFromExitCode(
  error: unknown,
  rawOutput: string,
  profile: string
): EnforcementGateOutcome {
  const code = getExitCode(error);
  if (code === 2 || rawOutput.toLowerCase().includes("blocked by policy violations")) {
    return {
      allowPush: false, status: "blocked", profile,
      blockerCount: 1, warningCount: 0, failedChecks: ["unknown"],
      message: "Enforcement blocked by policy violations. Run `./pg.ps1 prod` to see details."
    };
  }
  return {
    allowPush: false, status: "error", profile,
    blockerCount: 0, warningCount: 0, failedChecks: [],
    message: `Enforcement preflight failed: ${rawOutput.slice(0, 300)}`
  };
}

function buildSkipped(reason: string): EnforcementGateOutcome {
  return {
    allowPush: true, status: "skipped", profile: "none",
    blockerCount: 0, warningCount: 0, failedChecks: [],
    message: reason
  };
}

function buildError(reason: string): EnforcementGateOutcome {
  return {
    allowPush: false, status: "error", profile: "none",
    blockerCount: 0, warningCount: 0, failedChecks: [],
    message: reason
  };
}

function getExitCode(error: unknown): number | undefined {
  const raw = (error as { code?: unknown })?.code;
  if (typeof raw === "number") { return raw; }
  if (typeof raw === "string" && /^\d+$/u.test(raw)) { return Number(raw); }
  return undefined;
}

async function openProdTerminal(repo: RepoRootResolution): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: "PG Prod",
    cwd: repo.repoRoot
  });
  terminal.show();
  terminal.sendText(".\\pg.ps1 prod");
}

async function openSelfCheckTerminal(repo: RepoRootResolution): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: "PG Self-Check",
    cwd: repo.repoRoot
  });
  terminal.show();
  terminal.sendText(".\\pg.ps1 self-check -WarnOnly");
}

async function openGateReport(repo: RepoRootResolution): Promise<void> {
  const reportPath = path.join(
    repo.repoRoot, "Memory-bank", "_generated", "enforcement-gate-latest.md"
  );
  if (fs.existsSync(reportPath)) {
    const doc = await vscode.workspace.openTextDocument(reportPath);
    await vscode.window.showTextDocument(doc, { preview: true });
  } else {
    vscode.window.showWarningMessage(
      "No enforcement gate report found. Run PG Prod first to generate one."
    );
  }
}
