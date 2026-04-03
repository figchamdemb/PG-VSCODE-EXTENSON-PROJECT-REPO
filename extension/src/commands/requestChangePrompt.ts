import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { NarrationEngine } from "../narration/narrationEngine";
import { StartupContextEnforcer } from "../startup/startupContextEnforcer";
import { TrustScoreService } from "../trust/trustScoreService";
import { resolveRepoRoot } from "../utils/repoRootResolver";
import { getCurrentMode } from "./modeState";

export function registerRequestChangePromptCommand(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine,
  trustScoreService: TrustScoreService,
  startupContextEnforcer: StartupContextEnforcer
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.requestChangePrompt", async () => {
    await runRequestChangePrompt(context, narrationEngine, trustScoreService, startupContextEnforcer);
  });
}

async function runRequestChangePrompt(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine,
  trustScoreService: TrustScoreService,
  startupContextEnforcer: StartupContextEnforcer
): Promise<void> {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (!(await startupContextEnforcer.ensureWorkspaceReadyForAction("requesting a change prompt", activeUri))) {
    return;
  }
  if (!(await trustScoreService.ensureActionAllowed("Request Change Prompt"))) {
    return;
  }
  const editorCtx = getEditorContext();
  if (!editorCtx) return;
  const userRequest = await getUserChangeRequest();
  if (!userRequest) return;
  const { document, startLine, endLine } = editorCtx;
  const mode = getCurrentMode(context);
  const codeSnippet = document.getText(
    new vscode.Range(startLine - 1, 0, endLine - 1, document.lineAt(endLine - 1).text.length)
  );
  const narrations = await narrationEngine.narrateRange(document, mode, startLine, endLine);
  const enforcementContext = readLatestEnforcementContext(document.uri);
  const prompt = buildChangePrompt({
    filePath: document.uri.fsPath,
    startLine,
    endLine,
    codeSnippet,
    narrationMode: mode,
    narrations,
    userRequest,
    enforcementContext
  });
  await presentPrompt(prompt);
}

function getEditorContext(): { document: vscode.TextDocument; startLine: number; endLine: number } | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { vscode.window.showWarningMessage("Narrate: open a source file first."); return null; }
  const sel = editor.selection;
  const hasSelection = !sel.isEmpty;
  return {
    document: editor.document,
    startLine: (hasSelection ? sel.start.line : sel.active.line) + 1,
    endLine: (hasSelection ? sel.end.line : sel.active.line) + 1
  };
}

async function getUserChangeRequest(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title: "Narrate Request Change", prompt: "Describe the change you want",
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? undefined : "Change request cannot be empty.")
  });
}

async function presentPrompt(prompt: string): Promise<void> {
  await vscode.env.clipboard.writeText(prompt);
  const doc = await vscode.workspace.openTextDocument({ content: prompt, language: "markdown" });
  await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
  vscode.window.showInformationMessage("Narrate: prompt copied to clipboard.");
}

interface PromptPayload {
  filePath: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  narrationMode: "dev" | "edu";
  narrations: Array<{ lineNumber: number; narration: string }>;
  userRequest: string;
  enforcementContext?: EnforcementContext;
}

function buildChangePrompt(payload: PromptPayload): string {
  const narrationBlock = payload.narrations.length > 0
    ? payload.narrations.map((i) => `- [${i.lineNumber}] ${i.narration}`).join("\n")
    : "- No narration available for selected lines.";
  const enforcementBlock = buildEnforcementBlock(payload.enforcementContext);
  return [
    "You are editing a codebase. Apply the smallest possible change.", "",
    `File: ${payload.filePath}`, `Target lines: ${payload.startLine}-${payload.endLine}`, "",
    "Current code:", "```", payload.codeSnippet, "```", "",
    `Current meaning (${payload.narrationMode}):`, narrationBlock, "",
    ...(enforcementBlock ? ["Latest enforcement context:", enforcementBlock, ""] : []),
    "Change request:", payload.userRequest, "",
    "Constraints:", "- Do not modify unrelated files unless strictly necessary.",
    "- Keep behavior unchanged outside requested scope.",
    "- Prefer minimal unified diff.",
    ...(payload.enforcementContext?.requiresOfficialDependencyReview
      ? [
          "- Do not auto-upgrade dependency major versions because of freshness warnings alone.",
          "- If you propose or apply a dependency version change, verify official vendor docs/release notes/changelog and compatibility notes first."
        ]
      : []),
    "",
    "Output:", "- Provide a unified diff patch only."
  ].join("\n");
}

type EnforcementFinding = {
  rule_id?: string;
  manifest_path?: string;
  file_path?: string;
  message?: string;
};

type DependencyReviewSource = {
  url?: string;
};

type DependencyReviewItem = {
  package_name?: string;
  action?: string;
  status?: string;
  summary_message?: string;
  policy_note?: string;
  official_sources?: DependencyReviewSource[];
};

type EnforcementContext = {
  dependencyLines: string[];
  dependencyReviewLines: string[];
  codingLines: string[];
  requiresOfficialDependencyReview: boolean;
};

function readLatestEnforcementContext(
  seedUri: vscode.Uri
): EnforcementContext | undefined {
  const repo = resolveRepoRoot({ seedUri });
  if (!repo) {
    return undefined;
  }
  const summaryPath = path.join(
    repo.repoRoot,
    "Memory-bank",
    "_generated",
    "self-check-latest.json"
  );
  if (!fs.existsSync(summaryPath)) {
    return undefined;
  }

  try {
    const raw = fs.readFileSync(summaryPath, "utf8");
    const parsed = JSON.parse(raw) as {
      enforcement_summary?: {
        dependency_result?: {
          manifests?: Array<{
            manifest_path?: string;
            blockers?: EnforcementFinding[];
            warnings?: EnforcementFinding[];
            review_results?: DependencyReviewItem[];
          }>;
        };
        coding_result?: {
          blockers?: EnforcementFinding[];
          warnings?: EnforcementFinding[];
        };
      };
    };
    const dependencyLines = buildDependencyLines(
      parsed.enforcement_summary?.dependency_result?.manifests ?? []
    );
    const dependencyReviewLines = buildDependencyReviewLines(
      parsed.enforcement_summary?.dependency_result?.manifests ?? []
    );
    const codingLines = buildCodingLines(parsed.enforcement_summary?.coding_result);
    if (dependencyLines.length === 0 && dependencyReviewLines.length === 0 && codingLines.length === 0) {
      return undefined;
    }
    return {
      dependencyLines,
      dependencyReviewLines,
      codingLines,
      requiresOfficialDependencyReview:
        dependencyLines.some((line) => line.includes("DEP-FRESHNESS-")) ||
        dependencyReviewLines.some((line) => line.includes("review-before-upgrade"))
    };
  } catch {
    return undefined;
  }
}

function buildDependencyLines(
  manifests: Array<{
    manifest_path?: string;
    blockers?: EnforcementFinding[];
    warnings?: EnforcementFinding[];
    review_results?: DependencyReviewItem[];
  }>
): string[] {
  const lines: string[] = [];
  for (const manifest of manifests) {
    const manifestPath = manifest.manifest_path ?? "package.json";
    for (const finding of [...(manifest.blockers ?? []), ...(manifest.warnings ?? [])].slice(0, 4)) {
      lines.push(
        `- Dependency warning [${finding.rule_id ?? "unknown"}] ${manifestPath}: ${finding.message ?? "Review dependency policy finding."}`
      );
    }
  }
  return lines.slice(0, 6);
}

function buildDependencyReviewLines(
  manifests: Array<{
    review_results?: DependencyReviewItem[];
  }>
): string[] {
  const lines: string[] = [];
  for (const manifest of manifests) {
    for (const review of (manifest.review_results ?? []).slice(0, 3)) {
      const sourceUrls = (review.official_sources ?? [])
        .map((item) => item.url)
        .filter((value): value is string => Boolean(value))
        .slice(0, 2);
      const sourceSuffix = sourceUrls.length > 0
        ? ` Sources: ${sourceUrls.join(" | ")}`
        : "";
      lines.push(
        `- Dependency review ${review.package_name ?? "package"}: ${review.action ?? "review"} [${review.status ?? "unknown"}] - ${review.summary_message ?? review.policy_note ?? "Review official dependency guidance."}${sourceSuffix}`
      );
    }
  }
  return lines.slice(0, 4);
}

function buildCodingLines(
  result:
    | {
        blockers?: EnforcementFinding[];
        warnings?: EnforcementFinding[];
      }
    | undefined
): string[] {
  if (!result) {
    return [];
  }
  return [...(result.blockers ?? []), ...(result.warnings ?? [])]
    .slice(0, 4)
    .map(
      (finding) =>
        `- Coding finding [${finding.rule_id ?? "unknown"}] ${finding.file_path ?? "-"}: ${finding.message ?? "Review latest coding verification finding."}`
    );
}

function buildEnforcementBlock(
  context: EnforcementContext | undefined
): string {
  if (!context) {
    return "";
  }
  const lines = [...context.dependencyLines, ...context.dependencyReviewLines, ...context.codingLines];
  if (context.requiresOfficialDependencyReview) {
    lines.push(
      "- Policy: before proposing a dependency major upgrade, check official vendor docs/release notes/changelog and compatibility guidance."
    );
  }
  return lines.join("\n");
}
