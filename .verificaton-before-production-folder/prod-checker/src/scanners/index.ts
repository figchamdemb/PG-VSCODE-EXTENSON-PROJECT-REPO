import { Scanner, ScanContext, Finding } from "../types";
import { securityScanner } from "./security";
import { codeQualityScanner } from "./code-quality";
import { performanceScanner } from "./performance";
import { configScanner } from "./config";

// All registered scanners
const ALL_SCANNERS: Scanner[] = [
  securityScanner,
  codeQualityScanner,
  performanceScanner,
  configScanner,
];

export async function runAllScanners(ctx: ScanContext): Promise<Finding[]> {
  const allFindings: Finding[] = [];

  for (const scanner of ALL_SCANNERS) {
    // Only run scanners relevant to the detected stack
    const isRelevant = scanner.supportedStacks.some((s) => ctx.detectedStack.includes(s));
    if (!isRelevant) continue;

    try {
      const findings = await scanner.scan(ctx);
      allFindings.push(...findings);
    } catch (error) {
      // Scanner failed — don't crash the whole scan
      allFindings.push({
        ruleId: "SYS-001",
        category: "code-quality",
        severity: "info",
        status: "skip",
        title: `Scanner '${scanner.name}' encountered an error`,
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Sort: blockers first, then warnings, then info
  const severityOrder = { blocker: 0, warning: 1, info: 2 };
  allFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return allFindings;
}
