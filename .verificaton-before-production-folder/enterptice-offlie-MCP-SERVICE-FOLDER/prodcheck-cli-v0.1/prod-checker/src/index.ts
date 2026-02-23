// ============================================================
// LIBRARY ENTRY POINT
// Used by VS Code extension, MCP server, and programmatic access
// ============================================================

export { discoverFiles, detectStack, computeStats } from "./utils/files";
export { runAllScanners } from "./scanners";
export { generateMarkdownReport } from "./reporters/terminal";
export * from "./types";

import { discoverFiles, detectStack, computeStats } from "./utils/files";
import { runAllScanners } from "./scanners";
import { ScanContext, ScanMetadata, Finding, ProjectStats, TechStack } from "./types";

/**
 * Run a full production readiness scan on a project directory.
 * This is the main function that the VS Code extension and MCP server call.
 *
 * Returns scan metadata (no source code) that can be sent to the scoring API.
 */
export async function scanProject(projectPath: string): Promise<ScanMetadata> {
  const files = discoverFiles(projectPath);
  const detectedStack = detectStack(projectPath, files);
  const stats = computeStats(files);

  const ctx: ScanContext = {
    projectPath,
    detectedStack,
    files,
  };

  const findings = await runAllScanners(ctx);

  return {
    scanId: "scan_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
    timestamp: new Date().toISOString(),
    projectPath,
    detectedStack,
    findings,
    stats,
  };
}
