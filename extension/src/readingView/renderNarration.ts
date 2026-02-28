import * as vscode from "vscode";
import { EduDetailLevel, NarrationMode, ReadingSnippetMode, ReadingViewMode } from "../types";
import { buildNarrationSections } from "./sectionBuilder";

type RenderOptions = {
  snippetMode: ReadingSnippetMode;
  eduDetailLevel: EduDetailLevel;
};

export function renderNarrationDocument(
  sourceDocument: vscode.TextDocument,
  mode: NarrationMode,
  narrations: Map<number, string>,
  viewMode: ReadingViewMode,
  options: RenderOptions
): string {
  if (viewMode === "exact") {
    return renderNarrationExactDocument(sourceDocument, mode, narrations, options);
  }

  return renderNarrationSectionDocument(sourceDocument, mode, narrations);
}

function renderNarrationExactDocument(
  sourceDocument: vscode.TextDocument,
  mode: NarrationMode,
  narrations: Map<number, string>,
  options: RenderOptions
): string {
  const rows: string[] = [];
  const lineRefWidth = Math.max(2, String(sourceDocument.lineCount).length);
  for (let idx = 0; idx < sourceDocument.lineCount; idx += 1) {
    const lineNumber = idx + 1;
    const source = sourceDocument.lineAt(idx).text;
    const narration = formatNarrationForDisplay(
      mode,
      options.eduDetailLevel,
      source,
      narrations.get(lineNumber) ?? fallbackNarrationForExactLine(source)
    );
    const lineRef = `L${lineNumber.toString().padStart(lineRefWidth, "0")}`;
    if (options.snippetMode === "narrationOnly") {
      rows.push(`${lineRef} | ${narration}`);
      continue;
    }
    const sourceText = source.trim().length === 0 ? "<BLANK>" : sanitizeSingleLine(source);
    rows.push(`${lineRef} | ${sourceText} -> ${narration}`);
  }
  return rows.join("\n");
}

function renderNarrationSectionDocument(
  sourceDocument: vscode.TextDocument,
  mode: NarrationMode,
  narrations: Map<number, string>
): string {
  const header = [
    `# Narrate Reading View (${mode.toUpperCase()})`,
    `Source: ${sourceDocument.uri.fsPath}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "Note: `Source L<N>` values point to source-file line numbers.",
    "",
    "---",
    ""
  ];

  const body: string[] = [];
  const sections = buildNarrationSections(sourceDocument, mode, narrations);
  for (const section of sections) {
    body.push(`## ${section.title} (${section.startLine}-${section.endLine})`);
    body.push(`Summary: ${section.summary}`);
    body.push("");

    for (const line of section.lines) {
      body.push(`### Source L${line.lineNumber}`);
      body.push("```code");
      body.push(line.source);
      body.push("```");
      body.push(`- ${line.narration}`);
      body.push("");
    }
  }

  return header.concat(body).join("\n");
}

function sanitizeSingleLine(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function fallbackNarrationForExactLine(source: string): string {
  if (source.trim().length === 0) {
    return "Blank line for readability.";
  }
  return "No narration available.";
}

function formatNarrationForDisplay(
  mode: NarrationMode,
  eduDetailLevel: EduDetailLevel,
  sourceLine: string,
  narration: string
): string {
  if (mode !== "edu") {
    return sanitizeSingleLine(narration);
  }

  if (eduDetailLevel === "fullBeginner") {
    return toFullBeginnerNarration(sourceLine, narration);
  }

  if (eduDetailLevel === "beginner") {
    return toBeginnerFriendlyNarration(sourceLine, narration, 30);
  }

  return sanitizeSingleLine(narration);
}

function toBeginnerFriendlyNarration(sourceLine: string, narration: string, maxWords: number): string {
  const cleanNarration = sanitizeSingleLine(
    narration.replace(/\bcode statement\s*:\s*/gi, "").replace(/\s+/g, " ").trim()
  );
  const trimmedSource = sourceLine.trim();
  if (!trimmedSource) {
    return maxWords > 30
      ? "This blank line separates ideas so your eyes can reset, and the next code block feels clearer instead of looking like one long wall of text."
      : "This blank line separates ideas so the next block is easier to read.";
  }

  const simpleWhy = detectSimpleWhy(trimmedSource);
  const example = detectSimpleExample(trimmedSource);

  const base = cleanNarration.length > 0 ? cleanNarration : "This line performs one clear step in the program flow.";
  const expanded = `${ensureSentence(base)} Why: ${simpleWhy} Example: ${example}.`;
  return limitWords(expanded, maxWords);
}

function toFullBeginnerNarration(sourceLine: string, narration: string): string {
  const base = toBeginnerFriendlyNarration(sourceLine, narration, 40);
  const trimmedSource = sourceLine.trim();
  if (!trimmedSource) {
    return limitWords(
      `${base} Think of it like a paragraph break in a book: it helps your brain separate one idea from the next.`,
      55
    );
  }

  const analogy = detectSimpleAnalogy(trimmedSource);
  return limitWords(`${base} Simple picture: ${analogy}`, 55);
}

function detectSimpleWhy(sourceLine: string): string {
  if (/^\s*import\s+/i.test(sourceLine)) {
    return "it reuses code from another file instead of rewriting it.";
  }
  if (/\binterface\b/i.test(sourceLine)) {
    return "it defines a stable data shape so objects stay consistent.";
  }
  if (/\btype\b/i.test(sourceLine)) {
    return "it limits values to safe options and prevents invalid inputs.";
  }
  if (/^\s*[A-Za-z_]\w*\??\s*:\s*[^=;]+;?\s*$/i.test(sourceLine)) {
    return "it forces one field to keep the correct value type.";
  }
  if (sourceLine.includes("{") || sourceLine.includes("}")) {
    return "it marks block boundaries so related lines stay grouped together.";
  }
  return "it makes the next logic easier to follow and maintain.";
}

function detectSimpleExample(sourceLine: string): string {
  if (/^\s*import\s+/i.test(sourceLine)) {
    return "importing Logger lets later lines call Logger methods directly.";
  }
  if (/\binterface\b/i.test(sourceLine)) {
    return "an object must include all required fields listed in this interface.";
  }
  if (/\btype\b/i.test(sourceLine)) {
    return "a mode type can allow only values like dev or edu.";
  }
  if (/^\s*[A-Za-z_]\w*\??\s*:\s*[^=;]+;?\s*$/i.test(sourceLine)) {
    return "lineNumber: number means this field accepts numeric values only.";
  }
  return "editing this line changes how later lines behave.";
}

function detectSimpleAnalogy(sourceLine: string): string {
  if (/^\s*import\s+/i.test(sourceLine)) {
    return "like bringing a tool from another toolbox before starting work.";
  }
  if (/\binterface\b/i.test(sourceLine) || /\btype\b/i.test(sourceLine)) {
    return "like writing house rules so everyone follows the same format.";
  }
  if (/^\s*[A-Za-z_]\w*\??\s*:\s*[^=;]+;?\s*$/i.test(sourceLine)) {
    return "like labeling a box so only one kind of item can go inside.";
  }
  if (sourceLine.includes("{") || sourceLine.includes("}")) {
    return "like opening and closing a folder that groups related documents.";
  }
  return "like one small step in a recipe that helps the final dish work.";
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "This line performs one clear step in the program flow.";
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function limitWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return text;
  }
  const clipped = words.slice(0, maxWords);
  const last = clipped[clipped.length - 1] ?? "";
  const safeLast = last.replace(/[.,;:!?]+$/, "");
  clipped[clipped.length - 1] = safeLast;
  return `${clipped.join(" ")}.`;
}
