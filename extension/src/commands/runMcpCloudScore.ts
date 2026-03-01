// MCP Cloud Score check — extension command + structured result + report
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { runPowerShellCommand } from "../governance/powerShellRunner";
import { RepoRootResolution, resolveRepoRoot } from "../utils/repoRootResolver";
import { Logger } from "../utils/logger";

// ── Types ────────────────────────────────────────────────────────────

type FindingSeverity = "blocker" | "warning";

interface CloudScoreFinding {
  rule_id: string;
  severity: FindingSeverity;
  source: string;
  scanner_id: string | null;
  message: string;
  hint: string;
}

interface CloudScoreSummary {
  scanners: number;
  scanner_blockers: number;
  scanner_warnings: number;
  architecture_blockers: number;
  architecture_warnings: number;
  blockers: number;
  warnings: number;
  workload_sensitivity: string;
  source: string;
  evaluated_at: string;
}

interface CloudScoreResult {
  ok: boolean;
  status: "pass" | "blocked";
  evaluator_version: string;
  score: number;
  grade: string;
  summary: CloudScoreSummary;
  findings: CloudScoreFinding[];
}

// ── Constants ────────────────────────────────────────────────────────

const REPORT_FILE = "mcp-cloud-score-latest.md";
const GENERATED_DIR = "Memory-bank/_generated";

// ── Public API ───────────────────────────────────────────────────────

export function registerRunMcpCloudScoreCommand(
  logger: Logger
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.runMcpCloudScore", async () => {
    try {
      await runMcpCloudScore(logger);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: MCP cloud score check failed. ${msg}`);
    }
  });
}

// ── Main flow ────────────────────────────────────────────────────────

async function runMcpCloudScore(logger: Logger): Promise<void> {
  const repo = resolveRepoRoot();
  if (!repo) { vscode.window.showWarningMessage("Narrate: open a workspace with pg.ps1 before running MCP cloud score."); return; }
  const scriptPath = path.join(repo.repoRoot, "scripts", "mcp_cloud_score_verify.ps1");
  if (!fs.existsSync(scriptPath)) { vscode.window.showWarningMessage("Narrate: mcp_cloud_score_verify.ps1 not found."); return; }
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Narrate: Running MCP cloud score check…", cancellable: false },
    async () => executeCloudScore(repo, scriptPath, logger)
  );
  writeCloudScoreReport(result, repo);
  await showCloudScoreResult(result, repo);
}

// ── Execution ────────────────────────────────────────────────────────

async function executeCloudScore(
  repo: RepoRootResolution,
  scriptPath: string,
  logger: Logger
): Promise<CloudScoreResult> {
  const args = buildArgs(scriptPath, repo);
  let rawOutput = "";

  try {
    const psResult = await runPowerShellCommand(args, repo.repoRoot);
    rawOutput = psResult.stdout;
  } catch (error) {
    rawOutput = error instanceof Error ? error.message : String(error);
  }

  const parsed = parseJsonResult(rawOutput);
  if (parsed) {
    return parsed;
  }

  logger.warn("MCP cloud score: unable to parse JSON result, treating as error.");
  return {
    ok: false,
    status: "blocked",
    evaluator_version: "unknown",
    score: 0,
    grade: "F",
    summary: {
      scanners: 0, scanner_blockers: 0, scanner_warnings: 0,
      architecture_blockers: 1, architecture_warnings: 0,
      blockers: 1, warnings: 0,
      workload_sensitivity: "standard",
      source: "extension", evaluated_at: new Date().toISOString()
    },
    findings: [{
      rule_id: "MCP-PARSE-001",
      severity: "blocker",
      source: "extension",
      scanner_id: null,
      message: "Unable to parse MCP cloud score result.",
      hint: "Run `pg mcp-cloud-score` in terminal for details."
    }]
  };
}

function buildArgs(scriptPath: string, repo: RepoRootResolution): string[] {
  const args = [
    "-NoProfile", "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-File", scriptPath, "-Json"
  ];
  const config = vscode.workspace.getConfiguration("narrate");
  const apiBase = config.get<string>("mcpCloudScore.apiBase", "");
  if (apiBase) args.push("-ApiBase", apiBase);
  const stateFile = config.get<string>("mcpCloudScore.stateFile", "");
  if (stateFile) args.push("-StateFile", stateFile);
  for (const m of discoverManifestPaths(repo.repoRoot)) args.push("-ManifestPath", m);
  const sensitivity = config.get<string>("mcpCloudScore.workloadSensitivity", "standard");
  if (sensitivity && sensitivity !== "standard") args.push("-WorkloadSensitivity", sensitivity);
  return args;
}

function discoverManifestPaths(repoRoot: string): string[] {
  const candidates = [
    path.join(repoRoot, "server", "package.json"),
    path.join(repoRoot, "extension", "package.json"),
    path.join(repoRoot, "package.json")
  ];
  return candidates.filter((p) => fs.existsSync(p));
}

// ── JSON parsing ─────────────────────────────────────────────────────

function parseJsonResult(raw: string): CloudScoreResult | undefined {
  // Try direct parse first (script outputs JSON when -Json flag used)
  try {
    const candidate = JSON.parse(raw.trim());
    if (candidate && typeof candidate.ok === "boolean" && candidate.score !== undefined) {
      return candidate as CloudScoreResult;
    }
  } catch {
    // not direct JSON
  }

  // Look for JSON embedded in output lines
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") && trimmed.includes("\"score\"")) {
      try {
        const candidate = JSON.parse(trimmed);
        if (candidate && typeof candidate.ok === "boolean") {
          return candidate as CloudScoreResult;
        }
      } catch {
        continue;
      }
    }
  }

  return undefined;
}

// ── Result display ───────────────────────────────────────────────────

async function showCloudScoreResult(
  result: CloudScoreResult,
  repo: RepoRootResolution
): Promise<void> {
  const scoreLabel = `${result.score}/100 (${result.grade})`;

  if (result.ok && result.summary.blockers === 0) {
    const warnNote = result.summary.warnings > 0
      ? ` with ${result.summary.warnings} warning(s)`
      : "";
    vscode.window.showInformationMessage(
      `Narrate MCP Cloud Score: ${scoreLabel} — passed${warnNote}.`
    );
    return;
  }

  const parts: string[] = [`Score: ${scoreLabel}`];
  if (result.summary.blockers > 0) {
    parts.push(`${result.summary.blockers} blocker(s)`);
  }
  if (result.summary.warnings > 0) {
    parts.push(`${result.summary.warnings} warning(s)`);
  }

  const detail = parts.join(", ");
  const actions = ["Open Report", "Run in Terminal"];

  const pick = await vscode.window.showErrorMessage(
    `Narrate MCP Cloud Score: ${detail}.`,
    ...actions
  );

  if (pick === "Open Report") {
    await openReport(repo);
  } else if (pick === "Run in Terminal") {
    await runInTerminal(repo);
  }
}

// ── Report generation ────────────────────────────────────────────────

function writeCloudScoreReport(
  result: CloudScoreResult,
  repo: RepoRootResolution
): void {
  const reportPath = path.join(repo.repoRoot, GENERATED_DIR, REPORT_FILE);
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const lines: string[] = [
    "# MCP Cloud Score Report",
    "",
    `**Status:** ${result.status}`,
    `**Score:** ${result.score}/100`,
    `**Grade:** ${result.grade}`,
    `**Evaluator:** ${result.evaluator_version}`,
    `**Sensitivity:** ${result.summary.workload_sensitivity}`,
    `**Scanners:** ${result.summary.scanners}`,
    `**Blockers:** ${result.summary.blockers} (scanner: ${result.summary.scanner_blockers}, arch: ${result.summary.architecture_blockers})`,
    `**Warnings:** ${result.summary.warnings} (scanner: ${result.summary.scanner_warnings}, arch: ${result.summary.architecture_warnings})`,
    `**Generated:** ${new Date().toISOString()}`,
    ""
  ];

  if (result.findings.length > 0) {
    lines.push("## Findings", "");
    lines.push("| Rule | Severity | Source | Scanner | Message | Hint |");
    lines.push("|------|----------|--------|---------|---------|------|");
    for (const f of result.findings) {
      lines.push(`| ${f.rule_id} | ${f.severity} | ${f.source} | ${f.scanner_id ?? "—"} | ${f.message} | ${f.hint} |`);
    }
    lines.push("");
  }

  if (result.ok && result.findings.length === 0) {
    lines.push("## Result", "", "All cloud infrastructure checks passed.", "");
  }

  lines.push("## Next Steps", "");
  lines.push("- Run `pg mcp-cloud-score` in terminal for full interactive output.");
  lines.push("- Review cloud architecture controls in `.verificaton-before-production-folder/FEATURE_ADDITIONS.md`.");
  lines.push("");

  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}

// ── Quick actions ────────────────────────────────────────────────────

async function openReport(repo: RepoRootResolution): Promise<void> {
  const reportPath = path.join(repo.repoRoot, GENERATED_DIR, REPORT_FILE);
  if (fs.existsSync(reportPath)) {
    const doc = await vscode.workspace.openTextDocument(reportPath);
    await vscode.window.showTextDocument(doc, { preview: true });
  } else {
    vscode.window.showWarningMessage("Narrate: MCP cloud score report not found.");
  }
}

async function runInTerminal(repo: RepoRootResolution): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: "PG MCP Cloud Score",
    cwd: repo.repoRoot
  });
  terminal.show();
  terminal.sendText(".\\pg.ps1 mcp-cloud-score");
}
