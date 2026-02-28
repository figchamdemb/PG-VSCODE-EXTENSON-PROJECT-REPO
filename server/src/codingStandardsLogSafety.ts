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

type CodingStandardsVerificationFinding = {
  rule_id: string;
  severity: VerificationSeverity;
  file_path: string | null;
  component_type: ComponentType | null;
  message: string;
  hint: string;
};

const CONSOLE_LOG_PATTERN = /\bconsole\.(log|info|warn|error|debug|trace)\s*\(/;
const RUNTIME_LOG_PATTERN = /\b(?:app|request|reply)\.log\.(info|warn|error|debug|trace|fatal)\s*\(/;
const SAFE_WRAPPER_CALL_PATTERN = /\bsafeLog(?:Info|Warn|Error)\s*\(/;
const SANITIZATION_SIGNAL_PATTERN = /\bsanitizeLog(?:Text|Value)\s*\(/;
const SANITIZED_MESSAGE_LINE_PATTERN = /\bapp\.log\.(info|warn|error|debug|trace|fatal)\s*\(\s*sanitizedMessage\b/;

export function evaluateLogSafety(
  path: string,
  componentType: ComponentType,
  content: string,
  blockers: CodingStandardsVerificationFinding[]
): number {
  if (isTestPath(path)) {
    return 0;
  }
  let findings = 0;
  if (hasUnsafeLogCall(content, CONSOLE_LOG_PATTERN)) {
    pushFinding(blockers, {
      rule_id: "COD-LOG-001",
      severity: "blocker",
      file_path: path,
      component_type: componentType,
      message: "Direct console logging detected.",
      hint: "Use sanitized logger wrappers to prevent log-forgery/log-injection via untrusted input."
    });
    findings += 1;
  }
  if (hasUnsafeLogCall(content, RUNTIME_LOG_PATTERN)) {
    pushFinding(blockers, {
      rule_id: "COD-LOG-002",
      severity: "blocker",
      file_path: path,
      component_type: componentType,
      message: "Direct runtime logger call detected.",
      hint: "Use centralized safeLog wrappers that sanitize message and metadata before emit."
    });
    findings += 1;
  }
  return findings;
}

function hasUnsafeLogCall(content: string, pattern: RegExp): boolean {
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) {
      continue;
    }
    if (!pattern.test(line)) {
      continue;
    }
    if (SAFE_WRAPPER_CALL_PATTERN.test(line)) {
      continue;
    }
    if (SANITIZATION_SIGNAL_PATTERN.test(line)) {
      continue;
    }
    if (SANITIZED_MESSAGE_LINE_PATTERN.test(line)) {
      continue;
    }
    return true;
  }
  return false;
}

function pushFinding(
  target: CodingStandardsVerificationFinding[],
  finding: CodingStandardsVerificationFinding
): void {
  target.push(finding);
}

function isTestPath(path: string): boolean {
  return (
    path.includes("/__tests__/") ||
    path.includes("/tests/") ||
    /\.test\./.test(path) ||
    /\.spec\./.test(path)
  );
}
