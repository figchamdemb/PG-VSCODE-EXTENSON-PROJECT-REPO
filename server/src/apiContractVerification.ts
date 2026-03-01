import { compareApiContracts } from "./apiContract/compare";
import { scanApiContractSourcesFromFiles } from "./apiContract/codeScan";
import {
  ApiContractMismatch,
  ApiContractRuleId,
  ContractSourceMode
} from "./apiContract/types";
import type { ApiContractThresholds } from "./policyVaultTypes";

type VerificationSeverity = "blocker" | "warning";

export interface ApiContractVerificationFileInput {
  path?: string;
  content?: string | null;
}

export interface ApiContractVerificationRequest {
  options?: {
    max_files?: number;
  };
  files?: ApiContractVerificationFileInput[];
}

export interface ApiContractVerificationIssue {
  rule_id: string;
  severity: VerificationSeverity;
  file_path: string | null;
  method: string | null;
  path: string | null;
  line: number | null;
  message: string;
  hint: string;
}

export interface ApiContractVerificationMismatch {
  rule_id: ApiContractRuleId;
  severity: VerificationSeverity;
  file_path: string;
  method: string;
  path: string;
  line: number;
  message: string;
}

export interface ApiContractVerificationUnmatchedCall {
  file_path: string;
  method: string;
  path: string;
  line: number;
}

export interface ApiContractVerificationResult {
  ok: boolean;
  status: "pass" | "blocked";
  evaluator_version: "api-contract-verification-v1";
  summary: {
    checked_files: number;
    blockers: number;
    warnings: number;
    source_mode: ContractSourceMode;
    openapi_files: number;
    backend_endpoints: number;
    frontend_calls: number;
    mismatches: number;
    unmatched_frontend_calls: number;
    evaluated_at: string;
  };
  blockers: ApiContractVerificationIssue[];
  warnings: ApiContractVerificationIssue[];
  mismatches: ApiContractVerificationMismatch[];
  unmatched_frontend_calls: ApiContractVerificationUnmatchedCall[];
}

const DEFAULT_MAX_FILES = 1200;

export function evaluateApiContractVerification(
  requestBody: ApiContractVerificationRequest,
  thresholds?: ApiContractThresholds | null
): ApiContractVerificationResult {
  const blockers: ApiContractVerificationIssue[] = [];
  const warnings: ApiContractVerificationIssue[] = [];
  const maxFiles = normalizeMaxFiles(requestBody.options?.max_files, thresholds?.max_files ?? DEFAULT_MAX_FILES);
  const files = Array.isArray(requestBody.files) ? requestBody.files : [];

  if (files.length === 0) {
    pushFinding(blockers, {
      rule_id: "API-INPUT-001",
      severity: "blocker",
      file_path: null,
      method: null,
      path: null,
      line: null,
      message: "No files were provided for API contract verification.",
      hint: "Send source files (frontend/backend/OpenAPI) in the verification payload."
    });
  }
  if (files.length > maxFiles) {
    pushFinding(blockers, {
      rule_id: "API-INPUT-002",
      severity: "blocker",
      file_path: null,
      method: null,
      path: null,
      line: null,
      message: `Verification payload exceeds max_files limit (${files.length} > ${maxFiles}).`,
      hint: "Reduce files or increase max_files in the request options."
    });
  }

  const normalizedFiles = normalizeFiles(files, maxFiles, blockers);
  const scan = scanApiContractSourcesFromFiles(normalizedFiles);
  const sourceMode: ContractSourceMode =
    scan.openApiContracts.length > 0 ? "openapi" : "backend-inference";
  const contracts = scan.openApiContracts.length > 0 ? scan.openApiContracts : scan.backendContracts;
  const comparison = compareApiContracts(contracts, scan.frontendCalls);

  if (scan.frontendCalls.length > 0 && contracts.length === 0) {
    pushFinding(blockers, {
      rule_id: "API-CONTRACT-001",
      severity: "blocker",
      file_path: null,
      method: null,
      path: null,
      line: null,
      message: "Frontend API calls detected but no backend/OpenAPI contracts were discovered.",
      hint: "Provide OpenAPI spec files or backend route sources to verify contracts."
    });
  }

  const mismatches = comparison.mismatches.map(toVerificationMismatch);
  for (const mismatch of mismatches) {
    const finding = toMismatchFinding(mismatch);
    if (mismatch.severity === "blocker") {
      pushFinding(blockers, finding);
    } else {
      pushFinding(warnings, finding);
    }
  }

  const unmatched = comparison.unmatchedFrontendCalls.map((call) => ({
    file_path: call.file,
    method: call.method,
    path: call.path,
    line: call.line
  }));
  for (const call of unmatched) {
    pushFinding(warnings, {
      rule_id: "API-MATCH-001",
      severity: "warning",
      file_path: call.file_path,
      method: call.method,
      path: call.path,
      line: call.line,
      message: "Frontend API call does not match any discovered backend contract.",
      hint: "Confirm endpoint method/path exists and is represented in OpenAPI or backend routes."
    });
  }

  return {
    ok: blockers.length === 0,
    status: blockers.length === 0 ? "pass" : "blocked",
    evaluator_version: "api-contract-verification-v1",
    summary: {
      checked_files: scan.filesScanned,
      blockers: blockers.length,
      warnings: warnings.length,
      source_mode: sourceMode,
      openapi_files: scan.openApiFiles.length,
      backend_endpoints: contracts.length,
      frontend_calls: scan.frontendCalls.length,
      mismatches: mismatches.length,
      unmatched_frontend_calls: unmatched.length,
      evaluated_at: new Date().toISOString()
    },
    blockers,
    warnings,
    mismatches,
    unmatched_frontend_calls: unmatched
  };
}

function normalizeFiles(
  files: ApiContractVerificationFileInput[],
  maxFiles: number,
  blockers: ApiContractVerificationIssue[]
): Array<{ path: string; content: string }> {
  const normalized: Array<{ path: string; content: string }> = [];
  for (const file of files.slice(0, maxFiles)) {
    const filePath = normalizePath(file.path);
    const content = typeof file.content === "string" ? file.content : "";
    if (!filePath || !content) {
      pushFinding(blockers, {
        rule_id: "API-INPUT-003",
        severity: "blocker",
        file_path: filePath || null,
        method: null,
        path: null,
        line: null,
        message: "Each file must include both path and non-empty content.",
        hint: "Rebuild file payload with full source content."
      });
      continue;
    }
    normalized.push({ path: filePath, content });
  }
  return normalized;
}

function normalizePath(input: string | undefined): string {
  return (input ?? "").trim().replace(/\\/g, "/");
}

function normalizeMaxFiles(value: number | undefined, fallback: number = DEFAULT_MAX_FILES): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const normalized = Math.floor(value);
  if (normalized < 1) {
    return fallback;
  }
  return normalized;
}

function pushFinding(
  target: ApiContractVerificationIssue[],
  finding: ApiContractVerificationIssue
): void {
  target.push(finding);
}

function toVerificationMismatch(mismatch: ApiContractMismatch): ApiContractVerificationMismatch {
  return {
    rule_id: mismatch.ruleId,
    severity: mismatch.severity,
    file_path: mismatch.file,
    method: mismatch.method,
    path: mismatch.path,
    line: mismatch.line,
    message: mismatch.message
  };
}

function toMismatchFinding(
  mismatch: ApiContractVerificationMismatch
): ApiContractVerificationIssue {
  return {
    rule_id: mismatch.rule_id,
    severity: mismatch.severity,
    file_path: mismatch.file_path,
    method: mismatch.method,
    path: mismatch.path,
    line: mismatch.line,
    message: mismatch.message,
    hint: resolveMismatchHint(mismatch.rule_id)
  };
}

function resolveMismatchHint(ruleId: ApiContractRuleId): string {
  switch (ruleId) {
    case "API-REQ-001":
      return "Include required backend request fields in the frontend payload.";
    case "API-REQ-002":
      return "Align frontend and backend field names to one canonical schema.";
    case "API-TYPE-001":
      return "Align request field types between frontend and backend contract.";
    case "API-RES-001":
      return "Align frontend response-field reads with backend/OpenAPI response schema.";
    default:
      return "Align frontend and backend API contracts.";
  }
}
