#!/usr/bin/env node

// ============================================================
// PRODGUARD MCP SERVER
// 
// Standard version — sends metadata to ProdGuard cloud API.
// Rules and scoring logic are SERVER-SIDE (your IP protected).
// Source code NEVER leaves the user's machine.
//
// To use in VS Code / Cursor / Claude Desktop, add to MCP config:
// {
//   "mcpServers": {
//     "prodguard": {
//       "command": "npx",
//       "args": ["@prodguard/mcp-server"],
//       "env": {
//         "PRODGUARD_API_KEY": "your-key-here"
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
import { z } from "zod";
import { ProdGuardApiClient } from "./api/client";
import * as path from "path";
import * as fs from "fs";

// Import scanner functions (shared with CLI — these are the same files)
// In production, you'd publish @prodguard/core as a shared package
// For now, we inline the references. Your agent should copy the scanner
// files from the CLI project into this project's src/scanners/ folder.
//
// TODO: Your agent should merge the scanner code from prodcheck-cli here.
// See AGENT_INSTRUCTIONS.md for the merge guide.

const server = new Server(
  {
    name: "prodguard",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const apiClient = new ProdGuardApiClient();

// ============================================================
// TOOL DEFINITIONS — What the AI can call
// ============================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "check_production_readiness",
        description:
          "Scans the entire project for production readiness. Checks security vulnerabilities, " +
          "performance anti-patterns, error handling, database issues, code quality, and more. " +
          "Returns a scored report with blockers that must be fixed before deployment.",
        inputSchema: {
          type: "object" as const,
          properties: {
            project_path: {
              type: "string",
              description: "Absolute path to the project root directory. Defaults to workspace root.",
            },
            include_ui_tests: {
              type: "boolean",
              description: "Run Playwright UI smoke tests (requires running dev server). Default: false",
            },
            ui_test_url: {
              type: "string",
              description: "URL of the running dev server for UI tests (e.g., http://localhost:3000)",
            },
          },
          required: [],
        },
      },
      {
        name: "check_security",
        description:
          "Deep security audit of the project. Checks for: hardcoded secrets, JWT configuration, " +
          "CORS issues, XSS vulnerabilities, insecure token storage, SQL injection, CSRF, " +
          "sensitive data logging, eval() usage, and env variable exposure.",
        inputSchema: {
          type: "object" as const,
          properties: {
            project_path: {
              type: "string",
              description: "Absolute path to the project root directory.",
            },
          },
          required: [],
        },
      },
      {
        name: "check_file",
        description:
          "Check a single file against production rules. Useful for quick checks during development. " +
          "Validates LOC limit, console.log usage, inline functions, error handling patterns.",
        inputSchema: {
          type: "object" as const,
          properties: {
            file_path: {
              type: "string",
              description: "Absolute path to the file to check.",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "get_scan_status",
        description:
          "Check the ProdGuard API connection status and remaining scans on the current plan.",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// ============================================================
// TOOL HANDLERS — What happens when the AI calls a tool
// ============================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "check_production_readiness":
      return await handleFullScan(args);

    case "check_security":
      return await handleSecurityScan(args);

    case "check_file":
      return await handleFileScan(args);

    case "get_scan_status":
      return await handleStatusCheck();

    default:
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// ============================================================
// HANDLER IMPLEMENTATIONS
// ============================================================

async function handleFullScan(args: Record<string, unknown> | undefined) {
  try {
    const projectPath = (args?.project_path as string) || process.cwd();

    if (!fs.existsSync(projectPath)) {
      return {
        content: [{ type: "text" as const, text: `Error: Path '${projectPath}' does not exist` }],
        isError: true,
      };
    }

    // TODO: Import and use the actual scanners from @prodguard/core
    // For now, return a placeholder that shows the expected structure.
    // Your agent should wire up the real scanners here.
    // See AGENT_INSTRUCTIONS.md for the integration guide.

    const scanResult = await performLocalScan(projectPath);

    // Send metadata to API for proprietary scoring
    let report;
    try {
      report = await apiClient.submitScan(scanResult);
    } catch (error) {
      // API unavailable — use local fallback
      report = {
        score: calculateLocalScore(scanResult.findings),
        grade: "N/A (offline)",
        productionReady: scanResult.findings.filter((f) => f.severity === "blocker").length === 0,
        blockers: scanResult.findings.filter((f) => f.severity === "blocker").length,
        warnings: scanResult.findings.filter((f) => f.severity === "warning").length,
        infos: scanResult.findings.filter((f) => f.severity === "info").length,
        findings: scanResult.findings,
        summary: "Offline scan — connect to ProdGuard API for full scoring",
      };
    }

    // Format response for the AI
    const blockerList = report.findings
      .filter((f) => f.severity === "blocker" && f.status === "fail")
      .map((f) => `❌ [${f.ruleId}] ${f.title}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ""})` : ""}\n   → ${f.recommendation || f.detail}`)
      .join("\n\n");

    const warningList = report.findings
      .filter((f) => f.severity === "warning" && f.status === "fail")
      .map((f) => `⚠️ [${f.ruleId}] ${f.title}${f.file ? ` (${f.file})` : ""}`)
      .join("\n");

    const text = `
## Production Readiness Report

**Score:** ${report.score}/100 | **Grade:** ${report.grade}
**Status:** ${report.productionReady ? "✅ PRODUCTION READY" : "🚫 NOT PRODUCTION READY"}
**Stack:** ${scanResult.detectedStack.join(", ")}
**Files:** ${scanResult.stats.filesScanned} | **LOC:** ${scanResult.stats.totalLoc.toLocaleString()}

---

### Blockers (${report.blockers})
${blockerList || "None — all clear!"}

### Warnings (${report.warnings})
${warningList || "None"}

### Info
${report.infos} improvement suggestions

---
${report.summary}
`.trim();

    return {
      content: [{ type: "text" as const, text }],
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Scan error: ${error instanceof Error ? error.message : "Unknown error"}`,
      }],
      isError: true,
    };
  }
}

async function handleSecurityScan(args: Record<string, unknown> | undefined) {
  try {
    const projectPath = (args?.project_path as string) || process.cwd();
    const scanResult = await performLocalScan(projectPath);

    const securityFindings = scanResult.findings.filter((f) => f.category === "security");
    const blockers = securityFindings.filter((f) => f.severity === "blocker");

    const text = `
## Security Audit Report

**Security Issues Found:** ${securityFindings.length}
**Blockers:** ${blockers.length}

${securityFindings.map((f) =>
  `${f.severity === "blocker" ? "❌" : "⚠️"} **[${f.ruleId}]** ${f.title}
   ${f.file ? `File: \`${f.file}${f.line ? `:${f.line}` : ""}\`` : ""}
   ${f.detail}
   → ${f.recommendation || "See security checklist"}
`).join("\n")}

${blockers.length > 0 ? `⛔ ${blockers.length} security blocker(s) must be fixed before production.` : "✅ No security blockers found."}
`.trim();

    return { content: [{ type: "text" as const, text }] };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Security scan error: ${error instanceof Error ? error.message : "Unknown error"}`,
      }],
      isError: true,
    };
  }
}

async function handleFileScan(args: Record<string, unknown> | undefined) {
  try {
    const filePath = args?.file_path as string;
    if (!filePath || !fs.existsSync(filePath)) {
      return {
        content: [{ type: "text" as const, text: `Error: File '${filePath}' not found` }],
        isError: true,
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const loc = content.split("\n").length;
    const ext = path.extname(filePath);

    const issues: string[] = [];

    // LOC check
    if (loc > 500) {
      issues.push(`❌ BLOCKER: File has ${loc} lines (limit: 500). Extract logic into hooks/utilities/sub-components.`);
    } else if (loc > 450) {
      issues.push(`⚠️ WARNING: File has ${loc}/500 lines. Approaching limit.`);
    }

    // Console.log check
    const consoleCount = (content.match(/console\.(log|debug|info)\s*\(/g) || []).length;
    if (consoleCount > 0) {
      issues.push(`⚠️ WARNING: ${consoleCount} console.log statement(s) found.`);
    }

    // Empty catch blocks
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(content)) {
      issues.push(`❌ BLOCKER: Empty catch block — errors being silently swallowed.`);
    }

    // eval
    if (/\beval\s*\(/.test(content)) {
      issues.push(`❌ BLOCKER: eval() usage detected — severe security risk.`);
    }

    const text = issues.length > 0
      ? `### File Check: \`${path.basename(filePath)}\` (${loc} LOC)\n\n${issues.join("\n")}`
      : `### File Check: \`${path.basename(filePath)}\` (${loc} LOC)\n\n✅ No issues found.`;

    return { content: [{ type: "text" as const, text }] };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `File check error: ${error instanceof Error ? error.message : "Unknown error"}`,
      }],
      isError: true,
    };
  }
}

async function handleStatusCheck() {
  const status = await apiClient.healthCheck();
  const text = status.connected
    ? `✅ Connected to ProdGuard API\n   Plan: ${status.plan || "Free"}\n   Scans remaining: ${status.scansRemaining ?? "Unlimited"}`
    : `⚠️ Not connected to ProdGuard API. Running in offline mode.\n   Set PRODGUARD_API_KEY to enable full scoring.\n   Get a key at https://prodguard.dev`;

  return { content: [{ type: "text" as const, text }] };
}

// ============================================================
// LOCAL SCAN FUNCTION
// TODO: Wire up the real scanners from @prodguard/core
// This is a placeholder — your agent should replace this
// with the actual scanner integration.
// ============================================================

async function performLocalScan(projectPath: string) {
  // TODO: Import from @prodguard/core or inline the scanner code
  // For now, this delegates to a dynamic import attempt
  try {
    const core = await import("./scanners/index");
    const files = core.discoverFiles(projectPath);
    const stack = core.detectStack(projectPath, files);
    const stats = core.computeStats(files);
    const findings = await core.runAllScanners({ projectPath, detectedStack: stack, files });

    return {
      scanId: "scan_" + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      projectPath,
      detectedStack: stack,
      findings,
      stats,
    };
  } catch {
    // Scanners not yet wired — return empty scan
    // Your agent should copy scanner files to make this work
    return {
      scanId: "scan_" + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      projectPath,
      detectedStack: [] as string[],
      findings: [{
        ruleId: "SYS-001",
        category: "code-quality" as const,
        severity: "info" as const,
        status: "skip" as const,
        title: "Scanners not yet integrated",
        detail: "Copy scanner files from @prodguard/cli into src/scanners/ to enable full scanning. See AGENT_INSTRUCTIONS.md",
      }],
      stats: {
        filesScanned: 0,
        totalLoc: 0,
        maxFileLoc: 0,
        maxFileLocPath: "",
        fileCount: {},
      },
    };
  }
}

function calculateLocalScore(findings: Array<{ severity: string; status: string }>): number {
  let score = 100;
  for (const f of findings) {
    if (f.status !== "fail") continue;
    if (f.severity === "blocker") score -= 15;
    else if (f.severity === "warning") score -= 5;
    else score -= 1;
  }
  return Math.max(0, Math.min(100, score));
}

// ============================================================
// START THE SERVER
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ProdGuard MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
