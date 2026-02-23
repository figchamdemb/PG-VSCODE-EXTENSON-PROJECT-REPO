import * as vscode from "vscode";
import { NarrationMode } from "../types";
import { buildNarrationSections } from "./sectionBuilder";

export function renderNarrationDocument(
  sourceDocument: vscode.TextDocument,
  mode: NarrationMode,
  narrations: Map<number, string>
): string {
  const header = [
    `# Narrate Reading View (${mode.toUpperCase()})`,
    `Source: ${sourceDocument.uri.fsPath}`,
    `Generated: ${new Date().toISOString()}`,
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
      body.push(`### [${line.lineNumber}]`);
      body.push("```code");
      body.push(line.source);
      body.push("```");
      body.push(`- ${line.narration}`);
      body.push("");
    }
  }

  return header.concat(body).join("\n");
}
