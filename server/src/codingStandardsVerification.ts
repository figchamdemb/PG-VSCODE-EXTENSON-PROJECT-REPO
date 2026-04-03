import { countRegexMatches, scanFunctions } from "./codingStandardsFunctionScan";
import { evaluateNestModuleRules } from "./codingStandardsNestModuleRules";
import { evaluateLogSafety } from "./codingStandardsLogSafety";
import { evaluateQueryOptimization } from "./codingStandardsQueryOptimization";
import { evaluateSecretSafety } from "./codingStandardsSecretSafety";
import type { CodingStandardsThresholds } from "./policyVaultTypes";
type VerificationSeverity = "blocker" | "warning";
type ComponentType =
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
type ComponentLimit = {
  target: number;
  hard: number;
  label: string;
};
const ABSOLUTE_FILE_HARD_LIMIT = 500;
const FUNCTION_TARGET_LIMIT = 20;
const FUNCTION_HARD_LIMIT = 40;
const PARAM_TARGET_LIMIT = 3;
const PARAM_HARD_LIMIT = 5;
const CONTROLLER_BRANCH_HARD_LIMIT = 2;
const MAX_FINDINGS_PER_FILE = 25;
const BASE_COMPONENT_LIMITS: Record<ComponentType, ComponentLimit | null> = {
  controller: { target: 80, hard: 150, label: "controller" },
  service: { target: 200, hard: 500, label: "service" },
  repository: { target: 150, hard: 300, label: "repository" },
  dto: { target: 50, hard: 120, label: "dto" },
  entity: { target: 100, hard: 200, label: "entity/model" },
  utility: { target: 80, hard: 200, label: "utility/helper" },
  component: { target: 150, hard: 250, label: "component" },
  hook: { target: 80, hard: 150, label: "custom hook" },
  config: { target: 60, hard: 120, label: "config" },
  module: { target: 60, hard: 120, label: "module" },
  screen: { target: 450, hard: 500, label: "screen/page" },
  page: { target: 450, hard: 500, label: "screen/page" },
  test: { target: 300, hard: 500, label: "test" },
  unknown: null
};
const CONTROLLER_BRANCH_PATTERN = /\b(if|for|while|switch)\s*\(/g;
const CONTROLLER_TRY_PATTERN = /\btry\s*\{/;
const CONTROLLER_DATA_ACCESS_PATTERN =
  /\b(repository|repo|prisma|typeorm|sequelize|entitymanager|jdbctemplate|mongotemplate|knex|db)\b/i;
const INPUT_SURFACE_PATTERN =
  /\b(req|request)\.(body|query|params)\b|@\s*(Body|Query|Param)\b|request\.(json|formData|text)\s*\(|new\s+URL\s*\(\s*request\.url/;
const VALIDATION_SIGNAL_PATTERN =
  /from\s+["']zod["']|z\.object\s*\(|\.safeParse\s*\(|ValidationPipe|class-validator|@UsePipes|Joi|yup|valibot|superstruct|ajv|checkSchema|celebrate|schema\.(parse|safeParse)\s*\(/i;
const BODY_DTO_HINT_PATTERN =
  /@Body\s*\(\s*\)\s*[A-Za-z0-9_]+\s*:\s*[A-Za-z0-9_]*Dto\b/;
export interface CodingFileInput {
  path?: string;
  content?: string | null;
  language?: string | null;
  component_hint?: string | null;
}
export interface CodingStandardsVerificationRequest {
  project_framework?: string;
  options?: {
    enforce_function_limits?: boolean;
    max_files?: number;
  };
  files?: CodingFileInput[];
}
export interface CodingStandardsVerificationFinding {
  rule_id: string;
  severity: VerificationSeverity;
  file_path: string | null;
  component_type: ComponentType | null;
  message: string;
  hint: string;
}
export interface CodingStandardsVerificationResult {
  ok: boolean;
  status: "pass" | "blocked";
  evaluator_version: "coding-standards-v1";
  summary: {
    checked_files: number;
    blockers: number;
    warnings: number;
    project_framework: string;
    evaluated_at: string;
  };
  blockers: CodingStandardsVerificationFinding[];
  warnings: CodingStandardsVerificationFinding[];
}
interface EvalContext {
  normalizedFramework: string;
  enforceFunctionLimits: boolean;
  thresholds: CodingStandardsThresholds | null | undefined;
}

export function evaluateCodingStandardsVerification(
  requestBody: CodingStandardsVerificationRequest,
  thresholds?: CodingStandardsThresholds | null
): CodingStandardsVerificationResult {
  const blockers: CodingStandardsVerificationFinding[] = [];
  const warnings: CodingStandardsVerificationFinding[] = [];
  const normalizedFramework = normalizeFramework(requestBody.project_framework);
  const enforceFunctionLimits = requestBody.options?.enforce_function_limits !== false;
  const maxFiles = normalizeMaxFiles(requestBody.options?.max_files);
  const files = Array.isArray(requestBody.files) ? requestBody.files : [];
  const inputOk = validateInputPayload(files, maxFiles, blockers);
  const ctx: EvalContext = { normalizedFramework, enforceFunctionLimits, thresholds };
  let checkedFiles = 0;
  if (inputOk) {
    for (const file of files) checkedFiles += evaluateSingleFile(file, ctx, blockers, warnings);
  }
  return buildVerificationResult(checkedFiles, blockers, warnings, normalizedFramework);
}

function validateInputPayload(
  files: CodingFileInput[], maxFiles: number | null,
  blockers: CodingStandardsVerificationFinding[]
): boolean {
  if (files.length === 0) {
    pushFinding(blockers, { rule_id: "COD-INPUT-001", severity: "blocker", file_path: null, component_type: null,
      message: "No files were provided for coding standards verification.", hint: "Send file path and content payloads to the verifier." });
  }
  if (maxFiles !== null && files.length > maxFiles) {
    pushFinding(blockers, { rule_id: "COD-INPUT-002", severity: "blocker", file_path: null, component_type: null,
      message: `Verification payload exceeds max_files limit (${files.length} > ${maxFiles}).`, hint: "Split the payload into smaller batches or increase max_files." });
  }
  return true;
}

function evaluateSingleFile(
  file: CodingFileInput, ctx: EvalContext,
  blockers: CodingStandardsVerificationFinding[], warnings: CodingStandardsVerificationFinding[]
): number {
  const filePath = normalizePath(file.path);
  const content = typeof file.content === "string" ? file.content : "";
  if (!filePath || !content) {
    pushFinding(blockers, { rule_id: "COD-INPUT-003", severity: "blocker", file_path: filePath || null, component_type: null,
      message: "Each file must include both path and non-empty content.", hint: "Rebuild file payload with complete source text." });
    return 0;
  }
  const componentType = detectComponentType(filePath, file.component_hint);
  const lineCount = countLines(content);
  const maxFindings = ctx.thresholds?.max_findings_per_file ?? MAX_FINDINGS_PER_FILE;
  let f = evaluateFileSizeLimits(filePath, componentType, lineCount, ctx, blockers, warnings);
  if (f < maxFindings) f += evaluateLogSafety(filePath, componentType, content, blockers);
  if (f < maxFindings) f += evaluateSecretSafety(filePath, componentType, content, blockers);
  if (f < maxFindings) f += evaluateQueryOptimization(filePath, componentType, content, blockers, warnings, maxFindings);
  if (ctx.normalizedFramework === "nestjs" && f < maxFindings) {
    f += evaluateNestModuleRules(filePath, componentType, content, blockers, warnings);
  }
  if (componentType === "controller") {
    f += evaluateControllerPatterns(filePath, content, blockers, ctx.thresholds);
    f += evaluateInputValidation(filePath, componentType, content, blockers);
  }
  if (ctx.enforceFunctionLimits && f < maxFindings) f += evaluateFunctionLimits(filePath, componentType, content, blockers, warnings, ctx.thresholds);
  return 1;
}

function evaluateFileSizeLimits(
  path: string, componentType: ComponentType, lineCount: number, ctx: EvalContext,
  blockers: CodingStandardsVerificationFinding[], warnings: CodingStandardsVerificationFinding[]
): number {
  let findings = 0;
  if (lineCount > (ctx.thresholds?.absolute_file_hard_limit ?? ABSOLUTE_FILE_HARD_LIMIT)) {
    pushFinding(blockers, { rule_id: "COD-LIMIT-001", severity: "blocker", file_path: path, component_type: componentType,
      message: `File exceeds absolute size limit (${lineCount} > ${ctx.thresholds?.absolute_file_hard_limit ?? ABSOLUTE_FILE_HARD_LIMIT}).`, hint: "Split code into smaller files before production." });
    findings += 1;
  }
  const componentLimit = resolveComponentLimit(componentType, ctx.normalizedFramework);
  if (componentLimit && lineCount > componentLimit.hard) {
    pushFinding(blockers, { rule_id: "COD-LIMIT-002", severity: "blocker", file_path: path, component_type: componentType,
      message: `${componentLimit.label} file exceeds hard limit (${lineCount} > ${componentLimit.hard}).`, hint: `Refactor ${componentLimit.label} into smaller units with single responsibility.` });
    findings += 1;
  } else if (componentLimit && lineCount > componentLimit.target) {
    pushFinding(warnings, { rule_id: "COD-LIMIT-003", severity: "warning", file_path: path, component_type: componentType,
      message: `${componentLimit.label} file is above target size (${lineCount} > ${componentLimit.target}).`, hint: "Consider extraction to keep code review and maintenance efficient." });
    findings += 1;
  }
  return findings;
}

function buildVerificationResult(
  checkedFiles: number, blockers: CodingStandardsVerificationFinding[],
  warnings: CodingStandardsVerificationFinding[], framework: string
): CodingStandardsVerificationResult {
  return {
    ok: blockers.length === 0, status: blockers.length === 0 ? "pass" : "blocked",
    evaluator_version: "coding-standards-v1",
    summary: { checked_files: checkedFiles, blockers: blockers.length, warnings: warnings.length,
      project_framework: framework, evaluated_at: new Date().toISOString() },
    blockers, warnings
  };
}
function normalizeFramework(framework: string | undefined): string {
  const value = (framework ?? "unknown").trim().toLowerCase();
  if (!value) {
    return "unknown";
  }
  if (value === "springboot" || value === "spring") {
    return "spring";
  }
  return value;
}
function normalizeMaxFiles(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < 1) {
    return null;
  }
  return Math.floor(value);
}
function normalizePath(input: string | undefined): string {
  if (!input) {
    return "";
  }
  return input.trim().replace(/\\/g, "/");
}
function countLines(content: string): number {
  return content.split(/\r?\n/).length;
}
function resolveComponentLimit(
  componentType: ComponentType,
  framework: string
): ComponentLimit | null {
  const base = BASE_COMPONENT_LIMITS[componentType];
  if (!base) {
    return null;
  }
  if (framework === "nestjs" && componentType === "service") {
    return { ...base, hard: 400 };
  }
  if (framework === "nextjs" && componentType === "component") {
    return { ...base, hard: 250 };
  }
  if (framework === "nextjs" && componentType === "hook") {
    return { ...base, hard: 150 };
  }
  if (framework === "spring" && componentType === "controller") {
    return { ...base, hard: 150 };
  }
  if (framework === "spring" && componentType === "service") {
    return { ...base, hard: 500 };
  }
  return base;
}
type ComponentRule = { match: (path: string, file: string) => boolean; type: ComponentType };

const COMPONENT_RULES: ComponentRule[] = [
  { match: (p) => isTestPath(p), type: "test" },
  { match: (p, f) => p.includes("/controllers/") || /controller\.(ts|tsx|js|jsx|java|kt)$/.test(f), type: "controller" },
  { match: (p) => isApiRoutePath(p), type: "controller" },
  { match: (p, f) => p.includes("/services/") || /service\.(ts|tsx|js|jsx|java|kt)$/.test(f), type: "service" },
  { match: (p, f) => p.includes("/repositories/") || /repository\.(ts|tsx|js|jsx|java|kt)$/.test(f), type: "repository" },
  { match: (p, f) => p.includes("/dto/") || /dto\.(ts|tsx|js|jsx|java|kt)$/.test(f), type: "dto" },
  { match: (p, f) => p.includes("/entities/") || /entity\.(ts|tsx|js|jsx|java|kt)$/.test(f), type: "entity" },
  { match: (p, f) => p.includes("/hooks/") || /^use[A-Za-z0-9_-]+\.(ts|tsx|js|jsx)$/.test(f), type: "hook" },
  { match: (p, f) => p.includes("/components/") || /\.component\.(ts|tsx|js|jsx)$/.test(f), type: "component" },
  { match: (p, f) => p.includes("/screens/") || /screen\.(ts|tsx|js|jsx|dart|kt)$/.test(f), type: "screen" },
  { match: (p, f) => p.includes("/pages/") || /\/app\/.+\/page\.(ts|tsx|js|jsx)$/.test(p) || /page\.(ts|tsx|js|jsx)$/.test(f), type: "page" },
  { match: (p) => p.includes("/utils/") || p.includes("/helpers/"), type: "utility" },
  { match: (p, f) => p.includes("/config/") || /config\.(ts|js|json|ya?ml)$/i.test(f), type: "config" },
  { match: (p, f) => p.includes("/modules/") || /module\.(ts|js|java|kt)$/.test(f), type: "module" },
  { match: (p, f) => p.includes("/models/") || /model\.(ts|tsx|js|jsx|java|kt)$/.test(f), type: "entity" },
];

function detectComponentType(path: string, hint: string | null | undefined): ComponentType {
  const hinted = (hint ?? "").trim().toLowerCase();
  if (isComponentType(hinted)) return hinted;
  const normalized = path.toLowerCase();
  const fileName = normalized.split("/").pop() ?? normalized;
  for (const rule of COMPONENT_RULES) {
    if (rule.match(normalized, fileName)) return rule.type;
  }
  return "unknown";
}
function isComponentType(value: string): value is ComponentType {
  return (
    value === "controller" ||
    value === "service" ||
    value === "repository" ||
    value === "dto" ||
    value === "entity" ||
    value === "utility" ||
    value === "component" ||
    value === "hook" ||
    value === "config" ||
    value === "module" ||
    value === "screen" ||
    value === "page" ||
    value === "test" ||
    value === "unknown"
  );
}
function isTestPath(path: string): boolean {
  return (
    path.includes("/__tests__/") ||
    path.includes("/tests/") ||
    /\.test\./.test(path) ||
    /\.spec\./.test(path)
  );
}
type ControllerRule = {
  pattern: RegExp;
  ruleId: string;
  message: (path: string, count?: number) => string;
  hint: string;
  countBased?: boolean;
  limit?: number;
};

const CONTROLLER_RULES: ControllerRule[] = [
  { pattern: CONTROLLER_BRANCH_PATTERN, ruleId: "COD-CTRL-001", countBased: true,
    message: (p, c) => `Controller has branching complexity above limit (${c} > ${CONTROLLER_BRANCH_HARD_LIMIT}).`,
    hint: "Move business branching to a service/use-case layer." },
  { pattern: CONTROLLER_TRY_PATTERN, ruleId: "COD-CTRL-002",
    message: () => "Controller contains try/catch block.",
    hint: "Use global exception handlers/filter middleware for controller errors." },
  { pattern: CONTROLLER_DATA_ACCESS_PATTERN, ruleId: "COD-CTRL-003",
    message: () => "Controller appears to contain direct data-access references.",
    hint: "Route requests to services; keep repositories/ORM out of controllers." },
];

function evaluateControllerPatterns(
  path: string, content: string,
  blockers: CodingStandardsVerificationFinding[],
  thresholds?: CodingStandardsThresholds | null
): number {
  let findings = 0;
  for (const rule of CONTROLLER_RULES) {
    if (rule.countBased) {
      const count = countRegexMatches(content, rule.pattern);
      const limit = thresholds?.controller_branch_hard_limit ?? rule.limit ?? CONTROLLER_BRANCH_HARD_LIMIT;
      if (count <= limit) continue;
      pushFinding(blockers, { rule_id: rule.ruleId, severity: "blocker", file_path: path, component_type: "controller", message: rule.message(path, count), hint: rule.hint });
    } else {
      if (!rule.pattern.test(content)) continue;
      pushFinding(blockers, { rule_id: rule.ruleId, severity: "blocker", file_path: path, component_type: "controller", message: rule.message(path), hint: rule.hint });
    }
    findings += 1;
  }
  return findings;
}
function evaluateInputValidation(
  path: string,
  componentType: ComponentType,
  content: string,
  blockers: CodingStandardsVerificationFinding[]
): number {
  if (!INPUT_SURFACE_PATTERN.test(content)) {
    return 0;
  }
  if (VALIDATION_SIGNAL_PATTERN.test(content) || BODY_DTO_HINT_PATTERN.test(content)) {
    return 0;
  }
  pushFinding(blockers, {
    rule_id: "COD-VAL-001",
    severity: "blocker",
    file_path: path,
    component_type: componentType,
    message: "Input handling detected without schema validation.",
    hint: "Validate request payloads with Zod or equivalent schema validation before business logic."
  });
  return 1;
}

function evaluateSingleFunctionScan(
  scan: { name: string; bodyLineCount: number; parameterCount: number },
  path: string, componentType: ComponentType,
  blockers: CodingStandardsVerificationFinding[], warnings: CodingStandardsVerificationFinding[],
  thresholds?: CodingStandardsThresholds | null
): number {
  let f = 0;
  const hardLimit = thresholds?.function_hard_limit ?? FUNCTION_HARD_LIMIT;
  const targetLimit = thresholds?.function_target_limit ?? FUNCTION_TARGET_LIMIT;
  if (scan.bodyLineCount > hardLimit) {
    pushFinding(blockers, { rule_id: "COD-FUNC-001", severity: "blocker", file_path: path, component_type: componentType,
      message: `Function ${scan.name} exceeds hard body limit (${scan.bodyLineCount} > ${hardLimit}).`, hint: "Split logic into smaller methods with single responsibility." });
    f += 1;
  } else if (scan.bodyLineCount > targetLimit) {
    pushFinding(warnings, { rule_id: "COD-FUNC-002", severity: "warning", file_path: path, component_type: componentType,
      message: `Function ${scan.name} is above target body limit (${scan.bodyLineCount} > ${targetLimit}).`, hint: "Consider extracting helper methods for readability." });
    f += 1;
  }
  const paramHard = thresholds?.param_hard_limit ?? PARAM_HARD_LIMIT;
  const paramTarget = thresholds?.param_target_limit ?? PARAM_TARGET_LIMIT;
  if (scan.parameterCount > paramHard) {
    pushFinding(blockers, { rule_id: "COD-FUNC-003", severity: "blocker", file_path: path, component_type: componentType,
      message: `Function ${scan.name} exceeds hard parameter limit (${scan.parameterCount} > ${paramHard}).`, hint: "Wrap related inputs into an object/DTO." });
    f += 1;
  } else if (scan.parameterCount > paramTarget) {
    pushFinding(warnings, { rule_id: "COD-FUNC-004", severity: "warning", file_path: path, component_type: componentType,
      message: `Function ${scan.name} is above target parameter limit (${scan.parameterCount} > ${paramTarget}).`, hint: "Prefer <=3 parameters or use a dedicated argument object." });
    f += 1;
  }
  return f;
}

function evaluateFunctionLimits(
  path: string, componentType: ComponentType, content: string,
  blockers: CodingStandardsVerificationFinding[], warnings: CodingStandardsVerificationFinding[],
  thresholds?: CodingStandardsThresholds | null
): number {
  let findings = 0;
  const maxFindings = thresholds?.max_findings_per_file ?? MAX_FINDINGS_PER_FILE;
  for (const scan of scanFunctions(content)) {
    if (findings >= maxFindings) break;
    findings += evaluateSingleFunctionScan(scan, path, componentType, blockers, warnings, thresholds);
  }
  return findings;
}
function pushFinding(
  target: CodingStandardsVerificationFinding[],
  finding: CodingStandardsVerificationFinding
): void {
  target.push(finding);
}

function isApiRoutePath(path: string): boolean {
  return (
    /\/api\/.+\/route\.(ts|tsx|js|jsx)$/.test(path) ||
    /\/routes\/.+\.(ts|tsx|js|jsx)$/.test(path) ||
    /route\.(ts|tsx|js|jsx)$/.test(path)
  );
}
