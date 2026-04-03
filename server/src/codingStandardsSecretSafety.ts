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

const PRIVATE_KEY_BLOCK_PATTERN = /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/;
const SECRET_ASSIGNMENT_PATTERN =
  /\b([A-Za-z0-9_]*(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|jwt[_-]?secret|signing[_-]?key)[A-Za-z0-9_]*)\b\s*[:=]\s*["'`]([^"'`\r\n]{8,})["'`]/i;
const QUOTED_SECRET_KEY_PATTERN =
  /["'`]([A-Za-z0-9_]*(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|jwt[_-]?secret|signing[_-]?key)[A-Za-z0-9_]*)["'`]\s*:\s*["'`]([^"'`\r\n]{8,})["'`]/i;
const SAFE_SECRET_REFERENCES_PATTERN = /\b(process\.env|import\.meta\.env|configService\.get|ConfigService|getEnv\(|env\.)/i;
const PLACEHOLDER_SECRET_VALUE_PATTERN =
  /(change[-_]?me|example|sample|placeholder|dummy|fake|mock|test|local|todo|replace[-_]?me|not[-_]?real|secret[_-]?here|token[_-]?here|password[_-]?here|your[_-]?|xxx+)/i;

export function evaluateSecretSafety(
  path: string,
  componentType: ComponentType,
  content: string,
  blockers: CodingStandardsVerificationFinding[]
): number {
  if (isTestPath(path)) {
    return 0;
  }
  let findings = 0;

  if (PRIVATE_KEY_BLOCK_PATTERN.test(content)) {
    pushFinding(blockers, {
      rule_id: "COD-SEC-002",
      severity: "blocker",
      file_path: path,
      component_type: componentType,
      message: "Private key material detected in source code.",
      hint: "Move private keys to env/vault/KMS and remove committed key material from source."
    });
    findings += 1;
  }

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || SAFE_SECRET_REFERENCES_PATTERN.test(line)) {
      continue;
    }
    const match = line.match(SECRET_ASSIGNMENT_PATTERN) ?? line.match(QUOTED_SECRET_KEY_PATTERN);
    if (!match) {
      continue;
    }
    const secretName = match[1] ?? "secret";
    const secretValue = match[2] ?? "";
    if (!secretValue || PLACEHOLDER_SECRET_VALUE_PATTERN.test(secretValue)) {
      continue;
    }
    pushFinding(blockers, {
      rule_id: "COD-SEC-001",
      severity: "blocker",
      file_path: path,
      component_type: componentType,
      message: `Hardcoded secret-like literal detected for ${secretName}.`,
      hint: "Move credentials/tokens/secrets to env or secret storage and inject them at runtime."
    });
    findings += 1;
    break;
  }

  return findings;
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
