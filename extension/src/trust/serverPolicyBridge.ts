import * as vscode from "vscode";
import {
  countLines,
  detectComponentType,
  getValidationLibraryPolicy,
  getValidationLibraryState,
  normalizePath
} from "./trustScoreAnalysisUtils";
import { Logger } from "../utils/logger";
import type { ComponentType, TrustReport } from "./trustScoreTypes";

interface ServerTrustFinding {
  rule_id: string;
  severity: "blocker" | "warning";
  message: string;
  file_path: string;
  line?: number;
  component_type?: ComponentType;
}

interface ServerTrustReport {
  file_path: string;
  component_type: ComponentType;
  line_count: number;
  score: number;
  grade: string;
  status: "green" | "yellow" | "red";
  blockers: number;
  warnings: number;
  findings: ServerTrustFinding[];
}

interface ServerTrustEvaluationResult {
  status: string;
  summary: {
    blockers: number;
    warnings: number;
    checked_files: number;
  };
  reports?: ServerTrustReport[];
}

interface LocalDiagnosticInput {
  severity: "error" | "warning";
  message: string;
  line?: number;
}

function getApiBaseUrl(): string {
  return vscode.workspace
    .getConfiguration("narrate")
    .get<string>("licensing.apiBaseUrl", "http://127.0.0.1:8787")
    .trim();
}

function getConfiguredSessionToken(): string | undefined {
  const token = vscode.workspace
    .getConfiguration("narrate")
    .get<string>("licensing.sessionToken", "")
    .trim();
  return token || undefined;
}

const SERVER_TIMEOUT_MS = 8000;

export async function fetchServerTrustReports(
  documents: vscode.TextDocument[],
  logger: Logger,
  sessionToken?: string
): Promise<TrustReport[]> {
  if (documents.length === 0) {
    return [];
  }

  const apiBase = getApiBaseUrl();
  const token = sessionToken?.trim() || getConfiguredSessionToken();
  if (!token) {
    throw new Error(
      "Authentication required: sign in to Narrate before server trust evaluation can run."
    );
  }

  const payloadFiles = documents.map((document) => buildFilePayload(document));
  try {
    const result = await fetchTrustEvaluation(
      apiBase,
      token,
      getProjectFramework(),
      payloadFiles
    );
    return convertServerReports(result, payloadFiles);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.info(`Server trust bridge: fetch failed (${msg})`);
    throw error;
  }
}

export function buildServerTrustErrorReport(
  document: vscode.TextDocument,
  reason: string
): TrustReport {
  const file = normalizePath(vscode.workspace.asRelativePath(document.uri, false));
  const content = document.getText();
  const componentType = detectComponentType(file);
  return {
    score: 0,
    status: "red",
    grade: "F",
    blockers: 1,
    warnings: 0,
    findings: [
      {
        ruleId: "TRUST-SRV-001",
        severity: "blocker",
        message: reason,
        file,
        line: 1,
        componentType
      }
    ],
    file,
    lineCount: countLines(content),
    componentType,
    updatedAtUtc: new Date().toISOString()
  };
}

async function fetchTrustEvaluation(
  apiBase: string,
  token: string,
  projectFramework: string,
  files: Array<{
    path: string;
    content: string;
    line_count: number;
    component_hint: ComponentType;
    installed_validation_libraries: string[];
    validation_library_policy: "off" | "warn" | "required";
    local_diagnostics: LocalDiagnosticInput[];
  }>
): Promise<ServerTrustEvaluationResult> {
  const url = new URL("/account/policy/trust/evaluate", apiBase).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      body: JSON.stringify({
        project_framework: projectFramework,
        files
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as ServerTrustEvaluationResult;
  } finally {
    clearTimeout(timer);
  }
}

function getProjectFramework(): string {
  return vscode.workspace
    .getConfiguration("narrate")
    .get<string>("enforcement.projectFramework", "unknown")
    .trim() || "unknown";
}

function buildFilePayload(document: vscode.TextDocument): {
  path: string;
  content: string;
  line_count: number;
  component_hint: ComponentType;
  installed_validation_libraries: string[];
  validation_library_policy: "off" | "warn" | "required";
  local_diagnostics: LocalDiagnosticInput[];
} {
  const content = document.getText();
  const pathValue = normalizePath(vscode.workspace.asRelativePath(document.uri, false));
  const componentType = detectComponentType(pathValue);
  return {
    path: pathValue,
    content,
    line_count: countLines(content),
    component_hint: componentType,
    installed_validation_libraries: getValidationLibraryState({ seedUri: document.uri }).detected,
    validation_library_policy: getValidationLibraryPolicy(),
    local_diagnostics: collectLocalDiagnostics(document)
  };
}

function collectLocalDiagnostics(document: vscode.TextDocument): LocalDiagnosticInput[] {
  const diagnostics = vscode.languages.getDiagnostics(document.uri);
  const items: LocalDiagnosticInput[] = [];
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
      items.push({
        severity: "error",
        message: diagnostic.message,
        line: diagnostic.range.start.line + 1
      });
      continue;
    }
    if (diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
      items.push({
        severity: "warning",
        message: diagnostic.message,
        line: diagnostic.range.start.line + 1
      });
    }
  }
  return items;
}

function convertServerReports(
  result: ServerTrustEvaluationResult,
  requestedFiles: Array<{ path: string; content: string; component_hint: ComponentType }>
): TrustReport[] {
  const reports = new Map<string, ServerTrustReport>();
  for (const report of result.reports ?? []) {
    reports.set(normalizePath(report.file_path), report);
  }

  return requestedFiles.map((file) => {
    const report = reports.get(file.path);
    if (!report) {
      return {
        score: 0,
        status: "red",
        grade: "F",
        blockers: 1,
        warnings: 0,
        findings: [
          {
            ruleId: "TRUST-SRV-002",
            severity: "blocker",
            message: "Server trust evaluation returned no report for the active file.",
            file: file.path,
            line: 1,
            componentType: file.component_hint
          }
        ],
        file: file.path,
        lineCount: countLines(file.content),
        componentType: file.component_hint,
        updatedAtUtc: new Date().toISOString()
      };
    }

    return {
      score: report.score,
      status: report.status,
      grade: report.grade,
      blockers: report.blockers,
      warnings: report.warnings,
      findings: report.findings.map((finding) => ({
        ruleId: finding.rule_id,
        severity: finding.severity,
        message: finding.message,
        file: normalizePath(finding.file_path),
        line: finding.line,
        componentType: finding.component_type ?? report.component_type
      })),
      file: normalizePath(report.file_path),
      lineCount: report.line_count,
      componentType: report.component_type,
      updatedAtUtc: new Date().toISOString()
    };
  });
}
