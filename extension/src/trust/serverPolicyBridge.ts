/**
 * Server-Policy Bridge for Trust Score
 * Milestone 14B – integrates server-side policy evaluator findings
 * into the local trust score pipeline.
 *
 * Fetches coding-standards verification from the authenticated
 * server endpoint and converts server findings → TrustFinding[].
 * Gracefully degrades to empty when server is unreachable or
 * the user has no valid session token.
 */

import * as vscode from "vscode";
import type { TrustFinding, TrustSeverity } from "./trustScoreService";
import { Logger } from "../utils/logger";

// ── Server response shape (subset we care about) ───────────────────────

interface ServerFinding {
  rule_id: string;
  severity: "blocker" | "warning" | "info";
  message: string;
  file?: string;
  line?: number;
}

interface ServerVerificationResult {
  status: string;
  summary: {
    blockers: number;
    warnings: number;
  };
  findings?: ServerFinding[];
}

// ── Config helpers ──────────────────────────────────────────────────────

function isServerPolicyEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("narrate")
    .get<boolean>("trustScore.serverPolicyEnabled", false);
}

function getApiBaseUrl(): string {
  return vscode.workspace
    .getConfiguration("narrate")
    .get<string>("licensing.apiBaseUrl", "http://127.0.0.1:8787")
    .trim();
}

function getSessionToken(): string | undefined {
  const token = vscode.workspace
    .getConfiguration("narrate")
    .get<string>("licensing.sessionToken", "")
    .trim();
  return token || undefined;
}

const SERVER_TIMEOUT_MS = 8000;

// ── Fetch + convert ─────────────────────────────────────────────────────

export async function fetchServerPolicyFindings(
  filePath: string,
  fileContent: string,
  lineCount: number,
  logger: Logger
): Promise<TrustFinding[]> {
  if (!isServerPolicyEnabled()) {
    return [];
  }

  const apiBase = getApiBaseUrl();
  const token = getSessionToken();
  if (!token) {
    logger.info("Server policy bridge: no session token, skipping");
    return [];
  }

  try {
    const result = await fetchCodingVerification(
      apiBase, token, filePath, fileContent, lineCount
    );
    return convertServerFindings(result, filePath);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.info(`Server policy bridge: fetch failed (${msg})`);
    return [];
  }
}

async function fetchCodingVerification(
  apiBase: string,
  token: string,
  filePath: string,
  fileContent: string,
  lineCount: number
): Promise<ServerVerificationResult> {
  const url = new URL("/account/policy/coding/verify", apiBase).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      body: JSON.stringify({
        files: [{ path: filePath, content: fileContent, line_count: lineCount }]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as ServerVerificationResult;
  } finally {
    clearTimeout(timer);
  }
}

// ── Convert server findings → TrustFinding[] ───────────────────────────

function convertServerFindings(
  result: ServerVerificationResult,
  fallbackFile: string
): TrustFinding[] {
  const raw = result.findings;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const findings: TrustFinding[] = [];
  for (const sf of raw) {
    const severity = mapSeverity(sf.severity);
    if (!severity) {
      continue;
    }
    findings.push({
      ruleId: `SRV-${sf.rule_id}`,
      severity,
      message: sf.message,
      file: sf.file ?? fallbackFile,
      line: sf.line
    });
  }
  return findings;
}

function mapSeverity(
  serverSeverity: string
): TrustSeverity | undefined {
  if (serverSeverity === "blocker") return "blocker";
  if (serverSeverity === "warning") return "warning";
  return undefined;
}
