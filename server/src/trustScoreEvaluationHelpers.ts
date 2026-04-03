export type TrustSeverity = "blocker" | "warning";

export type TrustStatus = "green" | "yellow" | "red";

export type TrustGrade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D"
  | "F";

export type TrustComponentType =
  | "controller"
  | "service"
  | "repository"
  | "dto"
  | "entity"
  | "utility"
  | "component"
  | "hook"
  | "config"
  | "module"
  | "screen"
  | "page"
  | "test"
  | "unknown";

export type ValidationLibraryPolicy = "off" | "warn" | "required";

type LocalDiagnosticSeverity = "error" | "warning";

export interface TrustScoreDiagnosticInput {
  severity?: LocalDiagnosticSeverity | null;
  message?: string | null;
  line?: number | null;
}

export interface TrustScoreFileInput {
  path?: string | null;
  content?: string | null;
  line_count?: number | null;
  language?: string | null;
  component_hint?: string | null;
  installed_validation_libraries?: string[] | null;
  validation_library_policy?: ValidationLibraryPolicy | null;
  local_diagnostics?: TrustScoreDiagnosticInput[] | null;
}

export interface TrustScoreEvaluationRequest {
  project_framework?: string;
  files?: TrustScoreFileInput[];
}

export interface TrustScoreFinding {
  rule_id: string;
  severity: TrustSeverity;
  file_path: string;
  component_type: TrustComponentType;
  message: string;
  line?: number;
  source: "server_policy" | "local_diagnostics" | "server_context";
}

export interface TrustScoreFileReport {
  file_path: string;
  component_type: TrustComponentType;
  line_count: number;
  score: number;
  grade: TrustGrade;
  status: TrustStatus;
  blockers: number;
  warnings: number;
  findings: TrustScoreFinding[];
}

export interface TrustScoreEvaluationResult {
  ok: boolean;
  status: "pass" | "blocked";
  evaluator_version: "trust-score-v1";
  summary: {
    checked_files: number;
    blockers: number;
    warnings: number;
    evaluated_at: string;
  };
  reports: TrustScoreFileReport[];
}

export type NormalizedTrustFileInput = {
  path: string;
  content: string;
  lineCount: number;
  componentType: TrustComponentType;
  installedValidationLibraries: string[];
  validationLibraryPolicy: ValidationLibraryPolicy;
  localDiagnostics: TrustScoreDiagnosticInput[];
};

export type CodingFinding = {
  rule_id: string;
  severity: TrustSeverity;
  file_path: string;
  component_type: TrustComponentType;
  message: string;
};

const DEFAULT_VALIDATION_LIBRARY_POLICY: ValidationLibraryPolicy = "warn";

const CODING_RULE_TO_TRUST_RULE = new Map<string, string>([
  ["COD-LIMIT-001", "TRUST-CSTD-001"],
  ["COD-LIMIT-002", "TRUST-CSTD-002"],
  ["COD-LIMIT-003", "TRUST-CSTD-003"],
  ["COD-CTRL-001", "TRUST-CSTD-CTRL-001"],
  ["COD-CTRL-002", "TRUST-CSTD-CTRL-002"],
  ["COD-CTRL-003", "TRUST-CSTD-CTRL-003"],
  ["COD-VAL-001", "TRUST-CSTD-VAL-001"],
  ["COD-FUNC-001", "TRUST-CSTD-FUNC-001"],
  ["COD-FUNC-002", "TRUST-CSTD-FUNC-002"],
  ["COD-FUNC-003", "TRUST-CSTD-FUNC-003"],
  ["COD-FUNC-004", "TRUST-CSTD-FUNC-004"]
]);

const TRUST_COMPONENT_TYPES = new Set<TrustComponentType>([
  "controller",
  "service",
  "repository",
  "dto",
  "entity",
  "utility",
  "component",
  "hook",
  "config",
  "module",
  "screen",
  "page",
  "test",
  "unknown"
]);

export function normalizeFiles(files: TrustScoreFileInput[]): NormalizedTrustFileInput[] {
  return files
    .map((file) => normalizeSingleFile(file))
    .filter((file): file is NormalizedTrustFileInput => file !== undefined);
}

function normalizeSingleFile(
  file: TrustScoreFileInput
): NormalizedTrustFileInput | undefined {
  const pathValue = normalizePath(file.path);
  const content = typeof file.content === "string" ? file.content : "";
  if (!pathValue || !content) {
    return undefined;
  }

  const componentType = normalizeComponentType(file.component_hint, pathValue);
  const lineCount = normalizeLineCount(file.line_count, content);
  return {
    path: pathValue,
    content,
    lineCount,
    componentType,
    installedValidationLibraries: normalizeValidationLibraries(
      file.installed_validation_libraries
    ),
    validationLibraryPolicy: normalizeValidationLibraryPolicy(
      file.validation_library_policy
    ),
    localDiagnostics: normalizeLocalDiagnostics(file.local_diagnostics)
  };
}

function normalizePath(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\\/g, "/");
}

function normalizeLineCount(value: number | null | undefined, content: string): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return content.split(/\r?\n/u).length;
}

function normalizeComponentType(
  hint: string | null | undefined,
  pathValue: string
): TrustComponentType {
  const normalizedHint = (hint ?? "").trim().toLowerCase();
  if (TRUST_COMPONENT_TYPES.has(normalizedHint as TrustComponentType)) {
    return normalizedHint as TrustComponentType;
  }

  const fileName = pathValue.toLowerCase().split("/").pop() ?? pathValue.toLowerCase();
  if (isTestPath(pathValue)) {
    return "test";
  }
  if (
    pathValue.includes("/controllers/") ||
    /controller\.(ts|tsx|js|jsx|java|kt)$/u.test(fileName) ||
    isApiRoutePath(pathValue)
  ) {
    return "controller";
  }
  if (pathValue.includes("/services/") || /service\.(ts|tsx|js|jsx|java|kt)$/u.test(fileName)) {
    return "service";
  }
  if (
    pathValue.includes("/repositories/") ||
    /repository\.(ts|tsx|js|jsx|java|kt)$/u.test(fileName)
  ) {
    return "repository";
  }
  if (pathValue.includes("/dto/") || /dto\.(ts|tsx|js|jsx|java|kt)$/u.test(fileName)) {
    return "dto";
  }
  if (
    pathValue.includes("/entities/") ||
    pathValue.includes("/models/") ||
    /entity\.(ts|tsx|js|jsx|java|kt)$/u.test(fileName) ||
    /model\.(ts|tsx|js|jsx|java|kt)$/u.test(fileName)
  ) {
    return "entity";
  }
  if (
    pathValue.includes("/hooks/") ||
    /^use[A-Za-z0-9_-]+\.(ts|tsx|js|jsx)$/u.test(fileName)
  ) {
    return "hook";
  }
  if (
    pathValue.includes("/components/") ||
    /\.component\.(ts|tsx|js|jsx)$/u.test(fileName)
  ) {
    return "component";
  }
  if (
    pathValue.includes("/screens/") ||
    /screen\.(ts|tsx|js|jsx|dart|kt)$/u.test(fileName)
  ) {
    return "screen";
  }
  if (
    pathValue.includes("/pages/") ||
    /\/app\/.+\/page\.(ts|tsx|js|jsx)$/u.test(pathValue) ||
    /page\.(ts|tsx|js|jsx)$/u.test(fileName)
  ) {
    return "page";
  }
  if (pathValue.includes("/utils/") || pathValue.includes("/helpers/")) {
    return "utility";
  }
  if (pathValue.includes("/config/") || /config\.(ts|js|json|ya?ml)$/iu.test(fileName)) {
    return "config";
  }
  if (pathValue.includes("/modules/") || /module\.(ts|js|java|kt)$/u.test(fileName)) {
    return "module";
  }
  return "unknown";
}

function isTestPath(pathValue: string): boolean {
  return (
    pathValue.includes("/__tests__/") ||
    pathValue.includes("/tests/") ||
    /\.test\./u.test(pathValue) ||
    /\.spec\./u.test(pathValue)
  );
}

function normalizeValidationLibraries(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim().toLowerCase();
    if (trimmed) {
      normalized.add(trimmed);
    }
  }
  return [...normalized];
}

function normalizeValidationLibraryPolicy(
  value: ValidationLibraryPolicy | null | undefined
): ValidationLibraryPolicy {
  if (value === "off" || value === "required") {
    return value;
  }
  return DEFAULT_VALIDATION_LIBRARY_POLICY;
}

function normalizeLocalDiagnostics(
  value: TrustScoreDiagnosticInput[] | null | undefined
): TrustScoreDiagnosticInput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item?.message === "string" && item.message.trim().length > 0)
    .map((item) => ({
      severity: item.severity === "error" ? "error" : "warning",
      message: item.message?.trim() ?? "",
      line:
        typeof item.line === "number" && Number.isFinite(item.line) && item.line > 0
          ? Math.floor(item.line)
          : undefined
    }));
}

export function groupCodingFindings(
  blockers: Array<{
    rule_id: string;
    severity: TrustSeverity;
    file_path: string | null;
    component_type: string | null;
    message: string;
  }>,
  warnings: Array<{
    rule_id: string;
    severity: TrustSeverity;
    file_path: string | null;
    component_type: string | null;
    message: string;
  }>
): Map<string, CodingFinding[]> {
  const findingsByFile = new Map<string, CodingFinding[]>();
  for (const finding of [...blockers, ...warnings]) {
    const filePath = normalizePath(finding.file_path);
    if (!filePath) {
      continue;
    }
    const items = findingsByFile.get(filePath) ?? [];
    items.push({
      rule_id: mapCodingRuleId(finding.rule_id),
      severity: finding.severity,
      file_path: filePath,
      component_type: normalizeComponentType(finding.component_type, filePath),
      message: finding.message
    });
    findingsByFile.set(filePath, items);
  }
  return findingsByFile;
}

function mapCodingRuleId(ruleId: string): string {
  return CODING_RULE_TO_TRUST_RULE.get(ruleId) ?? `SRV-${ruleId}`;
}

export function shouldCheckValidationLibrary(
  pathValue: string,
  componentType: TrustComponentType
): boolean {
  const normalized = pathValue.toLowerCase();
  if (componentType !== "controller" && !isApiRoutePath(normalized)) {
    return false;
  }
  return /\.(cjs|mjs|cts|mts|js|jsx|ts|tsx)$/iu.test(normalized);
}

function isApiRoutePath(pathValue: string): boolean {
  return (
    /\/api\/.+\/route\.(ts|tsx|js|jsx)$/u.test(pathValue) ||
    /\/routes\/.+\.(ts|tsx|js|jsx)$/u.test(pathValue) ||
    /route\.(ts|tsx|js|jsx)$/u.test(pathValue)
  );
}

export function sortTrustFindings(
  left: TrustScoreFinding,
  right: TrustScoreFinding
): number {
  const severityOrder =
    left.severity === right.severity ? 0 : left.severity === "blocker" ? -1 : 1;
  if (severityOrder !== 0) {
    return severityOrder;
  }
  const leftLine = left.line ?? Number.MAX_SAFE_INTEGER;
  const rightLine = right.line ?? Number.MAX_SAFE_INTEGER;
  if (leftLine !== rightLine) {
    return leftLine - rightLine;
  }
  return left.rule_id.localeCompare(right.rule_id);
}

export function resolveStatus(score: number, blockerCount: number): TrustStatus {
  if (blockerCount > 0 || score < 60) {
    return "red";
  }
  if (score < 85) {
    return "yellow";
  }
  return "green";
}

export function resolveGrade(score: number): TrustGrade {
  if (score >= 95) {
    return "A+";
  }
  if (score >= 90) {
    return "A";
  }
  if (score >= 85) {
    return "A-";
  }
  if (score >= 80) {
    return "B+";
  }
  if (score >= 75) {
    return "B";
  }
  if (score >= 70) {
    return "B-";
  }
  if (score >= 65) {
    return "C+";
  }
  if (score >= 60) {
    return "C";
  }
  if (score >= 55) {
    return "C-";
  }
  if (score >= 50) {
    return "D";
  }
  return "F";
}
