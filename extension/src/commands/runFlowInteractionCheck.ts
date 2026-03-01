import * as vscode from "vscode";
import { NarrationEngine } from "../narration/narrationEngine";
import { NarrateSchemeProvider } from "../readingView/narrateSchemeProvider";
import { renderNarrationDocument } from "../readingView/renderNarration";
import { Logger } from "../utils/logger";
import {
  getCurrentEduDetailLevel,
  getCurrentMode,
  getCurrentReadingPaneMode,
  getCurrentReadingSnippetMode,
  getCurrentReadingViewMode,
  setCurrentEduDetailLevel,
  setCurrentMode,
  setCurrentReadingPaneMode,
  setCurrentReadingSnippetMode,
  setCurrentReadingViewMode
} from "./modeState";
import {
  EduDetailLevel,
  NarrationMode,
  ReadingPaneMode,
  ReadingSnippetMode,
  ReadingViewMode
} from "../types";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { resolveExportBaseDir } from "./exportUtils";

type FlowCheckResult = {
  step: string;
  ok: boolean;
  details: string;
};

const REPORT_DIR = path.join("Memory-bank", "_generated");
const REPORT_FILE = "narrate-flow-interaction-check-latest.md";

export function registerRunFlowInteractionCheckCommand(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine,
  schemeProvider: NarrateSchemeProvider,
  logger: Logger
): vscode.Disposable {
  return vscode.commands.registerCommand(
    "narrate.runFlowInteractionCheck",
    async () => runFlowInteractionCheck(context, narrationEngine, schemeProvider, logger)
  );
}

async function runFlowInteractionCheck(
  context: vscode.ExtensionContext,
  narrationEngine: NarrationEngine,
  schemeProvider: NarrateSchemeProvider,
  logger: Logger
): Promise<void> {
  const results = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Narrate: Running flow interaction check",
      cancellable: false
    },
    async (progress) => {
      const checks: FlowCheckResult[] = [];
      progress.report({ message: "Mode state round-trip" });
      checks.push(await checkModeStateRoundTrip(context));
      progress.report({ message: "View mode round-trip" });
      checks.push(await checkViewModeRoundTrip(context));
      progress.report({ message: "Pane mode round-trip" });
      checks.push(await checkPaneModeRoundTrip(context));
      progress.report({ message: "Snippet mode round-trip" });
      checks.push(await checkSnippetModeRoundTrip(context));
      progress.report({ message: "EDU detail level round-trip" });
      checks.push(await checkEduDetailLevelRoundTrip(context));
      progress.report({ message: "Render pipeline" });
      checks.push(await checkRenderPipeline(narrationEngine));
      progress.report({ message: "Scheme provider" });
      checks.push(checkSchemeProvider(schemeProvider));
      progress.report({ message: "Export utility" });
      checks.push(await checkExportUtility(context));
      progress.report({ message: "Toggle command registration" });
      checks.push(await checkToggleCommandRegistration());
      return checks;
    }
  );

  const report = buildFlowInteractionReport(results);
  await showFlowInteractionReport(report, logger);
  await writeFlowInteractionArtifact(report);
}

// -- Step 1: mode state round-trip --

async function checkModeStateRoundTrip(
  context: vscode.ExtensionContext
): Promise<FlowCheckResult> {
  try {
    const originalMode = getCurrentMode(context);
    const modes: NarrationMode[] = ["dev", "edu"];
    for (const mode of modes) {
      await setCurrentMode(context, mode);
      const read = getCurrentMode(context);
      if (read !== mode) {
        return fail("Mode state round-trip", `Set ${mode} but read ${read}`);
      }
    }
    await setCurrentMode(context, originalMode);
    return pass("Mode state round-trip", "dev/edu write/read cycle OK.");
  } catch (error) {
    return fail("Mode state round-trip", String(error));
  }
}

// -- Step 2: view mode round-trip --

async function checkViewModeRoundTrip(
  context: vscode.ExtensionContext
): Promise<FlowCheckResult> {
  try {
    const original = getCurrentReadingViewMode(context);
    const modes: ReadingViewMode[] = ["exact", "section"];
    for (const mode of modes) {
      await setCurrentReadingViewMode(context, mode);
      const read = getCurrentReadingViewMode(context);
      if (read !== mode) {
        return fail("View mode round-trip", `Set ${mode} but read ${read}`);
      }
    }
    await setCurrentReadingViewMode(context, original);
    return pass("View mode round-trip", "exact/section write/read cycle OK.");
  } catch (error) {
    return fail("View mode round-trip", String(error));
  }
}

// -- Step 3: pane mode round-trip --

async function checkPaneModeRoundTrip(
  context: vscode.ExtensionContext
): Promise<FlowCheckResult> {
  try {
    const original = getCurrentReadingPaneMode(context);
    const modes: ReadingPaneMode[] = ["sideBySide", "fullPage"];
    for (const mode of modes) {
      await setCurrentReadingPaneMode(context, mode);
      const read = getCurrentReadingPaneMode(context);
      if (read !== mode) {
        return fail("Pane mode round-trip", `Set ${mode} but read ${read}`);
      }
    }
    await setCurrentReadingPaneMode(context, original);
    return pass("Pane mode round-trip", "sideBySide/fullPage write/read cycle OK.");
  } catch (error) {
    return fail("Pane mode round-trip", String(error));
  }
}

// -- Step 4: snippet mode round-trip --

async function checkSnippetModeRoundTrip(
  context: vscode.ExtensionContext
): Promise<FlowCheckResult> {
  try {
    const original = getCurrentReadingSnippetMode(context);
    const modes: ReadingSnippetMode[] = ["withSource", "narrationOnly"];
    for (const mode of modes) {
      await setCurrentReadingSnippetMode(context, mode);
      const read = getCurrentReadingSnippetMode(context);
      if (read !== mode) {
        return fail("Snippet mode round-trip", `Set ${mode} but read ${read}`);
      }
    }
    await setCurrentReadingSnippetMode(context, original);
    return pass("Snippet mode round-trip", "withSource/narrationOnly write/read cycle OK.");
  } catch (error) {
    return fail("Snippet mode round-trip", String(error));
  }
}

// -- Step 5: edu detail level round-trip --

async function checkEduDetailLevelRoundTrip(
  context: vscode.ExtensionContext
): Promise<FlowCheckResult> {
  try {
    const original = getCurrentEduDetailLevel(context);
    const levels: EduDetailLevel[] = ["standard", "beginner", "fullBeginner"];
    for (const level of levels) {
      await setCurrentEduDetailLevel(context, level);
      const read = getCurrentEduDetailLevel(context);
      if (read !== level) {
        return fail("EDU detail level round-trip", `Set ${level} but read ${read}`);
      }
    }
    await setCurrentEduDetailLevel(context, original);
    return pass("EDU detail level round-trip", "standard/beginner/fullBeginner write/read cycle OK.");
  } catch (error) {
    return fail("EDU detail level round-trip", String(error));
  }
}

// -- Step 6: render pipeline --

async function checkRenderPipeline(
  narrationEngine: NarrationEngine
): Promise<FlowCheckResult> {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme === "narrate") {
      return pass(
        "Render pipeline",
        "Skipped: no non-narrate editor open. Open a source file and rerun for full check."
      );
    }

    const doc = editor.document;
    const narrations = await narrationEngine.narrateDocument(doc, "dev");

    const exactOutput = renderNarrationDocument(doc, "dev", narrations, "exact", {
      snippetMode: "withSource",
      eduDetailLevel: "standard"
    });
    if (!exactOutput || exactOutput.length === 0) {
      return fail("Render pipeline", "Exact mode produced empty output.");
    }

    const sectionOutput = renderNarrationDocument(doc, "dev", narrations, "section", {
      snippetMode: "withSource",
      eduDetailLevel: "standard"
    });
    if (!sectionOutput || sectionOutput.length === 0) {
      return fail("Render pipeline", "Section mode produced empty output.");
    }

    const narrationOnlyOutput = renderNarrationDocument(doc, "dev", narrations, "exact", {
      snippetMode: "narrationOnly",
      eduDetailLevel: "standard"
    });
    if (!narrationOnlyOutput || narrationOnlyOutput.length === 0) {
      return fail("Render pipeline", "Narration-only mode produced empty output.");
    }

    return pass(
      "Render pipeline",
      `Active file: ${doc.uri.fsPath}. Exact (${exactOutput.length} chars), section (${sectionOutput.length} chars), narration-only (${narrationOnlyOutput.length} chars) all produced output.`
    );
  } catch (error) {
    return fail("Render pipeline", String(error));
  }
}

// -- Step 7: scheme provider sanity --

function checkSchemeProvider(
  schemeProvider: NarrateSchemeProvider
): FlowCheckResult {
  try {
    const methods = [
      "openNarrationView",
      "openNarrationFromContext",
      "getLastSession",
      "provideTextDocumentContent",
      "dispose"
    ] as const;
    const missing: string[] = [];
    for (const method of methods) {
      if (typeof (schemeProvider as unknown as Record<string, unknown>)[method] !== "function") {
        missing.push(method);
      }
    }
    if (missing.length > 0) {
      return fail("Scheme provider", `Missing methods: ${missing.join(", ")}`);
    }
    return pass("Scheme provider", "All required methods present on NarrateSchemeProvider.");
  } catch (error) {
    return fail("Scheme provider", String(error));
  }
}

// -- Step 8: export utility --

async function checkExportUtility(
  context: vscode.ExtensionContext
): Promise<FlowCheckResult> {
  try {
    const baseDir = await resolveExportBaseDir(context);
    if (!baseDir || typeof baseDir !== "string") {
      return fail("Export utility", "resolveExportBaseDir returned empty/invalid.");
    }
    await fs.mkdir(baseDir, { recursive: true });
    const testFile = path.join(baseDir, ".narrate-flow-check-probe");
    await fs.writeFile(testFile, "probe", "utf8");
    await fs.unlink(testFile);
    return pass("Export utility", `Export base dir writable: ${baseDir}`);
  } catch (error) {
    return fail("Export utility", String(error));
  }
}

// -- Step 9: toggle command registration --

const REQUIRED_TOGGLE_COMMANDS = [
  "narrate.toggleReadingModeDev",
  "narrate.toggleReadingModeEdu",
  "narrate.switchNarrationMode",
  "narrate.switchReadingViewMode",
  "narrate.switchReadingPaneMode",
  "narrate.switchReadingSnippetMode",
  "narrate.switchEduDetailLevel",
  "narrate.refreshReadingView",
  "narrate.requestChangePrompt",
  "narrate.exportNarrationFile",
  "narrate.exportNarrationWorkspace",
  "narrate.generateChangeReport"
];

async function checkToggleCommandRegistration(): Promise<FlowCheckResult> {
  try {
    const allCommands = await vscode.commands.getCommands(true);
    const commandSet = new Set(allCommands);
    const missing = REQUIRED_TOGGLE_COMMANDS.filter((cmd) => !commandSet.has(cmd));
    if (missing.length > 0) {
      return fail("Toggle command registration", `Not registered: ${missing.join(", ")}`);
    }
    return pass(
      "Toggle command registration",
      `All ${REQUIRED_TOGGLE_COMMANDS.length} toggle/switch/export commands registered.`
    );
  } catch (error) {
    return fail("Toggle command registration", String(error));
  }
}

// -- Report rendering --

function buildFlowInteractionReport(results: FlowCheckResult[]): string {
  const passCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  const lines: string[] = [];
  lines.push("# Narrate Flow Interaction Check");
  lines.push("");
  lines.push(`UTC: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`- PASS: ${passCount}`);
  lines.push(`- FAIL: ${failCount}`);
  lines.push("");
  for (const r of results) {
    lines.push(`## ${r.ok ? "PASS" : "FAIL"} - ${r.step}`);
    lines.push("");
    lines.push("```text");
    lines.push(r.details || "(no details)");
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

async function showFlowInteractionReport(
  report: string,
  logger: Logger
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    content: report,
    language: "markdown"
  });
  await vscode.window.showTextDocument(doc, { preview: false });
  const passCount = (report.match(/^## PASS/gm) ?? []).length;
  const failCount = (report.match(/^## FAIL/gm) ?? []).length;
  const level = failCount === 0 ? "info" : "warn";
  const message = failCount === 0
    ? `Narrate: flow interaction check passed (${passCount}/${passCount + failCount}).`
    : `Narrate: flow interaction check found ${failCount} issue(s). See report.`;
  if (level === "warn") {
    void vscode.window.showWarningMessage(message);
  } else {
    void vscode.window.showInformationMessage(message);
  }
  logger.info(`Flow interaction check: ${passCount} pass, ${failCount} fail.`);
}

async function writeFlowInteractionArtifact(report: string): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    return;
  }
  const targetDir = path.join(workspaceFolders[0].uri.fsPath, REPORT_DIR);
  try {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, REPORT_FILE), report, "utf8");
  } catch {
    // best-effort artifact write
  }
}

// -- Helpers --

function pass(step: string, details: string): FlowCheckResult {
  return { step, ok: true, details };
}

function fail(step: string, details: string): FlowCheckResult {
  return { step, ok: false, details };
}
