import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { ComponentType, TrustReport } from "./trustScoreService";

export type ValidationLibraryPolicy = "off" | "warn" | "required";

type ValidationLibraryState = {
  detected: string[];
  packageJsonPath: string | null;
};

const SUPPORTED_VALIDATION_LIBRARIES = [
  "zod",
  "valibot",
  "joi",
  "yup",
  "ajv",
  "class-validator",
  "superstruct"
] as const;

let validationLibraryCache:
  | {
      packageJsonPath: string;
      mtimeMs: number;
      detected: string[];
    }
  | undefined;

export function resolveStatus(
  score: number,
  blockerCount: number
): "green" | "yellow" | "red" {
  if (blockerCount > 0 || score < 60) {
    return "red";
  }
  if (score < 85) {
    return "yellow";
  }
  return "green";
}

export function resolveGrade(score: number): string {
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

export function getStatusTextColor(
  status: "green" | "yellow" | "red"
): vscode.ThemeColor | undefined {
  if (status === "yellow") {
    return new vscode.ThemeColor("statusBarItem.warningForeground");
  }
  if (status === "red") {
    return new vscode.ThemeColor("statusBarItem.errorForeground");
  }
  return undefined;
}

export function getStatusBackgroundColor(
  status: "green" | "yellow" | "red"
): vscode.ThemeColor | undefined {
  if (status === "yellow") {
    return new vscode.ThemeColor("statusBarItem.warningBackground");
  }
  if (status === "red") {
    return new vscode.ThemeColor("statusBarItem.errorBackground");
  }
  return undefined;
}

export function buildTrustReportMarkdown(report: TrustReport): string {
  const lines = [
    "# Narrate Trust Score Report",
    "",
    `- File: \`${report.file}\``,
    `- Score: **${report.score}/100** (${report.grade})`,
    `- Status: **${report.status.toUpperCase()}**`,
    `- Blockers: ${report.blockers}`,
    `- Warnings: ${report.warnings}`,
    `- Lines: ${report.lineCount}`,
    `- Component: ${report.componentType}`,
    `- Updated (UTC): ${report.updatedAtUtc}`,
    "",
    "## Findings"
  ];

  if (report.findings.length === 0) {
    lines.push("- None");
    return lines.join("\n");
  }

  for (const finding of report.findings) {
    const lineSuffix = finding.line ? `:${finding.line}` : "";
    lines.push(
      `- [${finding.severity.toUpperCase()}] \`${finding.ruleId}\` ${finding.file}${lineSuffix} - ${finding.message}`
    );
  }
  return lines.join("\n");
}

export function normalizePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}

export function countLines(content: string): number {
  return content.split(/\r?\n/u).length;
}

export function detectComponentType(relativePath: string): ComponentType {
  const normalized = normalizePath(relativePath).toLowerCase();
  const fileName = normalized.split("/").pop() ?? normalized;

  if (isTestPath(normalized)) {
    return "test";
  }
  if (
    normalized.includes("/controllers/") ||
    /controller\.(ts|tsx|js|jsx|java|kt)$/u.test(fileName)
  ) {
    return "controller";
  }
  if (isApiRouteFile(normalized)) {
    return "controller";
  }
  if (
    normalized.includes("/services/") ||
    /service\.(ts|tsx|js|jsx|java|kt)$/u.test(fileName)
  ) {
    return "service";
  }
  if (
    normalized.includes("/repositories/") ||
    /repository\.(ts|tsx|js|jsx|java|kt)$/u.test(fileName)
  ) {
    return "repository";
  }
  if (normalized.includes("/hooks/") || /^use[A-Za-z0-9_-]+\.(ts|tsx|js|jsx)$/u.test(fileName)) {
    return "hook";
  }
  if (
    normalized.includes("/components/") ||
    /\.component\.(ts|tsx|js|jsx)$/u.test(fileName)
  ) {
    return "component";
  }
  if (
    normalized.includes("/screens/") ||
    /screen\.(ts|tsx|js|jsx|dart|kt)$/u.test(fileName)
  ) {
    return "screen";
  }
  if (
    normalized.includes("/pages/") ||
    /\/app\/.+\/page\.(ts|tsx|js|jsx)$/u.test(normalized) ||
    /page\.(ts|tsx|js|jsx)$/u.test(fileName)
  ) {
    return "page";
  }
  return "unknown";
}

export function isApiRouteFile(pathValue: string): boolean {
  return (
    /\/api\/.+\/route\.(ts|tsx|js|jsx)$/u.test(pathValue) ||
    /\/routes\/.+\.(ts|tsx|js|jsx)$/u.test(pathValue) ||
    /route\.(ts|tsx|js|jsx)$/u.test(pathValue)
  );
}

function isTestPath(pathValue: string): boolean {
  return (
    pathValue.includes("/__tests__/") ||
    pathValue.includes("/tests/") ||
    /\.test\./u.test(pathValue) ||
    /\.spec\./u.test(pathValue)
  );
}

export function countRegexMatches(content: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  const matches = content.match(matcher);
  return matches ? matches.length : 0;
}

export function getValidationLibraryPolicy(): ValidationLibraryPolicy {
  const raw = vscode.workspace
    .getConfiguration("narrate")
    .get<string>("trustScore.validationLibraryPolicy", "warn")
    .trim()
    .toLowerCase();
  if (raw === "off" || raw === "required") {
    return raw;
  }
  return "warn";
}

export function getValidationLibraryState(): ValidationLibraryState {
  const packageJsonPath = resolveValidationPackageJsonPath();
  if (!packageJsonPath) {
    return { detected: [], packageJsonPath: null };
  }

  const cached = getCachedValidationLibraryState(packageJsonPath);
  if (cached) {
    return cached;
  }

  return readValidationLibraryState(packageJsonPath);
}

function resolveValidationPackageJsonPath(): string | null {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) {
    return null;
  }
  const candidate = path.join(workspacePath, "package.json");
  return fs.existsSync(candidate) ? candidate : null;
}

function getCachedValidationLibraryState(
  packageJsonPath: string
): ValidationLibraryState | undefined {
  try {
    const stat = fs.statSync(packageJsonPath);
    if (
      validationLibraryCache &&
      validationLibraryCache.packageJsonPath === packageJsonPath &&
      validationLibraryCache.mtimeMs === stat.mtimeMs
    ) {
      return {
        detected: validationLibraryCache.detected,
        packageJsonPath
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function readValidationLibraryState(packageJsonPath: string): ValidationLibraryState {
  try {
    const raw = fs.readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
    const dependencyNames = [
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {})
    ].map((name) => name.toLowerCase());
    const detected = SUPPORTED_VALIDATION_LIBRARIES.filter((name) =>
      dependencyNames.includes(name)
    );
    const stat = fs.statSync(packageJsonPath);
    validationLibraryCache = {
      packageJsonPath,
      mtimeMs: stat.mtimeMs,
      detected: [...detected]
    };
    return { detected: [...detected], packageJsonPath };
  } catch {
    return { detected: [], packageJsonPath };
  }
}

export function findFirstMatchingLine(
  lines: string[],
  pattern: RegExp
): number | undefined {
  for (let index = 0; index < lines.length; index += 1) {
    if (testPattern(lines[index], pattern)) {
      return index + 1;
    }
  }
  return undefined;
}

function testPattern(value: string, pattern: RegExp): boolean {
  const flags = pattern.flags.replace(/g/gu, "");
  return new RegExp(pattern.source, flags).test(value);
}
