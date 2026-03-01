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
    await runGenerateChangeReport(context, narrationEngine, gates);
  });
}

interface FileAnalysis {
  file: DiffFile;
  addedCount: number;
  removedCount: number;
  narratedAddedLines: Array<{ lineNumber: number; narration: string }>;
}

async function runGenerateChangeReport(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine,
  gates: FeatureGateService
): Promise<void> {
  const prereqs = await validateChangeReportPrereqs(gates);
  if (!prereqs) return;
  const { git, parsedFiles } = prereqs;
  const mode = getCurrentMode(context);
  const repoRoot = await git.getRepositoryRoot();
  const branch = await git.getCurrentBranchName();
  const analysis = await buildFileAnalyses(parsedFiles, repoRoot, narrationEngine, mode);
  const report = renderChangeReportMarkdown({ branch, mode, generatedAt: new Date().toISOString(), files: analysis });
  const reportPath = await writeChangeReportFile(context, branch, report);
  const doc = await vscode.workspace.openTextDocument(reportPath);
  await vscode.window.showTextDocument(doc, { preview: false });
  vscode.window.showInformationMessage(`Narrate: change report created at ${reportPath}`);
}

async function validateChangeReportPrereqs(
  gates: FeatureGateService
): Promise<{ git: GitClient; parsedFiles: DiffFile[] } | null> {
  if (!(await gates.requireProFeature("Generate Change Report"))) return null;
  const git = GitClient.fromWorkspace();
  if (!git) { vscode.window.showWarningMessage("Narrate: open a workspace folder to generate a change report."); return null; }
  if (!(await git.isGitRepository())) { vscode.window.showWarningMessage("Narrate: workspace is not a git repository."); return null; }
  const diffRaw = await git.getWorkingTreeDiffAgainstHead();
  if (!diffRaw.trim()) { vscode.window.showInformationMessage("Narrate: no changes detected against HEAD."); return null; }
  const parsedFiles = parseUnifiedDiff(diffRaw);
  if (parsedFiles.length === 0) { vscode.window.showInformationMessage("Narrate: unable to parse changed files from git diff."); return null; }
  return { git, parsedFiles };
}

async function writeChangeReportFile(
  context: vscode.ExtensionContext,
  branch: string,
  report: string
): Promise<string> {
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
  return reportPath;
}

async function buildFileAnalyses(
  files: DiffFile[], repoRoot: string, narrationEngine: NarrationEngine, mode: "dev" | "edu"
): Promise<FileAnalysis[]> {
  const results: FileAnalysis[] = [];
  for (const file of files) {
    results.push(await analyzeSingleFile(file, repoRoot, narrationEngine, mode));
  }
  return results;
}

async function analyzeSingleFile(
  file: DiffFile, repoRoot: string, narrationEngine: NarrationEngine, mode: "dev" | "edu"
): Promise<FileAnalysis> {
  const changedLines = flattenChangedLines(file);
  const addedCount = changedLines.filter((l) => l.kind === "added").length;
  const removedCount = changedLines.filter((l) => l.kind === "removed").length;
  const narratedAddedLines = await narrateFileAdditions(file, repoRoot, changedLines, narrationEngine, mode);
  return { file, addedCount, removedCount, narratedAddedLines };
}

async function narrateFileAdditions(
  file: DiffFile, repoRoot: string, changedLines: DiffLine[],
  narrationEngine: NarrationEngine, mode: "dev" | "edu"
): Promise<Array<{ lineNumber: number; narration: string }>> {
  if (file.newPath === "/dev/null" || file.status === "deleted") return [];
  const absolutePath = path.join(repoRoot, file.newPath);
  try {
    const doc = await vscode.workspace.openTextDocument(absolutePath);
    const addedLineNumbers = uniqueSorted(
      changedLines.filter((l) => l.kind === "added" && l.newLineNumber !== null).map((l) => l.newLineNumber as number)
    );
    const narrationByLine = new Map<number, string>();
    for (const range of groupContiguous(addedLineNumbers)) {
      for (const item of await narrationEngine.narrateRange(doc, mode, range.start, range.end)) {
        narrationByLine.set(item.lineNumber, item.narration);
      }
    }
    return addedLineNumbers.filter((n) => narrationByLine.has(n)).map((n) => ({ lineNumber: n, narration: narrationByLine.get(n) ?? "" }));
  } catch { return []; }
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

type ChangeReportInput = {
  branch: string;
  mode: "dev" | "edu";
  generatedAt: string;
  files: FileAnalysis[];
};

function renderChangeReportMarkdown(input: ChangeReportInput): string {
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
    appendFileSection(sections, file);
  }

  return sections.join("\n");
}

function appendFileSection(sections: string[], file: FileAnalysis): void {
  const displayPath = resolveDisplayPath(file.file);
  sections.push(`## File: \`${displayPath}\``);
  sections.push(`- Status: ${file.file.status}`);
  sections.push(`- Added lines: ${file.addedCount}`);
  sections.push(`- Removed lines: ${file.removedCount}`);
  sections.push("");

  for (const hunk of file.file.hunks) {
    appendHunkSection(sections, hunk);
  }

  appendNarratedLinesSection(sections, file.narratedAddedLines);
}

function resolveDisplayPath(file: DiffFile): string {
  if (file.status === "renamed") {
    return `${file.oldPath} -> ${file.newPath}`;
  }
  if (file.newPath !== "/dev/null") {
    return file.newPath;
  }
  return file.oldPath;
}

function appendHunkSection(
  sections: string[],
  hunk: DiffFile["hunks"][number]
): void {
  sections.push(`### Hunk ${hunk.header}`);
  sections.push("```diff");
  for (const line of hunk.lines) {
    const prefix = line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " ";
    sections.push(`${prefix}${line.content}`);
  }
  sections.push("```");
  sections.push("");
}

function appendNarratedLinesSection(
  sections: string[],
  narratedAddedLines: Array<{ lineNumber: number; narration: string }>
): void {
  sections.push("### Narrated Added Lines");
  if (narratedAddedLines.length === 0) {
    sections.push("- No narration available (file removed/unavailable or no added lines).");
    sections.push("");
    return;
  }

  for (const entry of narratedAddedLines) {
    sections.push(`- [${entry.lineNumber}] ${entry.narration}`);
  }
  sections.push("");
}
