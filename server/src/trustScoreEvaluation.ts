import {
  type CodingFileInput,
  evaluateCodingStandardsVerification
} from "./codingStandardsVerification";
import type { CodingStandardsThresholds } from "./policyVaultTypes";
import {
  type CodingFinding,
  type NormalizedTrustFileInput,
  type TrustComponentType,
  type TrustScoreEvaluationRequest,
  type TrustScoreEvaluationResult,
  type TrustScoreFileReport,
  type TrustScoreFinding,
  groupCodingFindings,
  normalizeFiles,
  resolveGrade,
  resolveStatus,
  shouldCheckValidationLibrary,
  sortTrustFindings
} from "./trustScoreEvaluationHelpers";

export type { TrustScoreEvaluationRequest } from "./trustScoreEvaluationHelpers";

export function evaluateTrustScore(
  requestBody: TrustScoreEvaluationRequest,
  thresholds?: CodingStandardsThresholds | null
): TrustScoreEvaluationResult {
  const normalizedFiles = normalizeFiles(requestBody.files ?? []);
  const codingInput: CodingFileInput[] = normalizedFiles.map((file) => ({
    path: file.path,
    content: file.content,
    component_hint: file.componentType
  }));
  const codingResult = evaluateCodingStandardsVerification(
    {
      project_framework: requestBody.project_framework,
      files: codingInput
    },
    thresholds
  );
  const codingFindingsByFile = groupCodingFindings(codingResult.blockers, codingResult.warnings);

  const reports = normalizedFiles.map((file) =>
    buildReportForFile(file, codingFindingsByFile.get(file.path) ?? [])
  );
  const summaryBlockers = reports.reduce((sum, report) => sum + report.blockers, 0);
  const summaryWarnings = reports.reduce((sum, report) => sum + report.warnings, 0);

  return {
    ok: summaryBlockers === 0,
    status: summaryBlockers === 0 ? "pass" : "blocked",
    evaluator_version: "trust-score-v1",
    summary: {
      checked_files: reports.length,
      blockers: summaryBlockers,
      warnings: summaryWarnings,
      evaluated_at: new Date().toISOString()
    },
    reports
  };
}

function buildReportForFile(
  file: NormalizedTrustFileInput,
  codingFindings: CodingFinding[]
): TrustScoreFileReport {
  const findings: TrustScoreFinding[] = [
    ...codingFindings.map((finding) => ({
      rule_id: finding.rule_id,
      severity: finding.severity,
      file_path: file.path,
      component_type: file.componentType,
      message: finding.message,
      source: "server_policy" as const
    })),
    ...buildValidationLibraryFindings(file),
    ...buildLocalDiagnosticsFindings(file)
  ].sort(sortTrustFindings);

  const blockers = findings.filter((finding) => finding.severity === "blocker").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  const score = Math.max(0, 100 - blockers * 15 - warnings * 4);

  return {
    file_path: file.path,
    component_type: file.componentType,
    line_count: file.lineCount,
    score,
    grade: resolveGrade(score),
    status: resolveStatus(score, blockers),
    blockers,
    warnings,
    findings
  };
}

function buildValidationLibraryFindings(
  file: NormalizedTrustFileInput
): TrustScoreFinding[] {
  if (file.validationLibraryPolicy === "off") {
    return [];
  }
  if (!shouldCheckValidationLibrary(file.path, file.componentType)) {
    return [];
  }
  if (file.installedValidationLibraries.length > 0) {
    return [];
  }

  return [
    {
      rule_id: "TRUST-CSTD-VAL-002",
      severity: file.validationLibraryPolicy === "required" ? "blocker" : "warning",
      file_path: file.path,
      component_type: file.componentType,
      message: "No validation library package detected in dependencies (install Zod or equivalent).",
      line: 1,
      source: "server_context"
    }
  ];
}

function buildLocalDiagnosticsFindings(
  file: NormalizedTrustFileInput
): TrustScoreFinding[] {
  return file.localDiagnostics.map((diagnostic) => ({
    rule_id: diagnostic.severity === "error" ? "TRUST-TS-001" : "TRUST-TS-002",
    severity: diagnostic.severity === "error" ? "blocker" : "warning",
    file_path: file.path,
    component_type: file.componentType,
    message: diagnostic.message ?? "Editor diagnostic reported.",
    line: diagnostic.line ?? undefined,
    source: "local_diagnostics"
  }));
}
