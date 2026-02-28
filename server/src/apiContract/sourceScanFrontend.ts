import { FrontendCall } from "./types";
import { normalizeApiPath } from "./path";
import {
  parseAxiosRequestDataFields,
  parseAxiosRequestUrl,
  parseMethodFromOptions,
  parseObjectLiteralFields,
  parseRequestFieldsFromOptions
} from "./sourceScanFields";
import {
  AxiosReceiverContext,
  buildLookaheadChunk,
  FileSnapshot,
  isLikelyBackendFile,
  isScriptFile,
  LOOKAHEAD_LINE_COUNT
} from "./sourceScanModel";

export function extractFrontendCalls(files: FileSnapshot[]): FrontendCall[] {
  const calls: FrontendCall[] = [];
  for (const file of files) {
    if (!isScriptFile(file.relativePath) || isLikelyBackendFile(file.relativePath)) {
      continue;
    }
    const axiosContext = extractAxiosReceiverContext(file.text);
    calls.push(...extractCallsFromLines(file, axiosContext));
  }
  return calls;
}

function extractCallsFromLines(
  file: FileSnapshot,
  axiosContext: AxiosReceiverContext
): FrontendCall[] {
  const calls: FrontendCall[] = [];
  for (let lineIndex = 0; lineIndex < file.lines.length; lineIndex += 1) {
    const line = file.lines[lineIndex];
    if (line.includes("fetch(")) {
      const call = parseFetchCall(file, lineIndex);
      if (call) {
        calls.push(call);
      }
    }
    if (looksLikeAxiosLine(line)) {
      const call = parseAxiosCall(file, lineIndex, axiosContext);
      if (call) {
        calls.push(call);
      }
      const requestCall = parseAxiosRequestCall(file, lineIndex, axiosContext);
      if (requestCall) {
        calls.push(requestCall);
      }
    }
  }
  return calls;
}

function parseFetchCall(file: FileSnapshot, lineIndex: number): FrontendCall | undefined {
  const chunk = buildLookaheadChunk(file.lines, lineIndex);
  const match = chunk.match(
    /fetch\(\s*(['"`])([^'"`]+)\1\s*(?:,\s*(\{[\s\S]*?\}))?\s*\)/u
  );
  if (!match) {
    return undefined;
  }

  const options = match[3] ?? "";
  return {
    method: parseMethodFromOptions(options) ?? "GET",
    path: normalizeApiPath(match[2]),
    file: file.relativePath,
    line: lineIndex + 1,
    requestFields: parseRequestFieldsFromOptions(options),
    responseFields: inferFetchResponseFields(file.lines, lineIndex)
  };
}

function parseAxiosCall(
  file: FileSnapshot,
  lineIndex: number,
  axiosContext: AxiosReceiverContext
): FrontendCall | undefined {
  const chunk = buildLookaheadChunk(file.lines, lineIndex);
  const match = chunk.match(
    /([A-Za-z_][A-Za-z0-9_]*)\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\3\s*(?:,\s*(\{[\s\S]*?\}))?/iu
  );
  if (!match) {
    return undefined;
  }

  const receiver = match[1] ?? "";
  if (!isSupportedAxiosReceiver(receiver, axiosContext)) {
    return undefined;
  }

  const rawPath = match[4] ?? "";
  const resolvedPath = combineBaseAndPath(
    axiosContext.clientBaseUrls.get(receiver),
    rawPath
  );

  return {
    method: (match[2] ?? "get").toUpperCase(),
    path: normalizeApiPath(resolvedPath),
    file: file.relativePath,
    line: lineIndex + 1,
    requestFields: parseObjectLiteralFields(match[5] ?? ""),
    responseFields: inferAxiosResponseFields(file.lines, lineIndex)
  };
}

function parseAxiosRequestCall(
  file: FileSnapshot,
  lineIndex: number,
  axiosContext: AxiosReceiverContext
): FrontendCall | undefined {
  const chunk = buildLookaheadChunk(file.lines, lineIndex);
  const match = chunk.match(
    /([A-Za-z_][A-Za-z0-9_]*)\.request\(\s*(\{[\s\S]*?\})\s*\)/iu
  );
  if (!match) {
    return undefined;
  }

  const receiver = match[1] ?? "";
  if (!isSupportedAxiosReceiver(receiver, axiosContext)) {
    return undefined;
  }

  const requestConfig = match[2] ?? "";
  const method = parseMethodFromOptions(requestConfig) ?? "GET";
  const rawUrl = parseAxiosRequestUrl(requestConfig);
  if (!rawUrl) {
    return undefined;
  }

  const resolvedPath = combineBaseAndPath(
    axiosContext.clientBaseUrls.get(receiver),
    rawUrl
  );

  return {
    method,
    path: normalizeApiPath(resolvedPath),
    file: file.relativePath,
    line: lineIndex + 1,
    requestFields: parseAxiosRequestDataFields(requestConfig),
    responseFields: inferAxiosResponseFields(file.lines, lineIndex)
  };
}

function inferFetchResponseFields(lines: string[], lineIndex: number): string[] {
  const responseVar = extractAssignedVariableName(lines[lineIndex], /\bfetch\(/u);
  if (!responseVar) {
    return [];
  }
  return extractVariablePropertyUses(lines, lineIndex + 1, responseVar);
}

function inferAxiosResponseFields(lines: string[], lineIndex: number): string[] {
  const line = lines[lineIndex];
  const aliasMatch = line.match(
    /const\s+\{\s*data(?:\s*:\s*([A-Za-z_][A-Za-z0-9_]*))?\s*\}\s*=\s*await/u
  );
  if (aliasMatch) {
    return extractVariablePropertyUses(lines, lineIndex + 1, aliasMatch[1] ?? "data");
  }
  const responseVar = extractAssignedVariableName(line, /\baxios\./u);
  if (!responseVar) {
    return [];
  }
  return extractVariablePropertyUses(lines, lineIndex + 1, `${responseVar}.data`);
}

function extractAssignedVariableName(line: string, rhsHint: RegExp): string | undefined {
  const pattern = new RegExp(
    `const\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*await\\s*[^;]*${rhsHint.source}`,
    "u"
  );
  return line.match(pattern)?.[1];
}

function extractVariablePropertyUses(
  lines: string[],
  startLine: number,
  variableToken: string
): string[] {
  const escaped = variableToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\.([A-Za-z_][A-Za-z0-9_]*)\\b`, "gu");
  const names = new Set<string>();
  const upperBound = Math.min(lines.length, startLine + LOOKAHEAD_LINE_COUNT);
  for (let lineIndex = startLine; lineIndex < upperBound; lineIndex += 1) {
    for (const match of lines[lineIndex].matchAll(pattern)) {
      const fieldName = match[1];
      if (fieldName) {
        names.add(fieldName);
      }
    }
  }
  return Array.from(names).sort((left, right) => left.localeCompare(right));
}

function looksLikeAxiosLine(line: string): boolean {
  return /\.[ ]*(?:get|post|put|patch|delete|request)\s*\(/iu.test(line);
}

function isSupportedAxiosReceiver(
  receiver: string,
  axiosContext: AxiosReceiverContext
): boolean {
  return (
    axiosContext.axiosIdentifiers.has(receiver) ||
    axiosContext.clientBaseUrls.has(receiver)
  );
}

function extractAxiosReceiverContext(text: string): AxiosReceiverContext {
  const axiosIdentifiers = extractAxiosIdentifiers(text);
  const clientBaseUrls = extractAxiosClientBaseUrls(text, axiosIdentifiers);
  return { axiosIdentifiers, clientBaseUrls };
}

function extractAxiosIdentifiers(text: string): Set<string> {
  const identifiers = new Set<string>(["axios"]);

  const importDefaultPattern =
    /\bimport\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"`]axios['"`]/gu;
  for (const match of text.matchAll(importDefaultPattern)) {
    const alias = match[1];
    if (alias) {
      identifiers.add(alias);
    }
  }

  const importNamespacePattern =
    /\bimport\s+\*\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\s+from\s*['"`]axios['"`]/gu;
  for (const match of text.matchAll(importNamespacePattern)) {
    const alias = match[1];
    if (alias) {
      identifiers.add(alias);
    }
  }

  const requirePattern =
    /\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*require\(\s*['"`]axios['"`]\s*\)/gu;
  for (const match of text.matchAll(requirePattern)) {
    const alias = match[1];
    if (alias) {
      identifiers.add(alias);
    }
  }

  return identifiers;
}

function extractAxiosClientBaseUrls(
  text: string,
  axiosIdentifiers: Set<string>
): Map<string, string> {
  const byClient = new Map<string, string>();
  const pattern =
    /\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.create\(\s*\{[\s\S]{0,300}?baseURL\s*:\s*(['"`])([^'"`]+)\3[\s\S]{0,300}?\}\s*\)/gu;
  for (const match of text.matchAll(pattern)) {
    const clientName = match[1] ?? "";
    const creatorName = match[2] ?? "";
    const baseUrl = match[4] ?? "";
    if (!clientName || !baseUrl || !axiosIdentifiers.has(creatorName)) {
      continue;
    }
    byClient.set(clientName, baseUrl.trim());
  }
  return byClient;
}

function combineBaseAndPath(baseUrl: string | undefined, rawPath: string): string {
  const pathValue = rawPath.trim();
  if (!baseUrl || !baseUrl.trim()) {
    return pathValue;
  }
  if (!pathValue) {
    return baseUrl.trim();
  }
  if (/^https?:\/\//iu.test(pathValue)) {
    return pathValue;
  }

  const baseValue = baseUrl.trim();
  if (/^https?:\/\//iu.test(baseValue)) {
    try {
      const normalizedBase = baseValue.endsWith("/") ? baseValue : `${baseValue}/`;
      return new URL(pathValue, normalizedBase).toString();
    } catch {
      // Fall through to path concatenation.
    }
  }

  const left = baseValue.endsWith("/") ? baseValue.slice(0, -1) : baseValue;
  const right = pathValue.startsWith("/") ? pathValue.slice(1) : pathValue;
  return `${left}/${right}`;
}
