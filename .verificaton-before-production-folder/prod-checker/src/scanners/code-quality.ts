import { Scanner, ScanContext, Finding } from "../types";

export const codeQualityScanner: Scanner = {
  name: "Code Quality Scanner",
  description: "Checks LOC limits, console.log, inline patterns, TypeScript strictness",
  supportedStacks: [
    "nextjs", "react", "react-native", "nestjs", "typescript",
    "flutter", "kotlin-android", "java-spring-boot",
    "python-fastapi", "python-django",
  ],

  async scan(ctx: ScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const file of ctx.files) {
      const isCode = [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".kt", ".dart"].includes(file.extension);
      if (!isCode) continue;

      checkLocLimit(file.relativePath, file.loc, findings, file.extension);
      checkConsoleStatements(file.relativePath, file.content, findings, file.extension);
      checkInlineFunctions(file.relativePath, file.content, findings, ctx.detectedStack);
      checkInlineStyles(file.relativePath, file.content, findings, ctx.detectedStack);
      checkTodoFixme(file.relativePath, file.content, findings);
    }

    // Project-level checks
    checkTypescriptStrict(ctx, findings);
    checkAnyType(ctx, findings);

    return findings;
  },
};

function checkLocLimit(filePath: string, loc: number, findings: Finding[], ext: string): void {
  const LOC_LIMIT = 500;
  const isFrontend = [".tsx", ".jsx", ".dart", ".kt"].includes(ext);
  const isScreen = /screen|page|view|activity|fragment/i.test(filePath);

  if (loc > LOC_LIMIT) {
    findings.push({
      ruleId: "CODE-001",
      category: "code-quality",
      severity: "blocker",
      status: "fail",
      title: `File exceeds ${LOC_LIMIT} LOC limit (${loc} lines)`,
      detail: `${filePath} has ${loc} lines. Maximum allowed is ${LOC_LIMIT}`,
      file: filePath,
      recommendation: isFrontend
        ? "Extract logic into custom hooks, utilities, or sub-components"
        : "Extract into service classes, utilities, or sub-modules",
    });
  } else if (loc > LOC_LIMIT * 0.9 && isScreen) {
    findings.push({
      ruleId: "CODE-001",
      category: "code-quality",
      severity: "warning",
      status: "fail",
      title: `File approaching LOC limit (${loc}/${LOC_LIMIT} lines)`,
      detail: `${filePath} is at ${Math.round((loc / LOC_LIMIT) * 100)}% of the limit`,
      file: filePath,
      recommendation: "Consider extracting logic to prevent exceeding the limit",
    });
  }
}

function checkConsoleStatements(filePath: string, content: string, findings: Finding[], ext: string): void {
  // Skip test files
  if (/\.test\.|\.spec\.|__tests__|__mocks__/.test(filePath)) return;

  let pattern: RegExp;
  let name: string;

  switch (ext) {
    case ".ts":
    case ".tsx":
    case ".js":
    case ".jsx":
      pattern = /console\.(log|debug|info)\s*\(/g;
      name = "console.log";
      break;
    case ".py":
      pattern = /\bprint\s*\(/g;
      name = "print()";
      break;
    case ".dart":
      pattern = /\bprint\s*\(/g;
      name = "print()";
      break;
    case ".kt":
    case ".java":
      pattern = /System\.out\.print|println\s*\(/g;
      name = "System.out.println";
      break;
    default:
      return;
  }

  const lines = content.split("\n");
  let count = 0;
  let firstLine = -1;

  for (let i = 0; i < lines.length; i++) {
    // Skip comments
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) continue;

    if (pattern.test(lines[i])) {
      count++;
      if (firstLine === -1) firstLine = i + 1;
    }
    pattern.lastIndex = 0;
  }

  if (count > 0) {
    findings.push({
      ruleId: "CODE-002",
      category: "code-quality",
      severity: "warning",
      status: "fail",
      title: `${name} statements found (${count} occurrences)`,
      detail: `${count} ${name} statement(s) found in ${filePath}`,
      file: filePath,
      line: firstLine,
      recommendation: ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx"
        ? "Remove console statements or use babel-plugin-transform-remove-console for production builds"
        : "Replace with structured logging (structured logger with log levels)",
    });
  }
}

function checkInlineFunctions(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  if (![".tsx", ".jsx"].includes(filePath.slice(filePath.lastIndexOf(".")))) return;

  // Detect inline arrow functions in event handlers within JSX
  const inlinePatterns = [
    /(?:onPress|onClick|onChange|onSubmit|onBlur|onFocus)\s*=\s*\{\s*\(\s*\)\s*=>/g,
    /(?:onPress|onClick|onChange|onSubmit|onBlur|onFocus)\s*=\s*\{\s*\(\s*\w+\s*\)\s*=>/g,
    /(?:onPress|onClick|onChange|onSubmit|onBlur|onFocus)\s*=\s*\{\s*\(\s*\w+\s*:\s*\w+\s*\)\s*=>/g,
  ];

  const lines = content.split("\n");
  let count = 0;
  let firstLine = -1;

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of inlinePatterns) {
      if (pattern.test(lines[i])) {
        count++;
        if (firstLine === -1) firstLine = i + 1;
      }
      pattern.lastIndex = 0;
    }
  }

  if (count > 2) {
    // Only flag if multiple occurrences (single inline on a non-memoized component is often fine)
    findings.push({
      ruleId: "CODE-003",
      category: "performance",
      severity: "warning",
      status: "fail",
      title: `Inline functions in render (${count} occurrences)`,
      detail: `${count} inline arrow functions in event handlers found in ${filePath}`,
      file: filePath,
      line: firstLine,
      recommendation: "Extract handler functions and wrap with useCallback to maintain stable references for memoized children",
    });
  }
}

function checkInlineStyles(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  if (!stack.includes("react-native")) return;
  if (!filePath.endsWith(".tsx") && !filePath.endsWith(".jsx")) return;

  // Detect style={{ ... }} in React Native (should use StyleSheet.create)
  const inlineStylePattern = /style\s*=\s*\{\s*\{/g;
  const lines = content.split("\n");
  let count = 0;
  let firstLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (inlineStylePattern.test(lines[i])) {
      count++;
      if (firstLine === -1) firstLine = i + 1;
    }
    inlineStylePattern.lastIndex = 0;
  }

  if (count > 0) {
    findings.push({
      ruleId: "CODE-004",
      category: "performance",
      severity: "warning",
      status: "fail",
      title: `Inline styles detected (${count} occurrences)`,
      detail: `React Native inline styles create new objects every render`,
      file: filePath,
      line: firstLine,
      recommendation: "Use StyleSheet.create() for all styles",
    });
  }
}

function checkTodoFixme(filePath: string, content: string, findings: Finding[]): void {
  const lines = content.split("\n");
  let count = 0;

  for (const line of lines) {
    if (/\b(?:TODO|FIXME|HACK|XXX|TEMP)\b/i.test(line)) {
      count++;
    }
  }

  if (count > 0) {
    findings.push({
      ruleId: "CODE-005",
      category: "code-quality",
      severity: "info",
      status: "fail",
      title: `${count} TODO/FIXME comments found`,
      detail: `${filePath} contains ${count} unresolved TODO/FIXME markers`,
      file: filePath,
      recommendation: "Resolve or create tickets for all TODO/FIXME items before production",
    });
  }
}

function checkTypescriptStrict(ctx: ScanContext, findings: Finding[]): void {
  if (!ctx.detectedStack.includes("typescript")) return;

  const tsconfig = ctx.files.find((f) => f.relativePath === "tsconfig.json");
  if (!tsconfig) {
    findings.push({
      ruleId: "CODE-006",
      category: "code-quality",
      severity: "warning",
      status: "fail",
      title: "tsconfig.json not found",
      detail: "No TypeScript configuration file detected at project root",
      recommendation: "Create tsconfig.json with strict: true",
    });
    return;
  }

  try {
    const config = JSON.parse(tsconfig.content);
    if (!config.compilerOptions?.strict) {
      findings.push({
        ruleId: "CODE-006",
        category: "code-quality",
        severity: "warning",
        status: "fail",
        title: "TypeScript strict mode not enabled",
        detail: 'tsconfig.json does not have "strict": true',
        file: "tsconfig.json",
        recommendation: 'Set "strict": true in compilerOptions for maximum type safety',
      });
    }
  } catch {
    // Can't parse tsconfig, skip
  }
}

function checkAnyType(ctx: ScanContext, findings: Finding[]): void {
  if (!ctx.detectedStack.includes("typescript")) return;

  let totalAny = 0;
  for (const file of ctx.files) {
    if (file.extension !== ".ts" && file.extension !== ".tsx") continue;
    if (/\.test\.|\.spec\./.test(file.relativePath)) continue;

    // Count explicit 'any' type annotations
    const anyMatches = file.content.match(/:\s*any\b/g);
    if (anyMatches) totalAny += anyMatches.length;
  }

  if (totalAny > 5) {
    findings.push({
      ruleId: "CODE-007",
      category: "code-quality",
      severity: "warning",
      status: "fail",
      title: `Excessive use of 'any' type (${totalAny} occurrences)`,
      detail: `Found ${totalAny} explicit 'any' type annotations across the project`,
      recommendation: "Replace 'any' with specific types or 'unknown' with type guards",
    });
  }
}
