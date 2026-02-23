#!/usr/bin/env node

import * as path from "path";
import * as fs from "fs";
import { discoverFiles, detectStack, computeStats } from "./utils/files";
import { runAllScanners } from "./scanners";
import {
  printHeader,
  printStats,
  printFindings,
  printSummary,
  generateMarkdownReport,
} from "./reporters/terminal";
import { ScanContext } from "./types";

// ============================================================
// CLI ENTRY POINT
// ============================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments
  const projectPath = path.resolve(args.find((a) => !a.startsWith("--")) || ".");
  const generateReport = args.includes("--report");
  const reportPath = args.find((a) => a.startsWith("--report="))?.split("=")[1];
  const jsonOutput = args.includes("--json");
  const help = args.includes("--help") || args.includes("-h");

  if (help) {
    printUsage();
    process.exit(0);
  }

  // Verify project path exists
  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Path '${projectPath}' does not exist`);
    process.exit(1);
  }

  // Phase 1: Discover files
  console.log("\n  Scanning project...\n");
  const files = discoverFiles(projectPath);

  if (files.length === 0) {
    console.error("  No scannable files found in the project.");
    process.exit(1);
  }

  // Phase 2: Detect tech stack
  const detectedStack = detectStack(projectPath, files);

  if (detectedStack.length === 0) {
    console.log("  Could not auto-detect tech stack. Running generic checks.\n");
    detectedStack.push("typescript"); // fallback
  }

  // Phase 3: Compute stats
  const stats = computeStats(files);

  // Phase 4: Run all scanners
  const ctx: ScanContext = {
    projectPath,
    detectedStack,
    files,
  };

  const findings = await runAllScanners(ctx);

  // Phase 5: Output results
  if (jsonOutput) {
    // JSON output for API integration / CI pipelines
    const result = {
      scanId: generateScanId(),
      timestamp: new Date().toISOString(),
      projectPath,
      detectedStack,
      stats,
      findings,
      summary: {
        score: calculateQuickScore(findings),
        blockers: findings.filter((f) => f.severity === "blocker" && f.status === "fail").length,
        warnings: findings.filter((f) => f.severity === "warning" && f.status === "fail").length,
        infos: findings.filter((f) => f.severity === "info" && f.status === "fail").length,
        productionReady: findings.filter((f) => f.severity === "blocker" && f.status === "fail").length === 0,
      },
    };
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Human-readable terminal output
    printHeader(projectPath, detectedStack);
    printStats(stats);
    printFindings(findings);
    printSummary(findings);
  }

  // Phase 6: Generate markdown report if requested
  if (generateReport || reportPath) {
    const md = generateMarkdownReport(findings, stats, detectedStack);
    const outPath = reportPath || `prodcheck-report-${new Date().toISOString().split("T")[0]}.md`;
    fs.writeFileSync(outPath, md, "utf-8");
    console.log(`  Report saved to: ${outPath}\n`);
  }

  // Exit code: 1 if blockers found (for CI/CD integration)
  const blockers = findings.filter((f) => f.severity === "blocker" && f.status === "fail");
  process.exit(blockers.length > 0 ? 1 : 0);
}

function printUsage(): void {
  console.log(`
  Usage: prodcheck [path] [options]

  Arguments:
    path              Project directory to scan (default: current directory)

  Options:
    --report          Generate a markdown report file
    --report=<path>   Generate report at specific path
    --json            Output results as JSON (for CI/CD pipelines)
    -h, --help        Show this help message

  Examples:
    prodcheck .                        Scan current directory
    prodcheck ./my-app                 Scan specific project
    prodcheck . --report               Scan and generate report
    prodcheck . --json                 JSON output for CI/CD
    prodcheck . --json | curl -X POST  Pipe to API for scoring

  Exit codes:
    0  All clear — no blockers found
    1  Blockers found — not production ready
`);
}

function generateScanId(): string {
  return "scan_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function calculateQuickScore(findings: { severity: string; status: string }[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.status !== "fail") continue;
    if (f.severity === "blocker") score -= 15;
    else if (f.severity === "warning") score -= 5;
    else score -= 1;
  }
  return Math.max(0, Math.min(100, score));
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
