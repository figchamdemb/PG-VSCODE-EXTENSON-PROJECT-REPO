// DB index maintenance check — extension command + structured result display
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { runPowerShellCommand } from "../governance/powerShellRunner";
import { RepoRootResolution, resolveRepoRoot } from "../utils/repoRootResolver";
import { Logger } from "../utils/logger";
import { showPgRootGuidance } from "./pgRootGuidance";
import { ensureDevProfileReady } from "./devProfilePreflight";

// ── Types ────────────────────────────────────────────────────────────

type FindingSeverity = "blocker" | "warning";

interface DbIndexFinding {
  rule_id: string;
  severity: FindingSeverity;
  message: string;
  hint: string;
}

interface DbIndexCheckSummary {
  blockers: number;
  warnings: number;
  checked: number;
}

interface DbIndexCheckResult {
  ok: boolean;
  status: "pass" | "blocked";
  runtime_error: string | null;
  blockers: DbIndexFinding[];
  warnings: DbIndexFinding[];
  summary: DbIndexCheckSummary;
}

// ── Constants ────────────────────────────────────────────────────────

const JSON_MARKER = "PG_DB_INDEX_JSON:";
const REPORT_FILE = "db-index-check-latest.md";
const GENERATED_DIR = "Memory-bank/_generated";

// ── Public API ───────────────────────────────────────────────────────

export function registerRunDbIndexCheckCommand(
  logger: Logger
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.runDbIndexCheck", async () => {
    try {
      await runDbIndexCheck(logger);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: DB index check failed. ${msg}`);
    }
  });
}

// ── Main flow ────────────────────────────────────────────────────────

async function runDbIndexCheck(logger: Logger): Promise<void> {
  const repo = resolveRepoRoot();
  if (!repo) {
    await showPgRootGuidance("DB index check");
    return;
  }
  const canContinue = await ensureDevProfileReady(repo, "DB index check");
  if (!canContinue) {
    return;
  }

  const scriptPath = path.join(repo.repoRoot, "scripts", "db_index_maintenance_check.ps1");
  if (!fs.existsSync(scriptPath)) {
    vscode.window.showWarningMessage(
      "Narrate: db_index_maintenance_check.ps1 not found."
    );
    return;
  }

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Narrate: Running DB index maintenance check…", cancellable: false },
    async () => executeDbIndexCheck(repo, scriptPath, logger)
  );

  writeDbIndexReport(result, repo);
  await showDbIndexResult(result, repo);
}

// ── Execution ────────────────────────────────────────────────────────

async function executeDbIndexCheck(
  repo: RepoRootResolution,
  scriptPath: string,
  logger: Logger
): Promise<DbIndexCheckResult> {
  const args = buildCheckArgs(scriptPath);
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

  logger.warn("DB index check: unable to parse JSON result, treating as error.");
  return {
    ok: false,
    status: "blocked",
    runtime_error: rawOutput.slice(0, 500) || "Unknown error",
    blockers: [{
      rule_id: "DBM-PARSE-001",
      severity: "blocker",
      message: "Unable to parse DB index check result.",
      hint: "Run `pg db-index-check` in terminal for details."
    }],
    warnings: [],
    summary: { blockers: 1, warnings: 0, checked: 0 }
  };
}

function buildCheckArgs(scriptPath: string): string[] {
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-File", scriptPath,
    "-Json"
  ];

  const config = vscode.workspace.getConfiguration("narrate");
  const serverEnv = config.get<string>("dbIndex.serverEnvPath", "");
  if (serverEnv) {
    args.push("-ServerEnvPath", serverEnv);
  }

  const seqScanThreshold = config.get<number>("dbIndex.seqScanThreshold", 0);
  if (seqScanThreshold > 0) {
    args.push("-SeqScanThreshold", String(seqScanThreshold));
  }

  return args;
}

// ── JSON parsing ─────────────────────────────────────────────────────

function parseJsonResult(raw: string): DbIndexCheckResult | undefined {
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(JSON_MARKER)) {
      try {
        return JSON.parse(trimmed.slice(JSON_MARKER.length)) as DbIndexCheckResult;
      } catch {
        return undefined;
      }
    }
  }

  // Fallback: try entire output as JSON
  try {
    const candidate = JSON.parse(raw.trim());
    if (candidate && typeof candidate.ok === "boolean" && candidate.summary) {
      return candidate as DbIndexCheckResult;
    }
  } catch {
    // not JSON
  }

  return undefined;
}

// ── Result display ───────────────────────────────────────────────────

async function showDbIndexResult(
  result: DbIndexCheckResult,
  repo: RepoRootResolution
): Promise<void> {
  if (result.ok && result.summary.blockers === 0 && result.summary.warnings === 0) {
    vscode.window.showInformationMessage(
      `Narrate DB Index: All checks passed (${result.summary.checked} checked).`
    );
    return;
  }

  const parts: string[] = [];
  if (result.summary.blockers > 0) {
    parts.push(`${result.summary.blockers} blocker(s)`);
  }
  if (result.summary.warnings > 0) {
    parts.push(`${result.summary.warnings} warning(s)`);
  }

  const severity = result.summary.blockers > 0 ? "error" : "warning";
  const detail = parts.join(", ");
  const actions: string[] = ["Open Report", "Run Fix Plan"];

  if (result.runtime_error) {
    actions.push("Run in Terminal");
  }

  const pick = severity === "error"
    ? await vscode.window.showErrorMessage(
        `Narrate DB Index: ${detail}. ${result.summary.checked} checked.`,
        ...actions
      )
    : await vscode.window.showWarningMessage(
        `Narrate DB Index: ${detail}. ${result.summary.checked} checked.`,
        ...actions
      );

  if (pick === "Open Report") {
    await openReport(repo);
  } else if (pick === "Run Fix Plan") {
    await runFixPlanInTerminal(repo);
  } else if (pick === "Run in Terminal") {
    await runCheckInTerminal(repo);
  }
}

// ── Report generation ────────────────────────────────────────────────

function writeDbIndexReport(
  result: DbIndexCheckResult,
  repo: RepoRootResolution
): void {
  const reportPath = path.join(repo.repoRoot, GENERATED_DIR, REPORT_FILE);
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const lines: string[] = [
    "# DB Index Maintenance Check Report",
    "",
    `**Status:** ${result.status}`,
    `**Checked:** ${result.summary.checked}`,
    `**Blockers:** ${result.summary.blockers}`,
    `**Warnings:** ${result.summary.warnings}`,
    `**Generated:** ${new Date().toISOString()}`,
    ""
  ];

  if (result.runtime_error) {
    lines.push("## Runtime Error", "", `\`\`\`\n${result.runtime_error}\n\`\`\``, "");
  }

  if (result.blockers.length > 0) {
    lines.push("## Blockers", "");
    lines.push("| Rule | Message | Hint |");
    lines.push("|------|---------|------|");
    for (const f of result.blockers) {
      lines.push(`| ${f.rule_id} | ${f.message} | ${f.hint} |`);
    }
    lines.push("");
  }

  if (result.warnings.length > 0) {
    lines.push("## Warnings", "");
    lines.push("| Rule | Message | Hint |");
    lines.push("|------|---------|------|");
    for (const f of result.warnings) {
      lines.push(`| ${f.rule_id} | ${f.message} | ${f.hint} |`);
    }
    lines.push("");
  }

  if (result.ok && result.blockers.length === 0 && result.warnings.length === 0) {
    lines.push("## Result", "", "All DB index maintenance checks passed.", "");
  }

  lines.push("## Remediation", "");
  lines.push("Run `pg db-index-fix-plan` to generate a remediation SQL checklist.");
  lines.push("Run `pg db-index-remediate` to execute the remediation plan.");
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
    vscode.window.showWarningMessage("Narrate: DB index report not found.");
  }
}

async function runFixPlanInTerminal(repo: RepoRootResolution): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: "PG DB Index Fix Plan",
    cwd: repo.repoRoot
  });
  terminal.show();
  terminal.sendText(".\\pg.ps1 db-index-fix-plan");
}

async function runCheckInTerminal(repo: RepoRootResolution): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: "PG DB Index Check",
    cwd: repo.repoRoot
  });
  terminal.show();
  terminal.sendText(".\\pg.ps1 db-index-check");
}
