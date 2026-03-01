import { CONTROL_RULES } from "./mcpCloudControlRules";
import { clampScore, resolveGrade } from "./mcpCloudScoreMath";
import type { CloudScoreThresholds } from "./policyVaultTypes";

type VerificationSeverity = "blocker" | "warning";
type McpCloudFindingSource = "input" | "scanner" | "architecture";
type NormalizedScanner = {
  scanner_id: string;
  status: McpCloudScannerStatus;
  blockers: number;
  warnings: number;
};
type SeverityTotals = {
  blockers: number;
  warnings: number;
};
type ScannerCounts = SeverityTotals;

export type McpCloudScannerStatus = "pass" | "blocked" | "error";

export interface McpCloudScannerSummaryInput {
  checked?: number | null;
  blockers?: number | null;
  warnings?: number | null;
}

export interface McpCloudScannerResultInput {
  scanner_id?: string;
  status?: McpCloudScannerStatus | string | null;
  evaluator_version?: string | null;
  summary?: McpCloudScannerSummaryInput | null;
  blocker_rule_ids?: string[] | null;
  warning_rule_ids?: string[] | null;
}

export type McpCloudWorkloadSensitivity = "standard" | "regulated";

export interface McpCloudArchitectureProvidersInput {
  cloudflare?: boolean | null;
  aws?: boolean | null;
  hetzner?: boolean | null;
  cloudfront?: boolean | null;
  aws_shield_advanced?: boolean | null;
}

export interface McpCloudArchitectureContextInput {
  workload_sensitivity?: McpCloudWorkloadSensitivity | string | null;
  monthly_budget_usd?: number | null;
  providers?: McpCloudArchitectureProvidersInput | null;
  controls?: Record<string, boolean | null | undefined> | null;
}

export interface McpCloudRuntimeContextInput {
  source?: string | null;
  session_id?: string | null;
}

export interface McpCloudScoringRequest {
  runtime?: McpCloudRuntimeContextInput | null;
  scanner_results?: McpCloudScannerResultInput[] | null;
  architecture?: McpCloudArchitectureContextInput | null;
}

export interface McpCloudScoringFinding {
  rule_id: string;
  severity: VerificationSeverity;
  source: McpCloudFindingSource;
  scanner_id: string | null;
  message: string;
  hint: string;
}

export interface McpCloudScoringResult {
  ok: boolean;
  status: "pass" | "blocked";
  evaluator_version: "mcp-cloud-score-v1";
  score: number;
  grade: string;
  summary: {
    scanners: number;
    scanner_blockers: number;
    scanner_warnings: number;
    architecture_blockers: number;
    architecture_warnings: number;
    blockers: number;
    warnings: number;
    workload_sensitivity: McpCloudWorkloadSensitivity;
    source: string;
    evaluated_at: string;
  };
  findings: McpCloudScoringFinding[];
}

const BLOCKER_PENALTY = 15;
const WARNING_PENALTY = 4;

export function evaluateMcpCloudScoring(requestBody: McpCloudScoringRequest, thresholds?: CloudScoreThresholds | null): McpCloudScoringResult {
  const scanners = normalizeScanners(requestBody.scanner_results);
  const sensitivity = normalizeSensitivity(requestBody.architecture?.workload_sensitivity);
  const source = normalizeSource(requestBody.runtime?.source);
  const scannerCounts = summarizeScannerCounts(scanners);
  const architectureFindings = evaluateArchitecture(requestBody.architecture, sensitivity);
  const findings = [...buildScannerInputFindings(scanners.length), ...buildScannerStatusFindings(scanners), ...architectureFindings];
  const architectureCounts = summarizeSeverityCounts(architectureFindings);
  const totals = summarizeOverallCounts(findings, scannerCounts);
  const result = buildScoringResult({ scanners: scanners.length, source, sensitivity, scannerCounts, architectureCounts, totals, findings });
  if (thresholds) {
    const bp = thresholds.blocker_penalty ?? BLOCKER_PENALTY, wp = thresholds.warning_penalty ?? WARNING_PENALTY;
    result.score = clampScore(100 - result.summary.blockers * bp - result.summary.warnings * wp);
    result.grade = resolveGrade(result.score);
  }
  return result;
}

type BuildScoringResultInput = {
  scanners: number;
  source: string;
  sensitivity: McpCloudWorkloadSensitivity;
  scannerCounts: ScannerCounts;
  architectureCounts: SeverityTotals;
  totals: SeverityTotals;
  findings: McpCloudScoringFinding[];
};

function buildScoringResult(input: BuildScoringResultInput): McpCloudScoringResult {
  const score = clampScore(100 - input.totals.blockers * BLOCKER_PENALTY - input.totals.warnings * WARNING_PENALTY);
  const status: "pass" | "blocked" = input.totals.blockers > 0 ? "blocked" : "pass";
  return {
    ok: status === "pass",
    status,
    evaluator_version: "mcp-cloud-score-v1",
    score,
    grade: resolveGrade(score),
    summary: {
      scanners: input.scanners,
      scanner_blockers: input.scannerCounts.blockers, scanner_warnings: input.scannerCounts.warnings,
      architecture_blockers: input.architectureCounts.blockers, architecture_warnings: input.architectureCounts.warnings,
      blockers: input.totals.blockers, warnings: input.totals.warnings,
      workload_sensitivity: input.sensitivity,
      source: input.source,
      evaluated_at: new Date().toISOString()
    },
    findings: input.findings
  };
}

function buildScannerInputFindings(scannerCount: number): McpCloudScoringFinding[] {
  if (scannerCount > 0) {
    return [];
  }
  return [
    {
      rule_id: "MCP-INPUT-001",
      severity: "blocker",
      source: "input",
      scanner_id: null,
      message: "No scanner metadata was provided for cloud scoring.",
      hint: "Send local scanner summaries (dependency/coding/api-contract/etc.) before requesting MCP score."
    }
  ];
}

function buildScannerStatusFindings(scanners: NormalizedScanner[]): McpCloudScoringFinding[] {
  const findings: McpCloudScoringFinding[] = [];
  for (const scanner of scanners) {
    if (scanner.status === "error") {
      findings.push(createScannerFinding("MCP-SCAN-001", "blocker", scanner.scanner_id,
        `Scanner '${scanner.scanner_id}' reported runtime error state.`,
        "Fix scanner runtime failures before trusting cloud score output."));
    }
    if (scanner.status === "blocked") {
      findings.push(createScannerFinding("MCP-SCAN-002", "warning", scanner.scanner_id,
        `Scanner '${scanner.scanner_id}' is blocked by policy findings.`,
        "Resolve scanner blockers first; cloud score does not override failed baseline checks."));
    }
  }
  return findings;
}

function createScannerFinding(
  rule_id: string,
  severity: VerificationSeverity,
  scanner_id: string,
  message: string,
  hint: string
): McpCloudScoringFinding {
  return {
    rule_id,
    severity,
    source: "scanner",
    scanner_id,
    message,
    hint
  };
}

function summarizeScannerCounts(scanners: NormalizedScanner[]): ScannerCounts {
  let blockers = 0;
  let warnings = 0;
  for (const scanner of scanners) {
    blockers += scanner.blockers;
    warnings += scanner.warnings;
  }
  return { blockers, warnings };
}

function summarizeOverallCounts(
  findings: McpCloudScoringFinding[],
  scannerCounts: ScannerCounts
): SeverityTotals {
  const findingCounts = summarizeSeverityCounts(findings);
  return {
    blockers: scannerCounts.blockers + findingCounts.blockers,
    warnings: scannerCounts.warnings + findingCounts.warnings
  };
}

function summarizeSeverityCounts(findings: McpCloudScoringFinding[]): SeverityTotals {
  return {
    blockers: countBySeverity(findings, "blocker"),
    warnings: countBySeverity(findings, "warning")
  };
}

function normalizeScanners(input: McpCloudScoringRequest["scanner_results"]): NormalizedScanner[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((candidate, index) => ({
    scanner_id: normalizeScannerId(candidate?.scanner_id, index + 1),
    status: normalizeScannerStatus(candidate?.status),
    blockers: normalizeCount(candidate?.summary?.blockers),
    warnings: normalizeCount(candidate?.summary?.warnings)
  }));
}

function normalizeScannerId(value: string | undefined, sequence: number): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return `scanner-${sequence}`;
  }
  return trimmed.slice(0, 80);
}

function normalizeScannerStatus(value: string | null | undefined): McpCloudScannerStatus {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "pass" || normalized === "blocked" || normalized === "error") {
    return normalized;
  }
  return "error";
}

function normalizeCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function normalizeSensitivity(
  value: McpCloudArchitectureContextInput["workload_sensitivity"]
): McpCloudWorkloadSensitivity {
  const normalized = (value ?? "standard").trim().toLowerCase();
  if (normalized === "regulated") {
    return "regulated";
  }
  return "standard";
}

function normalizeSource(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return "unknown";
  }
  return trimmed.slice(0, 80);
}

function evaluateArchitecture(
  architecture: McpCloudArchitectureContextInput | null | undefined,
  sensitivity: McpCloudWorkloadSensitivity
): McpCloudScoringFinding[] {
  if (!architecture) {
    return [
      {
        rule_id: "CLD-INPUT-001",
        severity: "warning",
        source: "architecture",
        scanner_id: null,
        message: "Cloud architecture context was not provided.",
        hint: "Provide provider + control metadata so cloud scoring can enforce production architecture standards."
      }
    ];
  }
  const findings: McpCloudScoringFinding[] = [];
  const providers = architecture.providers ?? {};
  const budget = normalizeBudget(architecture.monthly_budget_usd);
  applyProviderChecks(findings, providers, sensitivity, budget);
  applyControlChecks(findings, architecture.controls, sensitivity);
  return findings;
}

function applyProviderChecks(
  findings: McpCloudScoringFinding[],
  providers: McpCloudArchitectureProvidersInput,
  sensitivity: McpCloudWorkloadSensitivity,
  budget: number | null
): void {
  const providerSignals = [
    providers.cloudflare,
    providers.aws,
    providers.hetzner,
    providers.cloudfront,
    providers.aws_shield_advanced
  ];
  const hasAnyProviderSignal = providerSignals.some((value) => value !== null && value !== undefined);
  if (!hasAnyProviderSignal) {
    findings.push({
      rule_id: "CLD-PROV-000",
      severity: "warning",
      source: "architecture",
      scanner_id: null,
      message: "Cloud provider context is missing.",
      hint: "Set provider flags so cloud-scoring can enforce architecture-specific checks."
    });
  }

  if (sensitivity === "regulated") {
    requireProvider(findings, providers.cloudflare, "CLD-PROV-001", "Cloudflare edge layer");
    requireProvider(findings, providers.aws, "CLD-PROV-002", "AWS compute/secrets layer");
    requireProvider(findings, providers.hetzner, "CLD-PROV-003", "Hetzner private database layer");
    applyRegulatedBudgetCheck(findings, budget);
  }

  applyDualCdnWarning(findings, providers);
  applyShieldBudgetCheck(findings, providers.aws_shield_advanced, budget);
  applyMissingBudgetWarning(findings, budget);
}

function applyRegulatedBudgetCheck(findings: McpCloudScoringFinding[], budget: number | null): void {
  if (budget !== null && budget < 250) {
    findings.push({
      rule_id: "CLD-COST-004",
      severity: "blocker",
      source: "architecture",
      scanner_id: null,
      message: "Monthly budget is below regulated baseline threshold.",
      hint: "Regulated profile requires budget guardrails that can sustain security controls and monitoring."
    });
  }
}

function applyDualCdnWarning(findings: McpCloudScoringFinding[], providers: McpCloudArchitectureProvidersInput): void {
  if (providers.cloudflare === true && providers.cloudfront === true) {
    findings.push({
      rule_id: "CLD-COST-001",
      severity: "warning",
      source: "architecture",
      scanner_id: null,
      message: "Cloudflare and CloudFront are both marked enabled.",
      hint: "Avoid duplicate CDN spend unless there is a documented multi-CDN requirement."
    });
  }
}

function applyShieldBudgetCheck(
  findings: McpCloudScoringFinding[],
  shieldEnabled: boolean | null | undefined,
  budget: number | null
): void {
  if (shieldEnabled === true && budget !== null && budget < 500) {
    findings.push({
      rule_id: "CLD-COST-002",
      severity: "blocker",
      source: "architecture",
      scanner_id: null,
      message: "AWS Shield Advanced is enabled but monthly budget is below cost-safe threshold.",
      hint: "Use Cloudflare Pro/Business for DDoS at this budget tier, or raise approved security budget."
    });
  }
}

function applyMissingBudgetWarning(findings: McpCloudScoringFinding[], budget: number | null): void {
  if (budget === null) {
    findings.push({
      rule_id: "CLD-COST-003",
      severity: "warning",
      source: "architecture",
      scanner_id: null,
      message: "Monthly cloud budget was not provided.",
      hint: "Set monthly_budget_usd to enforce cost guardrails and catch architecture spend regressions."
    });
  }
}

function requireProvider(
  findings: McpCloudScoringFinding[],
  providerValue: boolean | null | undefined,
  ruleId: string,
  label: string
): void {
  if (providerValue === true) {
    return;
  }
  const severity: VerificationSeverity = providerValue === false ? "blocker" : "warning";
  const message =
    providerValue === false
      ? `${label} is explicitly disabled for regulated workload.`
      : `${label} evidence is missing for regulated workload.`;
  findings.push({
    rule_id: ruleId,
    severity,
    source: "architecture",
    scanner_id: null,
    message,
    hint: "Provide an approved regulated architecture profile or attach provider evidence."
  });
}

function applyControlChecks(
  findings: McpCloudScoringFinding[],
  controls: Record<string, boolean | null | undefined> | null | undefined,
  sensitivity: McpCloudWorkloadSensitivity
): void {
  for (const control of CONTROL_RULES) {
    const value = controls?.[control.key];
    if (value === true || (sensitivity === "standard" && !control.standardRecommended)) {
      continue;
    }
    findings.push({
      rule_id: control.ruleId,
      severity: resolveControlSeverity(sensitivity, control.regulatedCritical, value),
      source: "architecture",
      scanner_id: null,
      message: control.message,
      hint: control.hint
    });
  }
}

function resolveControlSeverity(
  sensitivity: McpCloudWorkloadSensitivity,
  regulatedCritical: boolean,
  value: boolean | null | undefined
): VerificationSeverity {
  if (sensitivity === "regulated" && regulatedCritical && value === false) {
    return "blocker";
  }
  return "warning";
}

function normalizeBudget(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

function countBySeverity(
  findings: McpCloudScoringFinding[],
  severity: VerificationSeverity
): number {
  let count = 0;
  for (const finding of findings) {
    if (finding.severity === severity) {
      count += 1;
    }
  }
  return count;
}
