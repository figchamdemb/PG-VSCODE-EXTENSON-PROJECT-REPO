// Trust Score pre-push gate — structured outcome, quick-action buttons, gate report
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { TrustReport, TrustScoreService } from "../trust/trustScoreService";
import { RepoRootResolution } from "../utils/repoRootResolver";

// ── Types ────────────────────────────────────────────────────────────

type TrustPgPushGateMode = "off" | "relaxed" | "strict";

export type TrustGateOutcome = {
  allowPush: boolean;
  mode: TrustPgPushGateMode;
  status: "pass" | "blocked" | "skipped" | "overridden";
  blockerCount: number;
  warningCount: number;
  score: number | null;
  grade: string | null;
  message: string;
  report?: TrustReport;
};

// ── Constants ────────────────────────────────────────────────────────

const REPORT_FILE = "trust-gate-latest.md";
const GENERATED_DIR = "Memory-bank/_generated";

// ── Public API ───────────────────────────────────────────────────────

export async function runTrustScorePrePushGate(
  trustScoreService: TrustScoreService
): Promise<TrustGateOutcome> {
  const mode = getTrustGateMode();

  if (mode === "off") {
    const report = trustScoreService.getLatestReport();
    return buildOutcome(true, mode, "skipped", "Trust gate mode is off.", report);
  }

  const disabledResult = await maybeHandleDisabledTrustScore(mode, trustScoreService);
  if (disabledResult) {
    return disabledResult;
  }

  await trustScoreService.refreshNow();
  const report = trustScoreService.getLatestReport();

  if (!report) {
    return handleMissingReport(mode);
  }

  return evaluateFromReport(mode, report);
}

export async function showTrustBlockedActions(
  outcome: TrustGateOutcome,
  trustScoreService: TrustScoreService
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
  if (outcome.score !== null) {
    summaryParts.push(`score: ${outcome.score}/100`);
  }

  const detail = summaryParts.length > 0
    ? summaryParts.join(" — ")
    : outcome.message;

  const actions: string[] = ["Show Trust Report"];

  const hasTypeScriptBlocker = outcome.report?.findings.some(
    (f) => f.ruleId === "TRUST-TS-001"
  );
  if (hasTypeScriptBlocker) {
    actions.push("Restart TS + Refresh Trust");
  }

  actions.push("Setup Validation Library");
  actions.push("Open Gate Report");

  const pick = await vscode.window.showErrorMessage(
    `Narrate Trust Gate: push blocked [${outcome.mode}]. ${detail}`,
    ...actions
  );

  if (pick === "Show Trust Report") {
    await trustScoreService.showLatestReport();
  } else if (pick === "Restart TS + Refresh Trust") {
    await vscode.commands.executeCommand("narrate.restartTypeScriptAndRefreshTrust");
  } else if (pick === "Setup Validation Library") {
    await vscode.commands.executeCommand("narrate.setupValidationLibrary");
  } else if (pick === "Open Gate Report") {
    await openGateReport();
  }
}

export function writeTrustGateReport(
  outcome: TrustGateOutcome,
  repo: RepoRootResolution
): void {
  const reportPath = path.join(repo.repoRoot, GENERATED_DIR, REPORT_FILE);
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const lines: string[] = [
    "# Trust Score Gate Report",
    "",
    `**Status:** ${outcome.status}`,
    `**Mode:** ${outcome.mode}`,
    `**Score:** ${outcome.score !== null ? `${outcome.score}/100 (${outcome.grade})` : "N/A"}`,
    `**Blockers:** ${outcome.blockerCount}`,
    `**Warnings:** ${outcome.warningCount}`,
    `**Decision:** ${outcome.allowPush ? "Push allowed" : "Push blocked"}`,
    `**Generated:** ${new Date().toISOString()}`,
    ""
  ];

  if (outcome.report) {
    lines.push(
      `**File:** ${outcome.report.file}`,
      `**Component:** ${outcome.report.componentType}`,
      `**Lines:** ${outcome.report.lineCount}`,
      ""
    );

    if (outcome.report.findings.length > 0) {
      lines.push("## Findings", "");
      lines.push("| Rule | Severity | Message |");
      lines.push("|------|----------|---------|");
      for (const f of outcome.report.findings) {
        lines.push(`| ${f.ruleId} | ${f.severity} | ${f.message} |`);
      }
      lines.push("");
    }
  }

  lines.push("## Remediation", "");

  if (outcome.report?.findings.some((f) => f.ruleId === "TRUST-TS-001")) {
    lines.push("- **TypeScript errors detected**: Run `Narrate: Restart TS + Refresh Trust` from command palette.");
  }
  if (outcome.report?.findings.some((f) => isValidationFinding(f.ruleId))) {
    lines.push("- **Missing input validation**: Run `Narrate: Setup Validation Library` or add manual validation.");
  }
  if (outcome.blockerCount > 0) {
    lines.push("- Fix all blocker findings, then run `Narrate: Refresh Trust Score` and retry push.");
  }
  lines.push("");

  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}

function isValidationFinding(ruleId: string): boolean {
  return (
    ruleId === "TRUST-CSTD-VAL-001" ||
    ruleId === "TRUST-CSTD-VAL-002"
  );
}

// ── Internal helpers ─────────────────────────────────────────────────

function getTrustGateMode(): TrustPgPushGateMode {
  return vscode.workspace
    .getConfiguration("narrate")
    .get<TrustPgPushGateMode>("trustScore.pgPushGateMode", "off");
}

async function maybeHandleDisabledTrustScore(
  mode: TrustPgPushGateMode,
  trustScoreService: TrustScoreService
): Promise<TrustGateOutcome | undefined> {
  if (trustScoreService.isTrustScoreEnabled()) {
    return undefined;
  }

  if (mode === "strict") {
    return buildOutcome(
      false, mode, "blocked",
      "Trust Score gate is strict but Trust Score is disabled. Enable Trust Score or change gate mode.",
      trustScoreService.getLatestReport()
    );
  }

  const continueAnyway = await askRelaxedContinue(
    "Trust Score is disabled. Continue push in relaxed mode?"
  );
  return buildOutcome(
    continueAnyway, mode,
    continueAnyway ? "overridden" : "blocked",
    continueAnyway ? "Proceeding with Trust Score disabled." : "Push canceled.",
    trustScoreService.getLatestReport()
  );
}

async function handleMissingReport(
  mode: TrustPgPushGateMode
): Promise<TrustGateOutcome> {
  if (mode === "strict") {
    return buildOutcome(
      false, mode, "blocked",
      "Strict Trust Score gate could not evaluate an active source file. Open a source file, run 'Narrate: Refresh Trust Score', then retry."
    );
  }

  const continueAnyway = await askRelaxedContinue(
    "Trust Score report is not available. Continue push in relaxed mode?"
  );
  return buildOutcome(
    continueAnyway, mode,
    continueAnyway ? "overridden" : "blocked",
    continueAnyway ? "Proceeding without trust report." : "Push canceled."
  );
}

function evaluateFromReport(
  mode: TrustPgPushGateMode,
  report: TrustReport
): TrustGateOutcome | Promise<TrustGateOutcome> {
  const isBlocked = report.blockers > 0 || report.status === "red";

  if (!isBlocked) {
    return buildOutcome(
      true, mode, "pass",
      `Trust Score ${report.score}/100 (${report.grade}) passed gate.`,
      report
    );
  }

  const gateMessage =
    `Trust Score is ${report.score}/100 (${report.grade}) with ${report.blockers} blocker(s) on ${report.file}.`;

  if (mode === "strict") {
    return buildOutcome(
      false, mode, "blocked",
      `${gateMessage} Strict mode blocks push until blockers are fixed.`,
      report
    );
  }

  return evaluateRelaxedBlocked(mode, gateMessage, report);
}

async function evaluateRelaxedBlocked(
  mode: TrustPgPushGateMode,
  gateMessage: string,
  report: TrustReport
): Promise<TrustGateOutcome> {
  const continueAnyway = await askRelaxedContinue(
    `${gateMessage} Continue push in relaxed mode?`
  );
  return buildOutcome(
    continueAnyway, mode,
    continueAnyway ? "overridden" : "blocked",
    continueAnyway ? "Proceeding in relaxed mode." : "Push canceled.",
    report
  );
}

function buildOutcome(
  allowPush: boolean,
  mode: TrustPgPushGateMode,
  status: TrustGateOutcome["status"],
  message: string,
  report?: TrustReport
): TrustGateOutcome {
  return {
    allowPush,
    mode,
    status,
    blockerCount: report?.blockers ?? 0,
    warningCount: report?.warnings ?? 0,
    score: report?.score ?? null,
    grade: report?.grade ?? null,
    message,
    report
  };
}

async function askRelaxedContinue(message: string): Promise<boolean> {
  const picked = await vscode.window.showWarningMessage(
    `Narrate Trust Gate: ${message}`,
    { modal: true },
    "Continue Push"
  );
  return picked === "Continue Push";
}

async function openGateReport(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return;
  }
  const reportPath = path.join(folder.uri.fsPath, GENERATED_DIR, REPORT_FILE);
  if (fs.existsSync(reportPath)) {
    const doc = await vscode.workspace.openTextDocument(reportPath);
    await vscode.window.showTextDocument(doc, { preview: true });
  }
}
