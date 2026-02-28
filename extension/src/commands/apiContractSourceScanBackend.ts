import { EndpointContract } from "./apiContractTypes";
import { normalizeApiPath } from "./apiContractPath";
import { parseObjectLiteralFields } from "./apiContractSourceScanFields";
import {
  dedupeEndpoints,
  dedupeRouteCandidates,
  FileSnapshot,
  isLikelyBackendFile,
  isScriptFile,
  offsetToLine,
  RouteCandidate
} from "./apiContractSourceScanModel";

export function inferBackendContracts(files: FileSnapshot[]): EndpointContract[] {
  const endpoints: EndpointContract[] = [];
  for (const file of files) {
    if (!isScriptFile(file.relativePath) || !isLikelyBackendFile(file.relativePath)) {
      continue;
    }
    const requestFields = inferRequestFields(file.text);
    const responseFields = inferResponseFields(file.text);
    for (const route of inferRoutesFromFile(file)) {
      endpoints.push({
        method: route.method,
        path: route.path,
        sourceFile: file.relativePath,
        requestFields,
        responseFields
      });
    }
  }
  return dedupeEndpoints(endpoints);
}

function inferRoutesFromFile(file: FileSnapshot): RouteCandidate[] {
  const routes: RouteCandidate[] = [];
  routes.push(...inferFrameworkRoutes(file));
  routes.push(...inferNextRouteFileRoutes(file));
  return dedupeRouteCandidates(routes);
}

function inferFrameworkRoutes(file: FileSnapshot): RouteCandidate[] {
  const pattern =
    /\b(?:app|router|fastify)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/giu;
  const routes: RouteCandidate[] = [];
  for (const match of file.text.matchAll(pattern)) {
    const method = (match[1] ?? "").toUpperCase();
    const pathValue = match[2] ?? "";
    if (!method || !pathValue) {
      continue;
    }
    routes.push({
      method,
      path: normalizeApiPath(pathValue),
      line: offsetToLine(file.text, match.index ?? 0)
    });
  }
  return routes;
}

function inferNextRouteFileRoutes(file: FileSnapshot): RouteCandidate[] {
  const lower = file.relativePath.toLowerCase();
  if (!/\/app\/api\/.+\/route\.(ts|tsx|js|jsx)$/u.test(lower)) {
    return [];
  }

  const suffix = file.relativePath.slice(file.relativePath.toLowerCase().indexOf("/app/api/"));
  const pathValue = suffix
    .replace(/^\/app\/api\//u, "/api/")
    .replace(/\/route\.(ts|tsx|js|jsx)$/u, "")
    .replace(/\[([^\]]+)\]/gu, ":$1");

  return extractExportedMethods(file.text).map((method) => ({
    method,
    path: normalizeApiPath(pathValue),
    line: 1
  }));
}

function extractExportedMethods(text: string): string[] {
  const methods = new Set<string>();
  const pattern = /\bexport\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/gu;
  for (const match of text.matchAll(pattern)) {
    methods.add((match[1] ?? "").toUpperCase());
  }
  return Array.from(methods);
}

function inferRequestFields(text: string) {
  const names = new Set<string>();
  collectNamesByPattern(names, text, /\b(?:req|request)\.body\.([A-Za-z_][A-Za-z0-9_]*)\b/gu);
  collectNamesByPattern(names, text, /\b(?:body|payload)\.([A-Za-z_][A-Za-z0-9_]*)\b/gu);
  collectDestructuredBodyNames(names, text);
  return Array.from(names)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ name }));
}

function collectNamesByPattern(names: Set<string>, text: string, pattern: RegExp): void {
  for (const match of text.matchAll(pattern)) {
    const key = match[1];
    if (key) {
      names.add(key);
    }
  }
}

function collectDestructuredBodyNames(names: Set<string>, text: string): void {
  const pattern = /const\s*\{([^}]+)\}\s*=\s*(?:req|request)\.body\b/gu;
  for (const match of text.matchAll(pattern)) {
    const payload = match[1] ?? "";
    for (const key of payload.split(",")) {
      const cleaned = key.split(":")[0]?.trim();
      if (cleaned && /^[A-Za-z_][A-Za-z0-9_]*$/u.test(cleaned)) {
        names.add(cleaned);
      }
    }
  }
}

function inferResponseFields(text: string) {
  const names = new Set<string>();
  const objectLiterals = [
    ...extractObjectLiteralContents(text, /\bres\.json\(\s*\{([\s\S]{0,700}?)\}\s*\)/gu),
    ...extractObjectLiteralContents(text, /\breply\.send\(\s*\{([\s\S]{0,700}?)\}\s*\)/gu),
    ...extractObjectLiteralContents(text, /\breturn\s+\{([\s\S]{0,700}?)\}\s*;?/gu)
  ];

  for (const objectLiteral of objectLiterals) {
    for (const field of parseObjectLiteralFields(objectLiteral)) {
      names.add(field.name);
    }
  }

  return Array.from(names)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ name }));
}

function extractObjectLiteralContents(text: string, pattern: RegExp): string[] {
  const values: string[] = [];
  for (const match of text.matchAll(pattern)) {
    const content = match[1];
    if (content) {
      values.push(content);
    }
  }
  return values;
}
