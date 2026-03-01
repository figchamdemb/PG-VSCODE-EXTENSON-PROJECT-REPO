/**
 * Typed-client extraction — detects frontend API call patterns beyond
 * raw fetch / axios: ky, ofetch/$fetch/useFetch (Nuxt), useSWR (SWR),
 * got, superagent, and custom typed API wrapper functions.
 *
 * Integrated via `extractTypedClientCalls` from the primary
 * `apiContractSourceScanFrontend` module.
 */

import { FrontendCall, FieldShape } from "./apiContractTypes";
import { normalizeApiPath } from "./apiContractPath";
import {
  parseObjectLiteralFields,
  parseMethodFromOptions
} from "./apiContractSourceScanFields";
import {
  FileSnapshot,
  isScriptFile,
  isLikelyBackendFile,
  buildLookaheadChunk
} from "./apiContractSourceScanModel";

/* ── Known HTTP library import specifiers ── */

const KNOWN_HTTP_LIB_PACKAGES = new Set([
  "ky",
  "got",
  "ofetch",
  "superagent"
]);

const HTTP_METHOD_NAMES = new Set([
  "get", "post", "put", "patch", "delete", "head"
]);

/* ── Per-file client context ── */

type FileClientContext = {
  /** Identifiers confirmed as HTTP client receivers in this file. */
  httpReceivers: Set<string>;
};

/* ── Wrapper module discovery (cross-file) ── */

type WrapperModuleSet = Set<string>;

const WRAPPER_FILE_KEYWORDS = /(?:api|client|http|fetcher|service|sdk)\b/iu;

/**
 * Second-pass frontend scanner that captures typed-client calls
 * not handled by the primary fetch/axios scanner.
 */
export function extractTypedClientCalls(files: FileSnapshot[]): FrontendCall[] {
  const wrapperModules = discoverWrapperModules(files);
  const calls: FrontendCall[] = [];
  for (const file of files) {
    if (!isScriptFile(file.relativePath) || isLikelyBackendFile(file.relativePath)) {
      continue;
    }
    const ctx = buildFileClientContext(file.text, wrapperModules);
    calls.push(...scanLinesForTypedCalls(file, ctx));
  }
  return calls;
}

/* ── File-level context building ── */

function buildFileClientContext(
  text: string,
  wrapperModules: WrapperModuleSet
): FileClientContext {
  const httpReceivers = new Set<string>();
  detectKnownLibImports(text, httpReceivers);
  detectWrapperImports(text, wrapperModules, httpReceivers);
  return { httpReceivers };
}

function detectKnownLibImports(text: string, out: Set<string>): void {
  const defaultPattern =
    /\bimport\s+([A-Za-z_]\w*)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"`](ky|got|ofetch|superagent)['"`]/gu;
  for (const match of text.matchAll(defaultPattern)) {
    const alias = match[1];
    if (alias) {
      out.add(alias);
    }
  }

  const namedPattern =
    /\bimport\s*\{([^}]+)\}\s*from\s*['"`](ky|got|ofetch|superagent|nuxt|#imports)['"`]/gu;
  for (const match of text.matchAll(namedPattern)) {
    for (const raw of (match[1] ?? "").split(",")) {
      const parts = raw.trim().split(/\s+as\s+/u);
      const localName = (parts[1] ?? parts[0] ?? "").trim();
      const sourceName = (parts[0] ?? "").trim();
      if (localName && isKnownHttpIdentifier(sourceName)) {
        out.add(localName);
      }
    }
  }

  const requirePattern =
    /\b(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*require\(\s*['"`](ky|got|ofetch|superagent)['"`]\s*\)/gu;
  for (const match of text.matchAll(requirePattern)) {
    const alias = match[1];
    if (alias) {
      out.add(alias);
    }
  }
}

function isKnownHttpIdentifier(name: string): boolean {
  return (
    KNOWN_HTTP_LIB_PACKAGES.has(name) ||
    name === "$fetch" ||
    name === "useFetch" ||
    name === "ofetch"
  );
}

/* ── Wrapper module discovery ── */

function discoverWrapperModules(files: FileSnapshot[]): WrapperModuleSet {
  const modules = new Set<string>();
  for (const file of files) {
    if (!isScriptFile(file.relativePath) || isLikelyBackendFile(file.relativePath)) {
      continue;
    }
    if (isWrapperFileName(file.relativePath) && exportsHttpMethods(file.text)) {
      modules.add(normalizeWrapperModulePath(file.relativePath));
    }
  }
  return modules;
}

function isWrapperFileName(relativePath: string): boolean {
  const base = relativePath.split("/").pop() ?? "";
  return WRAPPER_FILE_KEYWORDS.test(base);
}

const EXPORTED_METHOD_PATTERN =
  /\bexport\s+(?:async\s+)?function\s+(get|post|put|patch|delete)\b/iu;
const EXPORTED_OBJ_METHOD_PATTERN =
  /\bexport\s+(?:const|let)\s+\w+\s*=\s*\{[\s\S]{0,500}?\b(get|post|put|patch|delete)\s*[:(]/iu;
const HTTP_ENGINE_PATTERN =
  /\b(?:fetch|axios|ky|got|ofetch|superagent)\b/iu;

function exportsHttpMethods(text: string): boolean {
  const hasExportedMethods = EXPORTED_METHOD_PATTERN.test(text) || EXPORTED_OBJ_METHOD_PATTERN.test(text);
  const containsHttpEngine = HTTP_ENGINE_PATTERN.test(text);
  return hasExportedMethods || (containsHttpEngine && /\bexport\b/u.test(text));
}

function normalizeWrapperModulePath(relativePath: string): string {
  return relativePath
    .replace(/\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/u, "")
    .replace(/\/index$/u, "");
}

function detectWrapperImports(
  text: string,
  wrapperModules: WrapperModuleSet,
  out: Set<string>
): void {
  const defaultPattern =
    /\bimport\s+([A-Za-z_]\w*)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"`](\.[^'"`]+)['"`]/gu;
  for (const match of text.matchAll(defaultPattern)) {
    const identifier = match[1] ?? "";
    const specifier = match[2] ?? "";
    if (identifier && matchesWrapperModule(specifier, wrapperModules)) {
      out.add(identifier);
    }
  }

  const namedPattern =
    /\bimport\s*\{([^}]+)\}\s*from\s*['"`](\.[^'"`]+)['"`]/gu;
  for (const match of text.matchAll(namedPattern)) {
    const specifier = match[2] ?? "";
    if (!matchesWrapperModule(specifier, wrapperModules)) {
      continue;
    }
    for (const raw of (match[1] ?? "").split(",")) {
      const parts = raw.trim().split(/\s+as\s+/u);
      const localName = (parts[1] ?? parts[0] ?? "").trim();
      if (localName) {
        out.add(localName);
      }
    }
  }
}

function matchesWrapperModule(
  specifier: string,
  wrapperModules: WrapperModuleSet
): boolean {
  const cleaned = specifier
    .replace(/^\.\//, "")
    .replace(/\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/u, "")
    .replace(/\/index$/u, "");
  for (const modulePath of wrapperModules) {
    if (modulePath.endsWith(cleaned) || cleaned.endsWith(modulePath)) {
      return true;
    }
    const moduleBase = modulePath.split("/").pop() ?? "";
    const cleanedBase = cleaned.split("/").pop() ?? "";
    if (moduleBase && cleanedBase && moduleBase === cleanedBase) {
      return true;
    }
  }
  return false;
}

/* ── Line scanner ── */

function scanLinesForTypedCalls(
  file: FileSnapshot,
  ctx: FileClientContext
): FrontendCall[] {
  const calls: FrontendCall[] = [];
  for (let index = 0; index < file.lines.length; index += 1) {
    const line = file.lines[index];

    if (looksLikeMethodCallLine(line, ctx)) {
      const call = tryParseReceiverMethodCall(file, index, ctx);
      if (call) {
        calls.push(call);
      }
    }

    if (/\b(?:\$fetch|ofetch)\s*(?:<|\()/iu.test(line)) {
      const call = tryParseOfetchCall(file, index);
      if (call) {
        calls.push(call);
      }
    }

    if (/\buseSWR\b/u.test(line)) {
      const call = tryParseSwrCall(file, index);
      if (call) {
        calls.push(call);
      }
    }

    if (/\buseFetch\b/u.test(line)) {
      const call = tryParseUseFetchCall(file, index);
      if (call) {
        calls.push(call);
      }
    }
  }
  return calls;
}

function looksLikeMethodCallLine(line: string, ctx: FileClientContext): boolean {
  for (const receiver of ctx.httpReceivers) {
    if (line.includes(receiver)) {
      return true;
    }
  }
  return false;
}

/* ── Individual pattern parsers ── */

function tryParseReceiverMethodCall(
  file: FileSnapshot,
  lineIndex: number,
  ctx: FileClientContext
): FrontendCall | undefined {
  const chunk = buildLookaheadChunk(file.lines, lineIndex);
  const match = chunk.match(
    /([A-Za-z_]\w*)\.(get|post|put|patch|delete|head)\(\s*(['"`])([^'"`]+)\3(?:\s*,\s*(\{[\s\S]*?\}))?\s*\)/iu
  );
  if (!match) {
    return undefined;
  }

  const receiver = match[1] ?? "";
  if (!ctx.httpReceivers.has(receiver)) {
    return undefined;
  }

  const method = (match[2] ?? "get").toUpperCase();
  const rawPath = match[4] ?? "";
  const options = match[5] ?? "";

  return {
    method,
    path: normalizeApiPath(rawPath),
    file: file.relativePath,
    line: lineIndex + 1,
    requestFields: parseTypedClientRequestFields(options, method),
    responseFields: []
  };
}

function tryParseOfetchCall(
  file: FileSnapshot,
  lineIndex: number
): FrontendCall | undefined {
  const chunk = buildLookaheadChunk(file.lines, lineIndex);
  const match = chunk.match(
    /\b(?:\$fetch|ofetch)\s*(?:<[^>]+>)?\s*\(\s*(['"`])([^'"`]+)\1(?:\s*,\s*(\{[\s\S]*?\}))?\s*\)/iu
  );
  if (!match) {
    return undefined;
  }

  const rawUrl = match[2] ?? "";
  if (!rawUrl.includes("/")) {
    return undefined;
  }

  const options = match[3] ?? "";
  return {
    method: parseMethodFromOptions(options) ?? "GET",
    path: normalizeApiPath(rawUrl),
    file: file.relativePath,
    line: lineIndex + 1,
    requestFields: parseTypedClientRequestFields(options, "POST"),
    responseFields: []
  };
}

function tryParseSwrCall(
  file: FileSnapshot,
  lineIndex: number
): FrontendCall | undefined {
  const chunk = buildLookaheadChunk(file.lines, lineIndex);
  const match = chunk.match(
    /\buseSWR\s*(?:<[^>]+>)?\s*\(\s*(['"`])([^'"`]+)\1/iu
  );
  if (!match) {
    return undefined;
  }

  const rawUrl = match[2] ?? "";
  if (!rawUrl.includes("/")) {
    return undefined;
  }

  return {
    method: "GET",
    path: normalizeApiPath(rawUrl),
    file: file.relativePath,
    line: lineIndex + 1,
    requestFields: [],
    responseFields: []
  };
}

function tryParseUseFetchCall(
  file: FileSnapshot,
  lineIndex: number
): FrontendCall | undefined {
  const chunk = buildLookaheadChunk(file.lines, lineIndex);
  const match = chunk.match(
    /\buseFetch\s*(?:<[^>]+>)?\s*\(\s*(['"`])([^'"`]+)\1(?:\s*,\s*(\{[\s\S]*?\}))?\s*\)/iu
  );
  if (!match) {
    return undefined;
  }

  const rawUrl = match[2] ?? "";
  if (!rawUrl.includes("/")) {
    return undefined;
  }

  const options = match[3] ?? "";
  return {
    method: parseMethodFromOptions(options) ?? "GET",
    path: normalizeApiPath(rawUrl),
    file: file.relativePath,
    line: lineIndex + 1,
    requestFields: parseTypedClientRequestFields(options, "POST"),
    responseFields: []
  };
}

/* ── Request field extraction for typed clients ── */

function parseTypedClientRequestFields(
  options: string,
  method: string
): FieldShape[] {
  if (!options || method === "GET" || method === "HEAD") {
    return [];
  }

  const jsonMatch = options.match(/\bjson\s*:\s*(\{[\s\S]*?\})/u);
  if (jsonMatch?.[1]) {
    return parseObjectLiteralFields(jsonMatch[1]);
  }

  const bodyMatch = options.match(/\bbody\s*:\s*(\{[\s\S]*?\})/u);
  if (bodyMatch?.[1]) {
    return parseObjectLiteralFields(bodyMatch[1]);
  }

  const dataMatch = options.match(/\bdata\s*:\s*(\{[\s\S]*?\})/u);
  if (dataMatch?.[1]) {
    return parseObjectLiteralFields(dataMatch[1]);
  }

  return [];
}
