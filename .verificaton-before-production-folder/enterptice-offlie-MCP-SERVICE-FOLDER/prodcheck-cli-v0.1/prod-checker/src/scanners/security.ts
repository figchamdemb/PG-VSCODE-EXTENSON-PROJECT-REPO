import { Scanner, ScanContext, Finding } from "../types";

export const securityScanner: Scanner = {
  name: "Security Scanner",
  description: "Detects security vulnerabilities: secrets, JWT, CORS, cookies, CSRF, XSS",
  supportedStacks: [
    "nextjs", "react", "react-native", "nestjs", "typescript",
    "java-spring-boot", "python-fastapi", "python-django",
  ],

  async scan(ctx: ScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const file of ctx.files) {
      // Skip non-code files for most checks
      const isCode = [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".kt", ".dart"].includes(file.extension);
      const isConfig = [".json", ".yaml", ".yml", ".env", ".properties", ".toml"].includes(file.extension);

      if (isCode) {
        checkHardcodedSecrets(file.relativePath, file.content, findings);
        checkJwtSecurity(file.relativePath, file.content, findings, ctx.detectedStack);
        checkCorsWildcard(file.relativePath, file.content, findings);
        checkXssVulnerabilities(file.relativePath, file.content, findings, ctx.detectedStack);
        checkInsecureTokenStorage(file.relativePath, file.content, findings, ctx.detectedStack);
        checkCsrfProtection(file.relativePath, file.content, findings, ctx.detectedStack);
        checkSensitiveDataLogging(file.relativePath, file.content, findings);
        checkEvalUsage(file.relativePath, file.content, findings);
        checkSqlInjection(file.relativePath, file.content, findings);
      }

      if (isConfig) {
        checkEnvSecrets(file.relativePath, file.content, findings);
        checkDebugMode(file.relativePath, file.content, findings, ctx.detectedStack);
      }
    }

    return findings;
  },
};

// --- Individual Check Functions ---

function checkHardcodedSecrets(filePath: string, content: string, findings: Finding[]): void {
  const secretPatterns = [
    { regex: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][a-zA-Z0-9_\-]{20,}["']/gi, name: "API key" },
    { regex: /(?:secret|password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/gi, name: "Secret/Password" },
    { regex: /(?:token)\s*[:=]\s*["'][a-zA-Z0-9_\-\.]{20,}["']/gi, name: "Token" },
    { regex: /(?:aws_access_key_id|aws_secret_access_key)\s*[:=]\s*["'][^"']+["']/gi, name: "AWS credential" },
    { regex: /AKIA[0-9A-Z]{16}/g, name: "AWS Access Key ID" },
    { regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, name: "Private key" },
    { regex: /ghp_[a-zA-Z0-9]{36}/g, name: "GitHub Personal Access Token" },
    { regex: /sk-[a-zA-Z0-9]{48}/g, name: "OpenAI API Key" },
  ];

  const lines = content.split("\n");
  for (const pattern of secretPatterns) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.regex.test(lines[i])) {
        // Skip if it's clearly a placeholder or example
        const line = lines[i].toLowerCase();
        if (line.includes("example") || line.includes("placeholder") || line.includes("your_") || line.includes("xxx")) {
          continue;
        }

        findings.push({
          ruleId: "SEC-001",
          category: "security",
          severity: "blocker",
          status: "fail",
          title: `Hardcoded ${pattern.name} detected`,
          detail: `Potential ${pattern.name} found in source code`,
          file: filePath,
          line: i + 1,
          recommendation: "Move to environment variables or a secrets manager (Vault, AWS Secrets Manager)",
        });
        break; // One finding per pattern per file
      }
      pattern.regex.lastIndex = 0; // Reset regex state
    }
  }
}

function checkJwtSecurity(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  // Check for HS256 usage (weak for inter-service auth)
  if (/HS256|["']hs256["']/i.test(content) && /jwt|jsonwebtoken|jose|passport/i.test(content)) {
    const lines = content.split("\n");
    const lineNum = lines.findIndex((l) => /HS256/i.test(l));
    findings.push({
      ruleId: "SEC-002",
      category: "security",
      severity: "warning",
      status: "fail",
      title: "JWT signed with HS256",
      detail: "HS256 (symmetric) is weak for production inter-service auth",
      file: filePath,
      line: lineNum >= 0 ? lineNum + 1 : undefined,
      recommendation: "Use RS256 (asymmetric) for production. HS256 is acceptable for single-service apps only",
    });
  }
}

function checkCorsWildcard(filePath: string, content: string, findings: Finding[]): void {
  const corsWildcardPatterns = [
    /origin:\s*["']\*["']/i,
    /Access-Control-Allow-Origin.*\*/i,
    /cors\(\s*\)/,  // cors() with no options = wildcard
    /allowedOrigins.*\*/i,
  ];

  const lines = content.split("\n");
  for (const pattern of corsWildcardPatterns) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        findings.push({
          ruleId: "SEC-003",
          category: "security",
          severity: "blocker",
          status: "fail",
          title: "CORS wildcard origin detected",
          detail: "Access-Control-Allow-Origin: * allows any website to make requests to your API",
          file: filePath,
          line: i + 1,
          recommendation: "Configure CORS with explicit allowed origins for production",
        });
        return;
      }
    }
  }
}

function checkXssVulnerabilities(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  // dangerouslySetInnerHTML without sanitization
  if (content.includes("dangerouslySetInnerHTML") && !content.includes("DOMPurify") && !content.includes("sanitize")) {
    const lines = content.split("\n");
    const lineNum = lines.findIndex((l) => l.includes("dangerouslySetInnerHTML"));
    findings.push({
      ruleId: "SEC-004",
      category: "security",
      severity: "blocker",
      status: "fail",
      title: "XSS risk: dangerouslySetInnerHTML without sanitization",
      detail: "User-provided HTML rendered without DOMPurify sanitization",
      file: filePath,
      line: lineNum >= 0 ? lineNum + 1 : undefined,
      recommendation: "Sanitize HTML with DOMPurify before rendering: DOMPurify.sanitize(html)",
    });
  }
}

function checkInsecureTokenStorage(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  // localStorage/sessionStorage for auth tokens
  const storagePatterns = [
    /localStorage\.setItem\s*\(\s*["'](?:token|auth|jwt|access_token|refresh_token)/i,
    /sessionStorage\.setItem\s*\(\s*["'](?:token|auth|jwt|access_token|refresh_token)/i,
  ];

  const lines = content.split("\n");
  for (const pattern of storagePatterns) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        findings.push({
          ruleId: "SEC-005",
          category: "security",
          severity: "blocker",
          status: "fail",
          title: "Auth token stored in localStorage/sessionStorage",
          detail: "Tokens in browser storage are vulnerable to XSS attacks",
          file: filePath,
          line: i + 1,
          recommendation: "Store auth tokens in HttpOnly, Secure, SameSite=Strict cookies",
        });
        return;
      }
    }
  }

  // React Native: AsyncStorage for tokens
  if (stack.includes("react-native")) {
    if (/AsyncStorage\.setItem\s*\(\s*["'](?:token|auth|jwt)/i.test(content)) {
      findings.push({
        ruleId: "SEC-005",
        category: "security",
        severity: "blocker",
        status: "fail",
        title: "Auth token stored in AsyncStorage (unencrypted)",
        detail: "AsyncStorage is not secure for sensitive tokens",
        file: filePath,
        recommendation: "Use react-native-keychain or expo-secure-store for token storage",
      });
    }
  }
}

function checkCsrfProtection(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  // Django: check for CSRF middleware disabled
  if (stack.includes("python-django") && content.includes("CsrfViewMiddleware") && content.includes("#")) {
    if (/[#].*CsrfViewMiddleware/.test(content)) {
      findings.push({
        ruleId: "SEC-006",
        category: "security",
        severity: "blocker",
        status: "fail",
        title: "CSRF middleware appears disabled",
        detail: "CsrfViewMiddleware may be commented out",
        file: filePath,
        recommendation: "Enable CSRF protection in production",
      });
    }
  }
}

function checkSensitiveDataLogging(filePath: string, content: string, findings: Finding[]): void {
  const sensitiveLogPatterns = [
    /(?:console\.log|logger?\.\w+|print|Log\.\w)\s*\(.*(?:password|token|secret|apiKey|credit.?card|ssn)/i,
  ];

  const lines = content.split("\n");
  for (const pattern of sensitiveLogPatterns) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        findings.push({
          ruleId: "SEC-007",
          category: "security",
          severity: "blocker",
          status: "fail",
          title: "Sensitive data potentially logged",
          detail: "Logging statement may contain passwords, tokens, or PII",
          file: filePath,
          line: i + 1,
          recommendation: "Remove sensitive data from log statements. Use structured logging with field redaction",
        });
        return;
      }
    }
  }
}

function checkEvalUsage(filePath: string, content: string, findings: Finding[]): void {
  if (/\beval\s*\(/.test(content) || /new\s+Function\s*\(/.test(content)) {
    const lines = content.split("\n");
    const lineNum = lines.findIndex((l) => /\beval\s*\(/.test(l) || /new\s+Function\s*\(/.test(l));
    findings.push({
      ruleId: "SEC-008",
      category: "security",
      severity: "blocker",
      status: "fail",
      title: "eval() or new Function() usage detected",
      detail: "Dynamic code execution is a severe security risk (code injection)",
      file: filePath,
      line: lineNum >= 0 ? lineNum + 1 : undefined,
      recommendation: "Remove eval() and new Function(). Use safe alternatives for dynamic behavior",
    });
  }
}

function checkSqlInjection(filePath: string, content: string, findings: Finding[]): void {
  // Detect string concatenation in SQL queries
  const sqlInjectionPatterns = [
    /(?:query|execute|raw)\s*\(\s*["'`](?:SELECT|INSERT|UPDATE|DELETE).*\$\{/i,
    /(?:query|execute|raw)\s*\(\s*["'`](?:SELECT|INSERT|UPDATE|DELETE).*["'`]\s*\+/i,
  ];

  const lines = content.split("\n");
  for (const pattern of sqlInjectionPatterns) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        findings.push({
          ruleId: "SEC-009",
          category: "security",
          severity: "blocker",
          status: "fail",
          title: "Potential SQL injection: string interpolation in query",
          detail: "SQL query built with string concatenation or template literals containing variables",
          file: filePath,
          line: i + 1,
          recommendation: "Use parameterized queries or prepared statements. Never concatenate user input into SQL",
        });
        return;
      }
    }
  }
}

function checkEnvSecrets(filePath: string, content: string, findings: Finding[]): void {
  // Check for secrets in NEXT_PUBLIC_ env vars
  if (filePath.endsWith(".env") || filePath.includes(".env.")) {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/^NEXT_PUBLIC_.*(?:SECRET|KEY|TOKEN|PASSWORD)/i.test(lines[i])) {
        findings.push({
          ruleId: "SEC-010",
          category: "security",
          severity: "blocker",
          status: "fail",
          title: "Secret exposed via NEXT_PUBLIC_ variable",
          detail: "NEXT_PUBLIC_ variables are bundled into client-side JavaScript and visible to anyone",
          file: filePath,
          line: i + 1,
          recommendation: "Remove NEXT_PUBLIC_ prefix. Access this secret server-side only",
        });
      }
    }
  }
}

function checkDebugMode(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  // Django DEBUG = True
  if (stack.includes("python-django") && /DEBUG\s*=\s*True/i.test(content)) {
    findings.push({
      ruleId: "SEC-011",
      category: "security",
      severity: "blocker",
      status: "fail",
      title: "Django DEBUG = True",
      detail: "Debug mode exposes sensitive information in error pages",
      file: filePath,
      recommendation: "Set DEBUG = False in production settings",
    });
  }
}
