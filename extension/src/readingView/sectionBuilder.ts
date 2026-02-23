import * as vscode from "vscode";
import { NarrationMode } from "../types";

export interface NarrationLineView {
  lineNumber: number;
  source: string;
  narration: string;
}

export interface NarrationSection {
  id: string;
  title: string;
  kind: SectionKind;
  startLine: number;
  endLine: number;
  summary: string;
  lines: NarrationLineView[];
}

type SectionKind =
  | "import"
  | "annotation"
  | "type_declaration"
  | "method_signature"
  | "comment"
  | "logic"
  | "blank";

export function buildNarrationSections(
  sourceDocument: vscode.TextDocument,
  mode: NarrationMode,
  narrations: Map<number, string>
): NarrationSection[] {
  const sections: NarrationSection[] = [];
  let current: NarrationSection | undefined;
  let sectionIndex = 0;

  for (let idx = 0; idx < sourceDocument.lineCount; idx += 1) {
    const lineNumber = idx + 1;
    const source = sourceDocument.lineAt(idx).text;
    const kind = classifyLine(source);
    const narration = narrations.get(lineNumber) ?? "No narration available.";

    if (!current || current.kind !== kind) {
      if (current) {
        finalizeSection(current, mode);
        sections.push(current);
      }
      sectionIndex += 1;
      current = {
        id: `section-${sectionIndex}`,
        title: buildSectionTitle(sectionIndex, kind),
        kind,
        startLine: lineNumber,
        endLine: lineNumber,
        summary: "",
        lines: []
      };
    }

    current.lines.push({ lineNumber, source, narration });
    current.endLine = lineNumber;
  }

  if (current) {
    finalizeSection(current, mode);
    sections.push(current);
  }

  return sections;
}

function classifyLine(raw: string): SectionKind {
  const text = raw.trim();
  if (!text) {
    return "blank";
  }
  if (text.startsWith("import ")) {
    return "import";
  }
  if (text.startsWith("@")) {
    return "annotation";
  }
  if (text.startsWith("//") || text.startsWith("/*") || text.startsWith("*")) {
    return "comment";
  }
  if (
    /\b(class|interface|enum|record|object|namespace|module)\b/.test(text) &&
    (text.endsWith("{") || text.includes("{"))
  ) {
    return "type_declaration";
  }
  if (looksLikeMethodSignature(text)) {
    return "method_signature";
  }
  return "logic";
}

function looksLikeMethodSignature(text: string): boolean {
  if (!text.endsWith("{")) {
    return false;
  }
  if (!text.includes("(") || !text.includes(")")) {
    return false;
  }
  return !text.startsWith("if ") && !text.startsWith("for ") && !text.startsWith("while ");
}

function buildSectionTitle(index: number, kind: SectionKind): string {
  const labelMap: Record<SectionKind, string> = {
    import: "Imports",
    annotation: "Annotations",
    type_declaration: "Type Declaration",
    method_signature: "Method Signatures",
    comment: "Comments",
    logic: "Implementation Logic",
    blank: "Spacing"
  };
  return `Section ${index}: ${labelMap[kind]}`;
}

function finalizeSection(section: NarrationSection, mode: NarrationMode): void {
  const span = `lines ${section.startLine}-${section.endLine}`;
  const lineCount = section.lines.length;

  const devSummaryMap: Record<SectionKind, string> = {
    import: `Dependency imports in ${span}.`,
    annotation: `Annotation metadata in ${span}.`,
    type_declaration: `Type/class declaration block in ${span}.`,
    method_signature: `Method/function signatures in ${span}.`,
    comment: `Developer comments in ${span}.`,
    logic: `Executable statements and control logic in ${span}.`,
    blank: `Whitespace separators (${lineCount} lines) in ${span}.`
  };

  const eduSummaryMap: Record<SectionKind, string> = {
    import: `This part brings in outside code so this file can use those tools (${span}).`,
    annotation: `These labels tell the framework how to treat nearby code (${span}).`,
    type_declaration: `This part introduces the main structure (class/type) for this file (${span}).`,
    method_signature: `These lines define function or method entry points and parameters (${span}).`,
    comment: `These are human notes that explain intent, not executable code (${span}).`,
    logic: `This is the main behavior where the program actually does work (${span}).`,
    blank: `These blank lines improve readability and separate ideas (${span}).`
  };

  section.summary = mode === "edu" ? eduSummaryMap[section.kind] : devSummaryMap[section.kind];
}
