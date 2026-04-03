import * as vscode from "vscode";
import type { TrustFinding, TrustReport } from "./trustScoreTypes";
import { getValidationLibraryState } from "./trustScoreAnalysisUtils";

// ── Config helpers ──────────────────────────────────────────────────────

export function narrateConfig<T>(key: string, fallback: T): T {
  return vscode.workspace.getConfiguration("narrate").get<T>(key, fallback);
}

// ── Pure computation ────────────────────────────────────────────────────

export function mergeServerFindings(report: TrustReport, findings: TrustFinding[]): void {
  report.findings.push(...findings);
  report.blockers += findings.filter((f) => f.severity === "blocker").length;
  report.warnings += findings.filter((f) => f.severity === "warning").length;
  report.score = Math.max(0, 100 - report.blockers * 15 - report.warnings * 4);
  report.grade = resolveGradeFromScore(report.score);
  report.status = report.blockers > 0 ? "red" : report.score >= 80 ? "green" : "yellow";
}

export function resolveGradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function buildReportTooltip(report: TrustReport, autoRefresh: boolean): string {
  if (isAuthenticationRequiredReport(report)) {
    return [
      "Narrate Trust Score (AUTH REQUIRED)",
      "Server-backed trust evaluation needs a valid signed-in session.",
      `Auto mode: ${autoRefresh ? "on-save" : "manual"}`,
      "Click to open the trust report for the exact auth requirement."
    ].join("\n");
  }

  return [
    `Narrate Trust Score (${report.status.toUpperCase()})`,
    `Grade: ${report.grade}`, `Blockers: ${report.blockers}`, `Warnings: ${report.warnings}`,
    `Auto mode: ${autoRefresh ? "on-save" : "manual"}`,
    "Click to open trust findings report."
  ].join("\n");
}

export function isAuthenticationRequiredReport(report: TrustReport | undefined): boolean {
  if (!report || report.findings.length !== 1) {
    return false;
  }

  const [finding] = report.findings;
  return (
    finding.ruleId === "TRUST-SRV-001" &&
    /authentication required|sign in to narrate|session token/i.test(finding.message)
  );
}

// ── Suggestion prompts ──────────────────────────────────────────────────

export async function maybeOfferValidationSetup(report: TrustReport, shouldSuggest: boolean): Promise<void> {
  if (!shouldSuggest) return;
  const hasInputValidationGap = report.findings.some((f) => f.ruleId === "TRUST-CSTD-VAL-001");
  const hasLibraryGap = report.findings.some((f) => f.ruleId === "TRUST-CSTD-VAL-002");
  if (!hasInputValidationGap && !hasLibraryGap) return;

  const validationState = getValidationLibraryState();
  if (validationState.kind === "java") {
    await maybeOfferJavaValidationSetup();
    return;
  }
  if (validationState.kind !== "node") {
    await maybeOfferUnknownValidationSetup();
    return;
  }
  if (hasLibraryGap) {
    await maybeOfferNodeLibrarySetup();
    return;
  }
  await maybeOfferNodeValidationFix();
}

async function maybeOfferJavaValidationSetup(): Promise<void> {
  const action = await vscode.window.showWarningMessage(
    "Narrate Trust: validation is missing in this Java surface. Use Spring/Jakarta validation annotations and dependencies, not Zod.",
    "Show Java Fix",
    "Later"
  );
  if (action === "Show Java Fix") {
    await vscode.commands.executeCommand("narrate.setupValidationLibrary");
  }
}

async function maybeOfferUnknownValidationSetup(): Promise<void> {
  const action = await vscode.window.showWarningMessage(
    "Narrate Trust: validation is missing, but this workspace does not look like a Node/TypeScript package where Narrate can auto-install Zod.",
    "Open Guidance",
    "Later"
  );
  if (action === "Open Guidance") {
    await vscode.commands.executeCommand("narrate.setupValidationLibrary");
  }
}

async function maybeOfferNodeLibrarySetup(): Promise<void> {
  const action = await vscode.window.showWarningMessage(
    "Narrate Trust: validation library setup is missing. Install a validation library (Zod recommended).",
    "Install Zod Now",
    "Choose Library",
    "Later"
  );
  if (action === "Install Zod Now") {
    await vscode.commands.executeCommand("narrate.setupValidationLibrary", "zod");
    return;
  }
  if (action === "Choose Library") {
    await vscode.commands.executeCommand("narrate.setupValidationLibrary");
  }
}

async function maybeOfferNodeValidationFix(): Promise<void> {
  const action = await vscode.window.showWarningMessage(
    "Narrate Trust: input validation is missing in this request surface. Add schema validation before business logic.",
    "Choose Library",
    "Later"
  );
  if (action === "Choose Library") {
    await vscode.commands.executeCommand("narrate.setupValidationLibrary");
  }
}

export async function maybeOfferDiagnosticsHint(report: TrustReport, shouldHint: boolean): Promise<void> {
  if (!shouldHint) return;
  if (!report.findings.some((f) => f.ruleId === "TRUST-TS-001")) return;
  const action = await vscode.window.showInformationMessage(
    "Narrate Trust: TypeScript diagnostics are active. If compile already passed, restart TS server and refresh trust.",
    "Run Auto Fix", "Dismiss"
  );
  if (action === "Run Auto Fix") await vscode.commands.executeCommand("narrate.restartTypeScriptAndRefreshTrust");
}

// ── Analyzable check ────────────────────────────────────────────────────

export function isDocumentAnalyzable(document: vscode.TextDocument, languages: Set<string>): boolean {
  if (document.uri.scheme !== "file") return false;
  if (document.getText().length > 1_500_000) return false;
  return languages.has(document.languageId);
}
