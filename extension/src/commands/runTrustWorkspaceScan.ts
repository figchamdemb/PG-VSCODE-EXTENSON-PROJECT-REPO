import * as vscode from "vscode";
import { TrustReport, TrustScoreService } from "../trust/trustScoreService";

type WorkspaceTrustSummary = {
  generatedAtUtc: string;
  filesDiscovered: number;
  filesScored: number;
  averageScore: number;
  totalBlockers: number;
  totalWarnings: number;
  redCount: number;
  yellowCount: number;
  greenCount: number;
  worstFiles: TrustReport[];
  blockerRuleCounts: Array<{ ruleId: string; count: number }>;
  blockedFiles: TrustReport[];
};

const DEFAULT_SCAN_INCLUDE_GLOB = "**/*.{ts,tsx,js,jsx,py,java,go,rs,cs,php,rb}";
const DEFAULT_SCAN_EXCLUDE_GLOB =
  "**/{node_modules,dist,build,.git,.next,coverage,.venv,venv,.gradle,target,out}/**";
const DEFAULT_SCAN_MAX_FILES = 250;
const MAX_WORST_FILES = 20;
const MAX_BLOCKED_FILES = 30;
const MAX_FINDINGS_PER_FILE = 8;

export function registerRunTrustWorkspaceScanCommand(
  trustScoreService: TrustScoreService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.runTrustWorkspaceScan", async () => {
    await runTrustWorkspaceScan(trustScoreService);
  });
}

async function runTrustWorkspaceScan(
  trustScoreService: TrustScoreService
): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    void vscode.window.showWarningMessage(
      "Narrate: open a workspace folder before running workspace Trust scan."
    );
    return;
  }

  const settings = readWorkspaceScanSettings();
  const candidates = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspace, settings.includeGlob),
    settings.excludeGlob,
    settings.maxFiles
  );
  if (candidates.length === 0) {
    void vscode.window.showInformationMessage(
      "Narrate: no matching source files found for workspace Trust scan."
    );
    return;
  }

  const reports = await scoreWorkspaceFiles(candidates, trustScoreService);
  if (reports.length === 0) {
    void vscode.window.showInformationMessage(
      "Narrate: workspace Trust scan finished, but no analyzable files were scored."
    );
    return;
  }

  const summary = buildWorkspaceSummary(reports, candidates.length);
  await openWorkspaceTrustReport(summary);
  showWorkspaceTrustSummaryNotification(summary);
}

function readWorkspaceScanSettings(): {
  includeGlob: string;
  excludeGlob: string;
  maxFiles: number;
} {
  const config = vscode.workspace.getConfiguration("narrate");
  const includeGlob = config.get<string>(
    "trustScore.workspaceScanIncludeGlob",
    DEFAULT_SCAN_INCLUDE_GLOB
  );
  const excludeGlob = config.get<string>(
    "trustScore.workspaceScanExcludeGlob",
    DEFAULT_SCAN_EXCLUDE_GLOB
  );
  const maxFiles = Math.max(
    1,
    config.get<number>("trustScore.workspaceScanMaxFiles", DEFAULT_SCAN_MAX_FILES)
  );

  return { includeGlob, excludeGlob, maxFiles };
}

async function scoreWorkspaceFiles(
  candidates: vscode.Uri[],
  trustScoreService: TrustScoreService
): Promise<TrustReport[]> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Narrate: Running workspace Trust scan",
      cancellable: false
    },
    async (progress) => {
      const items: TrustReport[] = [];
      for (let index = 0; index < candidates.length; index += 1) {
        const uri = candidates[index];
        progress.report({
          message: `${index + 1}/${candidates.length} ${vscode.workspace.asRelativePath(uri, false)}`,
          increment: ((index + 1) / candidates.length) * 100
        });
        try {
          const document = await vscode.workspace.openTextDocument(uri);
          const report = await trustScoreService.computeReportForDocument(document);
          if (report) {
            items.push(report);
          }
        } catch {
          // Skip unreadable files and continue workspace scan.
        }
      }
      return items;
    }
  );
}

async function openWorkspaceTrustReport(summary: WorkspaceTrustSummary): Promise<void> {
  const reportDoc = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: buildWorkspaceTrustReportMarkdown(summary)
  });
  await vscode.window.showTextDocument(reportDoc, { preview: false });
}

function showWorkspaceTrustSummaryNotification(summary: WorkspaceTrustSummary): void {
  const statusLabel =
    summary.totalBlockers > 0 ? "red" : summary.averageScore < 85 ? "yellow" : "green";
  const tail = `avg ${summary.averageScore}/100, blockers ${summary.totalBlockers}, warnings ${summary.totalWarnings}`;
  if (statusLabel === "red") {
    void vscode.window.showWarningMessage(`Narrate Trust Scan: ${tail}`);
    return;
  }
  void vscode.window.showInformationMessage(`Narrate Trust Scan: ${tail}`);
}

function buildWorkspaceSummary(
  reports: TrustReport[],
  filesDiscovered: number
): WorkspaceTrustSummary {
  const totalBlockers = reports.reduce((sum, report) => sum + report.blockers, 0);
  const totalWarnings = reports.reduce((sum, report) => sum + report.warnings, 0);
  const scoreSum = reports.reduce((sum, report) => sum + report.score, 0);
  const averageScore = Math.round(scoreSum / Math.max(1, reports.length));

  let redCount = 0;
  let yellowCount = 0;
  let greenCount = 0;
  for (const report of reports) {
    if (report.status === "red") {
      redCount += 1;
      continue;
    }
    if (report.status === "yellow") {
      yellowCount += 1;
      continue;
    }
    greenCount += 1;
  }

  const worstFiles = [...reports]
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      if (left.blockers !== right.blockers) {
        return right.blockers - left.blockers;
      }
      return left.file.localeCompare(right.file);
    })
    .slice(0, MAX_WORST_FILES);

  const blockedFiles = [...reports]
    .filter((report) => report.blockers > 0)
    .sort((left, right) => {
      if (left.blockers !== right.blockers) {
        return right.blockers - left.blockers;
      }
      return left.score - right.score;
    })
    .slice(0, MAX_BLOCKED_FILES);

  const blockerRuleMap = new Map<string, number>();
  for (const report of reports) {
    for (const finding of report.findings) {
      if (finding.severity !== "blocker") {
        continue;
      }
      blockerRuleMap.set(finding.ruleId, (blockerRuleMap.get(finding.ruleId) ?? 0) + 1);
    }
  }

  const blockerRuleCounts = [...blockerRuleMap.entries()]
    .map(([ruleId, count]) => ({ ruleId, count }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return left.ruleId.localeCompare(right.ruleId);
    });

  return {
    generatedAtUtc: new Date().toISOString(),
    filesDiscovered,
    filesScored: reports.length,
    averageScore,
    totalBlockers,
    totalWarnings,
    redCount,
    yellowCount,
    greenCount,
    worstFiles,
    blockerRuleCounts,
    blockedFiles
  };
}

function buildWorkspaceTrustReportMarkdown(summary: WorkspaceTrustSummary): string {
  const lines: string[] = [];
  lines.push("# Narrate Trust Workspace Scan");
  lines.push("");
  lines.push(`UTC: ${summary.generatedAtUtc}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Files discovered: ${summary.filesDiscovered}`);
  lines.push(`- Files scored: ${summary.filesScored}`);
  lines.push(`- Average score: ${summary.averageScore}/100`);
  lines.push(`- Total blockers: ${summary.totalBlockers}`);
  lines.push(`- Total warnings: ${summary.totalWarnings}`);
  lines.push(
    `- Status distribution: red ${summary.redCount} | yellow ${summary.yellowCount} | green ${summary.greenCount}`
  );

  appendWorstFilesSection(lines, summary.worstFiles);
  appendTopBlockerRulesSection(lines, summary.blockerRuleCounts);
  appendBlockedFilesSection(lines, summary.blockedFiles);

  return lines.join("\n");
}

function appendWorstFilesSection(lines: string[], worstFiles: TrustReport[]): void {
  lines.push("");
  lines.push("## Worst Files");
  lines.push("");
  if (worstFiles.length === 0) {
    lines.push("- none");
    return;
  }

  for (const file of worstFiles) {
    lines.push(
      `- \`${file.file}\` -> ${file.score}/100 (${file.grade}, ${file.status}) | blockers ${file.blockers}, warnings ${file.warnings}`
    );
  }
}

function appendTopBlockerRulesSection(
  lines: string[],
  blockerRuleCounts: Array<{ ruleId: string; count: number }>
): void {
  lines.push("");
  lines.push("## Top Blocker Rules");
  lines.push("");
  if (blockerRuleCounts.length === 0) {
    lines.push("- none");
    return;
  }

  for (const entry of blockerRuleCounts.slice(0, 12)) {
    lines.push(`- \`${entry.ruleId}\`: ${entry.count}`);
  }
}

function appendBlockedFilesSection(lines: string[], blockedFiles: TrustReport[]): void {
  lines.push("");
  lines.push("## Files With Blockers");
  lines.push("");
  if (blockedFiles.length === 0) {
    lines.push("- none");
    return;
  }

  for (const file of blockedFiles) {
    appendBlockedFileEntry(lines, file);
  }
}

function appendBlockedFileEntry(lines: string[], file: TrustReport): void {
  lines.push(`### ${file.file}`);
  lines.push(`- Score: ${file.score}/100 (${file.grade}, ${file.status})`);
  lines.push(`- Blockers: ${file.blockers}`);
  lines.push(`- Warnings: ${file.warnings}`);
  lines.push("- Findings:");
  const blockers = file.findings.filter((finding) => finding.severity === "blocker");
  for (const finding of blockers.slice(0, MAX_FINDINGS_PER_FILE)) {
    const where =
      finding.line === undefined ? finding.file : `${finding.file}:${finding.line}`;
    lines.push(`  - \`${finding.ruleId}\` at \`${where}\`: ${finding.message}`);
  }
  lines.push("");
}
