import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { FeatureGateService } from "../licensing/featureGates";
import { NarrationEngine } from "../narration/narrationEngine";
import { getCurrentMode } from "./modeState";
import { resolveExportBaseDir, sanitizePathSegment } from "./exportUtils";
import { GitClient } from "../git/gitClient";
import { parseUnifiedDiff } from "../git/diffParser";
import { DiffFile, DiffLine } from "../git/types";

export function registerGenerateChangeReportCommand(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine,
  gates: FeatureGateService
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.generateChangeReport", async () => {
    const allowed = await gates.requireProFeature("Generate Change Report");
    if (!allowed) {
      return;
    }

    const git = GitClient.fromWorkspace();
    if (!git) {
      vscode.window.showWarningMessage("Narrate: open a workspace folder to generate a change report.");
      return;
    }

    if (!(await git.isGitRepository())) {
      vscode.window.showWarningMessage("Narrate: workspace is not a git repository.");
      return;
    }

    const diffRaw = await git.getWorkingTreeDiffAgainstHead();
    if (!diffRaw.trim()) {
      vscode.window.showInformationMessage("Narrate: no changes detected against HEAD.");
      return;
    }

    const parsedFiles = parseUnifiedDiff(diffRaw);
    if (parsedFiles.length === 0) {
      vscode.window.showInformationMessage("Narrate: unable to parse changed files from git diff.");
      return;
    }

    const mode = getCurrentMode(context);
    const repoRoot = await git.getRepositoryRoot();
    const branch = await git.getCurrentBranchName();
    const analysis = await buildFileAnalyses(parsedFiles, repoRoot, narrationEngine, mode);

    const report = renderChangeReportMarkdown({
      branch,
      mode,
      generatedAt: new Date().toISOString(),
      files: analysis
    });

    const exportBase = await resolveExportBaseDir(context);
    const reportSubdir = vscode.workspace
      .getConfiguration("narrate.report")
      .get<string>("outputSubdir", "reports")
      .trim();
    const reportsDir = path.join(exportBase, reportSubdir || "reports");
    await fs.mkdir(reportsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(
      reportsDir,
      `change-report-${sanitizePathSegment(branch)}-${timestamp}.md`
    );

    await fs.writeFile(reportPath, report, "utf8");
    const doc = await vscode.workspace.openTextDocument(reportPath);
    await vscode.window.showTextDocument(doc, { preview: false });
    vscode.window.showInformationMessage(`Narrate: change report created at ${reportPath}`);
  });
}

interface FileAnalysis {
  file: DiffFile;
  addedCount: number;
  removedCount: number;
  narratedAddedLines: Array<{ lineNumber: number; narration: string }>;
}

async function buildFileAnalyses(
  files: DiffFile[],
  repoRoot: string,
  narrationEngine: NarrationEngine,
  mode: "dev" | "edu"
): Promise<FileAnalysis[]> {
  const results: FileAnalysis[] = [];

  for (const file of files) {
    const changedLines = flattenChangedLines(file);
    const addedCount = changedLines.filter((line) => line.kind === "added").length;
    const removedCount = changedLines.filter((line) => line.kind === "removed").length;

    let narratedAddedLines: Array<{ lineNumber: number; narration: string }> = [];

    const canNarrateFile = file.newPath !== "/dev/null" && file.status !== "deleted";
    if (canNarrateFile) {
      const absolutePath = path.join(repoRoot, file.newPath);
      try {
        const doc = await vscode.workspace.openTextDocument(absolutePath);
        const addedLineNumbers = uniqueSorted(
          changedLines
            .filter((line) => line.kind === "added" && line.newLineNumber !== null)
            .map((line) => line.newLineNumber as number)
        );

        const ranges = groupContiguous(addedLineNumbers);
        const narrationByLine = new Map<number, string>();
        for (const range of ranges) {
          const narrated = await narrationEngine.narrateRange(doc, mode, range.start, range.end);
          for (const item of narrated) {
            narrationByLine.set(item.lineNumber, item.narration);
          }
        }
        narratedAddedLines = addedLineNumbers
          .filter((lineNo) => narrationByLine.has(lineNo))
          .map((lineNo) => ({ lineNumber: lineNo, narration: narrationByLine.get(lineNo) ?? "" }));
      } catch {
        narratedAddedLines = [];
      }
    }

    results.push({
      file,
      addedCount,
      removedCount,
      narratedAddedLines
    });
  }

  return results;
}

function flattenChangedLines(file: DiffFile): DiffLine[] {
  return file.hunks.flatMap((hunk) => hunk.lines).filter((line) => line.kind !== "context");
}

function uniqueSorted(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function groupContiguous(values: number[]): Array<{ start: number; end: number }> {
  if (values.length === 0) {
    return [];
  }
  const ranges: Array<{ start: number; end: number }> = [];
  let start = values[0];
  let end = values[0];
  for (let idx = 1; idx < values.length; idx += 1) {
    const current = values[idx];
    if (current === end + 1) {
      end = current;
    } else {
      ranges.push({ start, end });
      start = current;
      end = current;
    }
  }
  ranges.push({ start, end });
  return ranges;
}

function renderChangeReportMarkdown(input: {
  branch: string;
  mode: "dev" | "edu";
  generatedAt: string;
  files: FileAnalysis[];
}): string {
  const totalAdded = input.files.reduce((acc, file) => acc + file.addedCount, 0);
  const totalRemoved = input.files.reduce((acc, file) => acc + file.removedCount, 0);

  const sections: string[] = [
    "# Narrate Change Report",
    `Generated: ${input.generatedAt}`,
    `Branch: ${input.branch}`,
    `Narration Mode: ${input.mode.toUpperCase()}`,
    "",
    "## Summary",
    `- Files changed: ${input.files.length}`,
    `- Added lines: ${totalAdded}`,
    `- Removed lines: ${totalRemoved}`,
    ""
  ];

  for (const file of input.files) {
    const displayPath =
      file.file.status === "renamed"
        ? `${file.file.oldPath} -> ${file.file.newPath}`
        : file.file.newPath !== "/dev/null"
        ? file.file.newPath
        : file.file.oldPath;

    sections.push(`## File: \`${displayPath}\``);
    sections.push(`- Status: ${file.file.status}`);
    sections.push(`- Added lines: ${file.addedCount}`);
    sections.push(`- Removed lines: ${file.removedCount}`);
    sections.push("");

    for (const hunk of file.file.hunks) {
      sections.push(`### Hunk ${hunk.header}`);
      sections.push("```diff");
      for (const line of hunk.lines) {
        const prefix = line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " ";
        sections.push(`${prefix}${line.content}`);
      }
      sections.push("```");
      sections.push("");
    }

    if (file.narratedAddedLines.length > 0) {
      sections.push("### Narrated Added Lines");
      for (const entry of file.narratedAddedLines) {
        sections.push(`- [${entry.lineNumber}] ${entry.narration}`);
      }
      sections.push("");
    } else {
      sections.push("### Narrated Added Lines");
      sections.push("- No narration available (file removed/unavailable or no added lines).");
      sections.push("");
    }
  }

  return sections.join("\n");
}
