import * as path from "path";
import { EndpointContract } from "./apiContractTypes";

export type FileSnapshot = {
  relativePath: string;
  text: string;
  lines: string[];
};

export type AxiosReceiverContext = {
  axiosIdentifiers: Set<string>;
  clientBaseUrls: Map<string, string>;
};

export type RouteCandidate = {
  method: string;
  path: string;
  line: number;
};

export const SCRIPT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs"
]);

export const LOOKAHEAD_LINE_COUNT = 20;

export function isScriptFile(relativePath: string): boolean {
  return SCRIPT_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

export function isLikelyBackendFile(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  return (
    lower.includes("/server/src/") ||
    lower.includes("/api/") ||
    lower.includes("/routes/") ||
    lower.includes("/controllers/") ||
    /\/app\/api\/.+\/route\.(ts|tsx|js|jsx)$/u.test(lower) ||
    /\/pages\/api\/.+\.(ts|tsx|js|jsx)$/u.test(lower)
  );
}

export function dedupeEndpoints(endpoints: EndpointContract[]): EndpointContract[] {
  const byKey = new Map<string, EndpointContract>();
  for (const endpoint of endpoints) {
    const key = `${endpoint.method} ${endpoint.path}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, endpoint);
      continue;
    }
    const existingWeight = existing.requestFields.length + existing.responseFields.length;
    const nextWeight = endpoint.requestFields.length + endpoint.responseFields.length;
    if (nextWeight > existingWeight) {
      byKey.set(key, endpoint);
    }
  }
  return Array.from(byKey.values());
}

export function dedupeRouteCandidates(routes: RouteCandidate[]): RouteCandidate[] {
  const byKey = new Map<string, RouteCandidate>();
  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    if (!byKey.has(key)) {
      byKey.set(key, route);
    }
  }
  return Array.from(byKey.values());
}

export function buildLookaheadChunk(lines: string[], startLine: number): string {
  return lines.slice(startLine, startLine + LOOKAHEAD_LINE_COUNT).join("\n");
}

export function offsetToLine(text: string, offset: number): number {
  return text.slice(0, offset).split(/\r?\n/u).length;
}
