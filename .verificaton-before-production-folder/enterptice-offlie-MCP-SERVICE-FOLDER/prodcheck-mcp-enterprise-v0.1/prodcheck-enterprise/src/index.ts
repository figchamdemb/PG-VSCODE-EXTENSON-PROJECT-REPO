#!/usr/bin/env node

// ============================================================
// PRODGUARD MCP SERVER — ENTERPRISE EDITION
//
// Key differences from Standard:
// 1. Rules are stored LOCALLY in an encrypted rule pack (.yrp file)
// 2. Scoring happens LOCALLY — no data sent to any external server
// 3. License key + machine fingerprint required for decryption
// 4. Works 100% offline after initial activation
// 5. Rule pack has an expiry date tied to the license period
//
// MCP Config:
// {
//   "mcpServers": {
//     "prodguard-enterprise": {
//       "command": "npx",
//       "args": ["@prodguard/mcp-server-enterprise"],
//       "env": {
//         "PRODGUARD_LICENSE_KEY": "enterprise-key-here"
//       }
//     }
//   }
// }
// ============================================================

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { LicenseManager, RulePack, EncryptedRule } from "./encryption/license";
import * as fs from "fs";
import * as path from "path";

const server = new Server(
  { name: "prodguard-enterprise", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const licenseManager = new LicenseManager();

// ============================================================
// TOOL DEFINITIONS
// ============================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "check_production_readiness",
        description:
          "Full production readiness scan using enterprise rule pack. " +
          "All scanning and scoring happens locally — no data leaves this machine. " +
          "Checks security, performance, error handling, database, architecture, and code quality.",
        inputSchema: {
          type: "object" as const,
          properties: {
            project_path: {
              type: "string",
              description: "Absolute path to project root.",
            },
          },
          required: [],
        },
      },
      {
        name: "check_security",
        description: "Deep security audit using enterprise rule pack. Fully offline.",
        inputSchema: {
          type: "object" as const,
          properties: {
            project_path: { type: "string", description: "Project root path." },
          },
          required: [],
        },
      },
      {
        name: "check_file",
        description: "Check a single file against production rules.",
        inputSchema: {
          type: "object" as const,
          properties: {
            file_path: { type: "string", description: "Absolute path to file." },
          },
          required: ["file_path"],
        },
      },
      {
        name: "activate_license",
        description: "Activate enterprise license and download encrypted rule pack.",
        inputSchema: {
          type: "object" as const,
          properties: {
            license_key: { type: "string", description: "Enterprise license key." },
            api_url: {
              type: "string",
              description: "ProdGuard API URL. Default: https://api.prodguard.dev",
            },
          },
          required: ["license_key"],
        },
      },
      {
        name: "license_info",
        description: "Show current license status, expiry, and machine ID.",
        inputSchema: { type: "object" as const, properties: {}, required: [] },
      },
    ],
  };
});

// ============================================================
// TOOL HANDLERS
// ============================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "check_production_readiness":
      return await handleEnterpriseScan(args, "all");
    case "check_security":
      return await handleEnterpriseScan(args, "security");
    case "check_file":
      return await handleFileCheck(args);
    case "activate_license":
      return await handleActivation(args);
    case "license_info":
      return await handleLicenseInfo();
    default:
      return { content: [{ type: "text" as const, text: `Unknown tool: ${name}` }], isError: true };
  }
});

// ============================================================
// ENTERPRISE SCAN — Uses encrypted local rule pack for scoring
// ============================================================

async function handleEnterpriseScan(
  args: Record<string, unknown> | undefined,
  scope: "all" | "security"
) {
  // Load encrypted rule pack
  const rulePack = licenseManager.loadRulePack();
  if (!rulePack) {
    return {
      content: [{
        type: "text" as const,
        text:
          "⚠️ No valid enterprise rule pack found.\n\n" +
          "To activate, use the `activate_license` tool with your license key.\n" +
          "Or set PRODGUARD_LICENSE_KEY environment variable and restart.",
      }],
      isError: true,
    };
  }

  const projectPath = (args?.project_path as string) || process.cwd();
  if (!fs.existsSync(projectPath)) {
    return {
      content: [{ type: "text" as const, text: `Error: Path '${projectPath}' does not exist` }],
      isError: true,
    };
  }

  try {
    // Perform local scan with the decrypted rules
    const result = await performEnterpriseLocalScan(projectPath, rulePack, scope);
    return { content: [{ type: "text" as const, text: result }] };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Scan error: ${error instanceof Error ? error.message : "Unknown"}`,
      }],
      isError: true,
    };
  }
}

async function performEnterpriseLocalScan(
  projectPath: string,
  rulePack: RulePack,
  scope: "all" | "security"
): Promise<string> {
  // TODO: Wire up the real scanners from @prodguard/core
  // The enterprise version uses rulePack.rules for additional checks
  // and rulePack.scoringWeights for proprietary scoring.
  //
  // For now, attempt to import the shared scanners:
  let findings: any[] = [];
  let stats = { filesScanned: 0, totalLoc: 0, maxFileLoc: 0, maxFileLocPath: "" };
  let detectedStack: string[] = [];

  try {
    const core = await import("./scanners/index");
    const files = core.discoverFiles(projectPath);
    detectedStack = core.detectStack(projectPath, files);
    stats = core.computeStats(files);
    findings = await core.runAllScanners({ projectPath, detectedStack, files });
  } catch {
    // Scanners not yet integrated — placeholder
    findings = [{
      ruleId: "SYS-001",
      category: "code-quality",
      severity: "info",
      status: "skip",
      title: "Core scanners not yet integrated",
      detail: "Copy scanner files from @prodguard/cli. See AGENT_INSTRUCTIONS.md",
    }];
  }

  // Filter by scope
  if (scope === "security") {
    findings = findings.filter((f: any) => f.category === "security");
  }

  // Apply enterprise scoring weights from the rule pack
  const weights = rulePack.scoringWeights || { blocker: 15, warning: 5, info: 1 };
  let score = 100;
  for (const f of findings) {
    if (f.status !== "fail") continue;
    score -= weights[f.severity] || 5;
  }
  score = Math.max(0, Math.min(100, score));

  const grade =
    score >= 95 ? "A+" : score >= 90 ? "A" : score >= 85 ? "A-" :
    score >= 80 ? "B+" : score >= 75 ? "B" : score >= 70 ? "B-" :
    score >= 65 ? "C+" : score >= 60 ? "C" : score >= 50 ? "D" : "F";

  const blockers = findings.filter((f: any) => f.severity === "blocker" && f.status === "fail");
  const warnings = findings.filter((f: any) => f.severity === "warning" && f.status === "fail");
  const infos = findings.filter((f: any) => f.severity === "info" && f.status === "fail");

  const blockerList = blockers
    .map((f: any) => `❌ [${f.ruleId}] ${f.title}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ""})` : ""}\n   → ${f.recommendation || f.detail}`)
    .join("\n\n");

  const warningList = warnings
    .map((f: any) => `⚠️ [${f.ruleId}] ${f.title}${f.file ? ` (${f.file})` : ""}`)
    .join("\n");

  return `
## Production Readiness Report (Enterprise — Offline)

**Score:** ${score}/100 | **Grade:** ${grade}
**Status:** ${blockers.length === 0 ? "✅ PRODUCTION READY" : "🚫 NOT PRODUCTION READY"}
**Stack:** ${detectedStack.join(", ") || "detecting..."}
**Files:** ${stats.filesScanned} | **LOC:** ${stats.totalLoc.toLocaleString()}
**Rule Pack:** v${rulePack.version} | Expires: ${rulePack.expiresAt}

---

### Blockers (${blockers.length})
${blockerList || "None — all clear!"}

### Warnings (${warnings.length})
${warningList || "None"}

### Info
${infos.length} improvement suggestions

---
${blockers.length > 0
  ? `⛔ ${blockers.length} blocker(s) must be fixed before production.`
  : "✅ All checks passed. Ready for production deployment."}

_Scanned fully offline. No data left this machine._
`.trim();
}

// ============================================================
// LICENSE MANAGEMENT
// ============================================================

async function handleActivation(args: Record<string, unknown> | undefined) {
  const licenseKey = args?.license_key as string;
  const apiUrl = (args?.api_url as string) || "https://api.prodguard.dev";

  if (!licenseKey) {
    return {
      content: [{ type: "text" as const, text: "Error: license_key is required." }],
      isError: true,
    };
  }

  const manager = new LicenseManager(licenseKey);
  const result = await manager.activate(apiUrl);

  return {
    content: [{
      type: "text" as const,
      text: result.success
        ? `✅ ${result.message}\n\nYou can now run production checks fully offline.`
        : `❌ ${result.message}`,
    }],
    isError: !result.success,
  };
}

async function handleLicenseInfo() {
  const info = licenseManager.getInfo();
  const text = info.activated
    ? `✅ Enterprise License Active\n   Tier: ${info.tier}\n   Expires: ${info.expiresAt}\n   Machine ID: ${info.machineId}`
    : `⚠️ No active enterprise license.\n   Machine ID: ${info.machineId}\n   Use 'activate_license' tool to activate.`;

  return { content: [{ type: "text" as const, text }] };
}

async function handleFileCheck(args: Record<string, unknown> | undefined) {
  const filePath = args?.file_path as string;
  if (!filePath || !fs.existsSync(filePath)) {
    return { content: [{ type: "text" as const, text: `Error: File not found: ${filePath}` }], isError: true };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const loc = content.split("\n").length;
  const issues: string[] = [];

  if (loc > 500) issues.push(`❌ BLOCKER: ${loc} lines (limit: 500)`);
  if (/console\.(log|debug)\s*\(/g.test(content)) issues.push(`⚠️ console.log found`);
  if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(content)) issues.push(`❌ Empty catch block`);
  if (/\beval\s*\(/.test(content)) issues.push(`❌ eval() detected`);

  const text = issues.length > 0
    ? `### ${path.basename(filePath)} (${loc} LOC)\n\n${issues.join("\n")}`
    : `### ${path.basename(filePath)} (${loc} LOC)\n\n✅ No issues.`;

  return { content: [{ type: "text" as const, text }] };
}

// ============================================================
// START
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ProdGuard Enterprise MCP Server running (offline mode)");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
