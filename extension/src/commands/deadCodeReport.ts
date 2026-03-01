import { DeadCodeScanResult } from "./runDeadCodeScan";

export function buildDeadCodeReportMarkdown(
  workspaceRoot: string,
  result: DeadCodeScanResult
): string {
  const lines: string[] = [];
  lines.push("# Narrate Dead Code Scan");
  lines.push("");
  lines.push(`UTC: ${result.generatedAtUtc}`);
  lines.push("");
  lines.push(`Workspace: ${workspaceRoot}`);
  lines.push("");
  lines.push("## Confidence Guide");
  lines.push("");
  lines.push("- `High`: TypeScript reports explicit unused declarations/imports.");
  lines.push("- `Medium`: exported file has no inbound local imports in workspace import graph.");
  lines.push("- `Low`: no inbound local imports, but file may be called dynamically.");
  lines.push("- This scan is report-only and does not auto-delete code.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Files discovered: ${result.filesDiscovered}`);
  lines.push(`- Files scanned: ${result.filesScanned}`);
  lines.push(`- High-confidence candidates: ${result.highConfidenceUnused.length}`);
  lines.push(`- Medium-confidence orphan files: ${result.mediumConfidenceOrphans.length}`);
  lines.push(`- Low-confidence orphan files: ${result.lowConfidenceOrphans.length}`);

  lines.push("");
  lines.push("## High Confidence (TypeScript Unused Diagnostics)");
  lines.push("");
  if (result.highConfidenceUnused.length === 0) {
    lines.push("- none");
  } else {
    for (const candidate of result.highConfidenceUnused) {
      lines.push(
        `- \`${candidate.file}:${candidate.line}\` [TS${candidate.code}] ${candidate.message}`
      );
    }
  }

  lines.push("");
  lines.push("## Medium Confidence (Likely Orphan Modules)");
  lines.push("");
  if (result.mediumConfidenceOrphans.length === 0) {
    lines.push("- none");
  } else {
    for (const candidate of result.mediumConfidenceOrphans) {
      lines.push(`- \`${candidate.file}\` - ${candidate.reason}`);
    }
  }

  lines.push("");
  lines.push("## Low Confidence (Manual Review Required)");
  lines.push("");
  if (result.lowConfidenceOrphans.length === 0) {
    lines.push("- none");
  } else {
    for (const candidate of result.lowConfidenceOrphans) {
      lines.push(`- \`${candidate.file}\` - ${candidate.reason}`);
    }
  }

  lines.push("");
  lines.push("## Safe Cleanup Workflow");
  lines.push("");
  lines.push("- Use report candidates as review targets; do not bulk delete blindly.");
  lines.push(
    "- Optional guided flow: run `Narrate: Create Dead Code Cleanup Branch` before making cleanup edits."
  );
  lines.push(
    "- Optional safe autofix: run `Narrate: Apply Safe Dead Code Fixes` (organize imports + prefix unused variables)."
  );
  lines.push("- For import cleanup, run VS Code `Source Action: Organize Imports`.");
  lines.push(
    "- For stale diagnostics, run `Narrate: Restart TypeScript + Refresh Trust Score` then re-run this scan."
  );
  lines.push("- Re-run compile/tests after each cleanup batch before PG Push.");

  return lines.join("\n");
}
