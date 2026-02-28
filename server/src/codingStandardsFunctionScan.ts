export interface FunctionScanRecord {
  name: string;
  startLine: number;
  bodyLineCount: number;
  parameterCount: number;
}

export function scanFunctions(content: string): FunctionScanRecord[] {
  const lines = content.split(/\r?\n/);
  const scans: FunctionScanRecord[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!isFunctionSignatureLine(line)) {
      index += 1;
      continue;
    }
    const signature = line.trim();
    const startLine = index + 1;
    let depth = 0;
    let endIndex = index;
    let foundBody = false;
    for (let pointer = index; pointer < lines.length; pointer += 1) {
      const currentLine = lines[pointer];
      depth += countChar(currentLine, "{");
      depth -= countChar(currentLine, "}");
      if (countChar(currentLine, "{") > 0) {
        foundBody = true;
      }
      if (foundBody && depth <= 0) {
        endIndex = pointer;
        break;
      }
    }
    if (!foundBody || endIndex <= index) {
      index += 1;
      continue;
    }
    scans.push({
      name: extractFunctionName(signature),
      startLine,
      bodyLineCount: countBodyLines(lines, index, endIndex),
      parameterCount: extractParameterCount(signature)
    });
    index = endIndex + 1;
  }
  return scans;
}

export function countRegexMatches(value: string, regex: RegExp): number {
  const matches = value.match(regex);
  return matches ? matches.length : 0;
}

function isFunctionSignatureLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
    return false;
  }
  if (!trimmed.includes("(") || !trimmed.includes("{")) {
    return false;
  }
  if (/^(if|for|while|switch|catch|else|do)\b/.test(trimmed)) {
    return false;
  }
  if (/=>\s*\{/.test(trimmed)) {
    return true;
  }
  if (/\bfunction\b/.test(trimmed)) {
    return true;
  }
  if (/^(public|private|protected|internal)\b/.test(trimmed)) {
    return true;
  }
  if (/^(async\s+)?[A-Za-z_][\w$]*\s*\([^)]*\)\s*(?::[^{}]+)?\s*\{/.test(trimmed)) {
    return true;
  }
  return /constructor\s*\([^)]*\)\s*\{/.test(trimmed);
}

function extractFunctionName(signature: string): string {
  const functionNamed = signature.match(/\bfunction\s+([A-Za-z_][\w$]*)\s*\(/);
  if (functionNamed) {
    return functionNamed[1];
  }
  const methodNamed = signature.match(
    /^(?:public|private|protected|internal|static|async|override|final|\s)*\s*([A-Za-z_][\w$]*)\s*\(/
  );
  if (methodNamed) {
    return methodNamed[1];
  }
  const arrowNamed = signature.match(/^([A-Za-z_][\w$]*)\s*=\s*\(/);
  if (arrowNamed) {
    return arrowNamed[1];
  }
  if (/constructor\s*\(/.test(signature)) {
    return "constructor";
  }
  return "anonymous";
}

function extractParameterCount(signature: string): number {
  const openIndex = signature.indexOf("(");
  const closeIndex = signature.lastIndexOf(")");
  if (openIndex < 0 || closeIndex <= openIndex) {
    return 0;
  }
  const body = signature.slice(openIndex + 1, closeIndex).trim();
  if (!body) {
    return 0;
  }
  return body
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0).length;
}

function countBodyLines(lines: string[], startIndex: number, endIndex: number): number {
  let count = 0;
  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed === "{" || trimmed === "}") {
      continue;
    }
    count += 1;
  }
  return count;
}

function countChar(line: string, char: "{" | "}"): number {
  let count = 0;
  for (const current of line) {
    if (current === char) {
      count += 1;
    }
  }
  return count;
}
