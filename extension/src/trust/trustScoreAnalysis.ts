import * as vscode from "vscode";
import {
  buildTrustReportMarkdown,
  countLines,
  countRegexMatches,
  detectComponentType,
  findFirstMatchingLine,
  getStatusBackgroundColor,
  getStatusTextColor,
  isApiRouteFile,
  getValidationLibraryPolicy,
  getValidationLibraryState,
  normalizePath,
  resolveGrade,
  resolveStatus,
  type ValidationLibraryPolicy
} from "./trustScoreAnalysisUtils";
import type {
  ComponentType,
  TrustFinding,
  TrustReport,
  TrustSeverity
} from "./trustScoreTypes";

export { buildTrustReportMarkdown, getStatusBackgroundColor, getStatusTextColor };

type ComponentLimit = {
  target: number;
  hard: number;
  label: string;
};

const ABSOLUTE_FILE_HARD_LIMIT = 500;
const FUNCTION_TARGET_LIMIT = 20;
const FUNCTION_HARD_LIMIT = 40;
const CONTROLLER_BRANCH_HARD_LIMIT = 2;

const COMPONENT_LIMITS: Record<ComponentType, ComponentLimit | null> = {
  controller: { target: 80, hard: 150, label: "controller" },
  service: { target: 200, hard: 500, label: "service" },
  repository: { target: 150, hard: 300, label: "repository" },
  component: { target: 150, hard: 250, label: "component" },
  hook: { target: 80, hard: 150, label: "custom hook" },
  screen: { target: 450, hard: 500, label: "screen/page" },
  page: { target: 450, hard: 500, label: "screen/page" },
  test: { target: 300, hard: 500, label: "test" },
  unknown: null
};

const CONTROLLER_BRANCH_PATTERN = /\b(if|for|while|switch)\s*\(/gu;
const CONTROLLER_TRY_PATTERN = /\btry\s*\{/u;
const CONTROLLER_DATA_ACCESS_PATTERN =
  /\b(repository|repo|prisma|typeorm|sequelize|entitymanager|jdbctemplate|mongotemplate|knex|db)\b/iu;
const INPUT_SURFACE_PATTERN =
  /\b(req|request)\.(body|query|params)\b|@\s*(Body|Query|Param)\b|request\.(json|formData|text)\s*\(|new\s+URL\s*\(\s*request\.url/u;
const VALIDATION_SIGNAL_PATTERN =
  /from\s+["']zod["']|z\.object\s*\(|\.safeParse\s*\(|ValidationPipe|class-validator|@UsePipes|Joi|yup|valibot|superstruct|ajv|checkSchema|celebrate|schema\.(parse|safeParse)\s*\(/iu;
const BODY_DTO_HINT_PATTERN =
  /@Body\s*\(\s*\)\s*[A-Za-z0-9_]+\s*:\s*[A-Za-z0-9_]*Dto\b/u;

export function computeTrustReport(document: vscode.TextDocument): TrustReport {
  const relativeFile = normalizePath(vscode.workspace.asRelativePath(document.uri, false));
  const content = document.getText();
  const lineCount = countLines(content);
  const componentType = detectComponentType(relativeFile);
  const findings = collectAllFindings(document, relativeFile, lineCount, componentType);
  const blockers = findings.filter((f) => f.severity === "blocker").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const score = Math.max(0, 100 - blockers * 15 - warnings * 4);
  return {
    score, status: resolveStatus(score, blockers), grade: resolveGrade(score),
    blockers, warnings, findings: findings.sort(sortFindings),
    file: relativeFile, lineCount, componentType, updatedAtUtc: new Date().toISOString()
  };
}

function collectAllFindings(
  document: vscode.TextDocument, file: string, lineCount: number, ct: ComponentType
): TrustFinding[] {
  return [
    ...scanForAbsoluteFileLimit(file, lineCount, ct),
    ...scanForComponentLimits(file, lineCount, ct),
    ...scanForValidationLibraryRequirement(file, ct),
    ...(ct === "controller" ? scanControllerStructure(document, file) : []),
    ...scanForMissingInputValidation(document, file, ct),
    ...scanForHardcodedSecrets(document, file, ct),
    ...scanForEmptyCatch(document, file, ct),
    ...scanForConsoleUsage(document, file, ct),
    ...scanForFunctionLimits(document, file, ct),
    ...scanTypeDiagnostics(document, file, ct)
  ];
}

function scanForAbsoluteFileLimit(
  file: string,
  lineCount: number,
  componentType: ComponentType
): TrustFinding[] {
  if (lineCount <= ABSOLUTE_FILE_HARD_LIMIT) {
    return [];
  }
  return [
    {
      ruleId: "TRUST-CSTD-001",
      severity: "blocker",
      message: `File exceeds absolute line cap (${lineCount} > ${ABSOLUTE_FILE_HARD_LIMIT}).`,
      file,
      line: 1,
      componentType
    }
  ];
}

function scanForComponentLimits(
  file: string,
  lineCount: number,
  componentType: ComponentType
): TrustFinding[] {
  const limit = COMPONENT_LIMITS[componentType];
  if (!limit) {
    return [];
  }

  if (lineCount > limit.hard) {
    return [
      {
        ruleId: "TRUST-CSTD-002",
        severity: "blocker",
        message: `${limit.label} file exceeds hard limit (${lineCount} > ${limit.hard}).`,
        file,
        line: 1,
        componentType
      }
    ];
  }

  if (lineCount > limit.target) {
    return [
      {
        ruleId: "TRUST-CSTD-003",
        severity: "warning",
        message: `${limit.label} file is above target size (${lineCount} > ${limit.target}).`,
        file,
        line: 1,
        componentType
      }
    ];
  }

  return [];
}

function scanForValidationLibraryRequirement(
  file: string,
  componentType: ComponentType
): TrustFinding[] {
  const policy = getValidationLibraryPolicy();
  if (policy === "off") {
    return [];
  }
  if (componentType !== "controller" && !isApiRouteFile(file)) {
    return [];
  }

  const state = getValidationLibraryState();
  if (state.detected.length > 0) {
    return [];
  }

  const severity: TrustSeverity = policy === "required" ? "blocker" : "warning";
  const message =
    "No validation library package detected in dependencies (install Zod or equivalent).";
  return [
    {
      ruleId: "TRUST-CSTD-VAL-002",
      severity,
      message,
      file,
      line: 1,
      componentType
    }
  ];
}

function scanControllerStructure(
  document: vscode.TextDocument,
  file: string
): TrustFinding[] {
  const findings: TrustFinding[] = [];
  const content = document.getText();

  const branchCount = countRegexMatches(content, CONTROLLER_BRANCH_PATTERN);
  if (branchCount > CONTROLLER_BRANCH_HARD_LIMIT) {
    findings.push({
      ruleId: "TRUST-CSTD-CTRL-001",
      severity: "blocker",
      message: `Controller branching complexity is too high (${branchCount} > ${CONTROLLER_BRANCH_HARD_LIMIT}).`,
      file,
      line: 1,
      componentType: "controller"
    });
  }

  if (CONTROLLER_TRY_PATTERN.test(content)) {
    findings.push({
      ruleId: "TRUST-CSTD-CTRL-002",
      severity: "blocker",
      message: "Controller contains try/catch. Use global error handlers instead.",
      file,
      line: 1,
      componentType: "controller"
    });
  }

  if (CONTROLLER_DATA_ACCESS_PATTERN.test(content)) {
    findings.push({
      ruleId: "TRUST-CSTD-CTRL-003",
      severity: "blocker",
      message: "Controller appears to include direct repository/DB references.",
      file,
      line: 1,
      componentType: "controller"
    });
  }

  return findings;
}

function scanForHardcodedSecrets(
  document: vscode.TextDocument,
  file: string,
  componentType: ComponentType
): TrustFinding[] {
  const findings: TrustFinding[] = [];
  const secretPattern =
    /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*["'`][A-Za-z0-9_\-+/=]{10,}["'`]/iu;
  const safeMarkerPattern = /\b(example|dummy|sample|placeholder|test)\b/iu;
  const lines = document.getText().split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!secretPattern.test(line)) {
      continue;
    }
    if (line.includes("process.env") || safeMarkerPattern.test(line)) {
      continue;
    }
    findings.push({
      ruleId: "TRUST-SEC-001",
      severity: "blocker",
      message: "Potential hardcoded secret or token detected.",
      file,
      line: index + 1,
      componentType
    });
  }

  return findings;
}

function scanForMissingInputValidation(
  document: vscode.TextDocument,
  file: string,
  componentType: ComponentType
): TrustFinding[] {
  const isControllerLike = componentType === "controller" || isApiRouteFile(file);
  if (!isControllerLike) {
    return [];
  }

  const text = document.getText();
  if (!INPUT_SURFACE_PATTERN.test(text)) {
    return [];
  }

  const hasValidationSignal =
    VALIDATION_SIGNAL_PATTERN.test(text) || BODY_DTO_HINT_PATTERN.test(text);
  if (hasValidationSignal) {
    return [];
  }

  const lines = text.split(/\r?\n/u);
  const firstLine = findFirstMatchingLine(lines, INPUT_SURFACE_PATTERN) ?? 1;
  return [
    {
      ruleId: "TRUST-CSTD-VAL-001",
      severity: "blocker",
      message:
        "Input handling detected without schema validation (Zod/ValidationPipe/Joi/etc).",
      file,
      line: firstLine,
      componentType
    }
  ];
}

function scanForEmptyCatch(
  document: vscode.TextDocument,
  file: string,
  componentType: ComponentType
): TrustFinding[] {
  const findings: TrustFinding[] = [];
  const text = document.getText();
  const pattern = /catch\s*\([^)]*\)\s*\{([\s\S]*?)\}/gu;
  for (const match of text.matchAll(pattern)) {
    const body = match[1]
      .replace(/\/\/.*$/gmu, "")
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .trim();
    if (body.length > 0) {
      continue;
    }
    const startOffset = match.index ?? 0;
    const line = document.positionAt(startOffset).line + 1;
    findings.push({
      ruleId: "TRUST-CODE-001",
      severity: "warning",
      message: "Empty catch block can hide runtime failures.",
      file,
      line,
      componentType
    });
  }
  return findings;
}

function scanForConsoleUsage(
  document: vscode.TextDocument,
  file: string,
  componentType: ComponentType
): TrustFinding[] {
  const findings: TrustFinding[] = [];
  const pattern = /\bconsole\.(log|debug|info)\s*\(/u;
  const lines = document.getText().split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    if (!pattern.test(lines[index])) {
      continue;
    }
    findings.push({
      ruleId: "TRUST-CODE-002",
      severity: "warning",
      message: "Console logging detected in committed code path.",
      file,
      line: index + 1,
      componentType
    });
  }
  return findings;
}

function scanForFunctionLimits(
  document: vscode.TextDocument,
  file: string,
  componentType: ComponentType
): TrustFinding[] {
  const findings: TrustFinding[] = [];
  const lines = document.getText().split(/\r?\n/u);
  const startPattern =
    /^\s*(?:export\s+)?(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{|^\s*(?:const|let|var)\s+[A-Za-z0-9_]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{|^\s*(?:public|private|protected)?\s*(?:async\s+)?[A-Za-z0-9_]+\s*\([^)]*\)\s*\{/u;

  for (let index = 0; index < lines.length; index += 1) {
    if (!startPattern.test(lines[index])) {
      continue;
    }

    const endIndex = findBlockEndLine(lines, index);
    if (endIndex === null) {
      continue;
    }

    const length = endIndex - index + 1;
    if (length > FUNCTION_HARD_LIMIT) {
      findings.push({
        ruleId: "TRUST-CSTD-FUNC-001",
        severity: "blocker",
        message: `Function body exceeds hard limit (${length} > ${FUNCTION_HARD_LIMIT}).`,
        file,
        line: index + 1,
        componentType
      });
      continue;
    }

    if (length > FUNCTION_TARGET_LIMIT) {
      findings.push({
        ruleId: "TRUST-CSTD-FUNC-002",
        severity: "warning",
        message: `Function body is above target limit (${length} > ${FUNCTION_TARGET_LIMIT}).`,
        file,
        line: index + 1,
        componentType
      });
    }
  }

  return findings;
}

function findBlockEndLine(lines: string[], startLine: number): number | null {
  let depth = 0;
  let started = false;
  for (let lineIndex = startLine; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (const char of line) {
      if (char === "{") {
        depth += 1;
        started = true;
      } else if (char === "}") {
        depth -= 1;
      }
    }
    if (started && depth <= 0) {
      return lineIndex;
    }
  }
  return null;
}

function scanTypeDiagnostics(
  document: vscode.TextDocument,
  file: string,
  componentType: ComponentType
): TrustFinding[] {
  const findings: TrustFinding[] = [];
  const diagnostics = vscode.languages.getDiagnostics(document.uri);
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
      findings.push({
        ruleId: "TRUST-TS-001",
        severity: "blocker",
        message: diagnostic.message,
        file,
        line: diagnostic.range.start.line + 1,
        componentType
      });
      continue;
    }
    if (diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
      findings.push({
        ruleId: "TRUST-TS-002",
        severity: "warning",
        message: diagnostic.message,
        file,
        line: diagnostic.range.start.line + 1,
        componentType
      });
    }
  }
  return findings;
}

function sortFindings(left: TrustFinding, right: TrustFinding): number {
  const severityRank = left.severity === right.severity
    ? 0
    : left.severity === "blocker"
      ? -1
      : 1;
  if (severityRank !== 0) {
    return severityRank;
  }
  const lineLeft = left.line ?? Number.MAX_SAFE_INTEGER;
  const lineRight = right.line ?? Number.MAX_SAFE_INTEGER;
  if (lineLeft !== lineRight) {
    return lineLeft - lineRight;
  }
  return left.ruleId.localeCompare(right.ruleId);
}

