import * as vscode from "vscode";
import { CacheProvider } from "../cache/cacheProvider";
import { computeLineHash } from "../cache/hashing";
import { LlmProvider } from "../llm/provider";
import { LineInput, NarrationItem, NarrationMode } from "../types";
import { Logger } from "../utils/logger";
import { enrichEduNarration } from "./termMemory";

export class NarrationEngine {
  constructor(
    private readonly cache: CacheProvider,
    private readonly llmProvider: LlmProvider,
    private readonly logger: Logger
  ) {}

  async narrateDocument(document: vscode.TextDocument, mode: NarrationMode): Promise<Map<number, string>> {
    const linesToNarrate: LineInput[] = [];
    const narrationByLine = new Map<number, string>();
    const lineHashes = new Map<number, string>();

    for (let idx = 0; idx < document.lineCount; idx += 1) {
      const lineNumber = idx + 1;
      const text = document.lineAt(idx).text;
      const lineHash = computeLineHash(text);
      lineHashes.set(lineNumber, lineHash);

      const cached = this.cache.get(document.uri.fsPath, mode, lineHash);
      if (cached) {
        narrationByLine.set(lineNumber, cached);
      } else {
        linesToNarrate.push({ lineNumber, text });
      }
    }

    const batches = chunk(linesToNarrate, 60);
    for (const batch of batches) {
      const generated = await this.llmProvider.narrateLines(document.uri.fsPath, mode, batch);
      applyGeneratedBatch(batch, generated, narrationByLine, mode);
    }

    // Fill anything still missing with deterministic local narration.
    for (let idx = 0; idx < document.lineCount; idx += 1) {
      const lineNumber = idx + 1;
      if (!narrationByLine.has(lineNumber)) {
        const text = document.lineAt(idx).text;
        narrationByLine.set(
          lineNumber,
          postProcessNarration(text, fallbackNarration(text, mode), mode)
        );
      }
    }

    for (const [lineNumber, narration] of narrationByLine.entries()) {
      const lineHash = lineHashes.get(lineNumber);
      if (!lineHash) {
        continue;
      }
      this.cache.set(document.uri.fsPath, mode, lineHash, narration);
    }

    this.logger.info(
      `Narration complete for ${document.uri.fsPath}. lines=${document.lineCount} mode=${mode}`
    );
    return narrationByLine;
  }

  async narrateRange(
    document: vscode.TextDocument,
    mode: NarrationMode,
    startLine: number,
    endLine: number
  ): Promise<NarrationItem[]> {
    const lineMap = await this.narrateDocument(document, mode);
    const items: NarrationItem[] = [];
    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      const narration = lineMap.get(lineNumber);
      if (narration) {
        items.push({ lineNumber, narration });
      }
    }
    return items;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let idx = 0; idx < items.length; idx += size) {
    result.push(items.slice(idx, idx + size));
  }
  return result;
}

function applyGeneratedBatch(
  requestedLines: LineInput[],
  generated: NarrationItem[],
  narrationByLine: Map<number, string>,
  mode: NarrationMode
): void {
  const generatedMap = new Map<number, string>();
  for (const item of generated) {
    generatedMap.set(item.lineNumber, item.narration);
  }

  for (const line of requestedLines) {
    const rawNarration = generatedMap.get(line.lineNumber) ?? fallbackNarration(line.text, mode);
    const narration = postProcessNarration(line.text, rawNarration, mode);
    narrationByLine.set(line.lineNumber, narration);
  }
}

function fallbackNarration(text: string, mode: NarrationMode): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return mode === "edu" ? "Blank line for readability." : "Blank line.";
  }
  if (trimmed === "{" || trimmed === "}" || trimmed === "};") {
    return mode === "edu" ? "Brace line to open or close a code block." : "Block boundary.";
  }
  if (trimmed.startsWith("//")) {
    return mode === "edu"
      ? "Comment line describing code behavior for humans."
      : "Comment line.";
  }
  if (trimmed.startsWith("import ")) {
    return mode === "edu"
      ? "Imports a dependency so this file can use it."
      : "Imports a dependency.";
  }
  if (trimmed.includes("(") && trimmed.includes(")") && trimmed.endsWith("{")) {
    return mode === "edu"
      ? "Starts a function or method block with parameters."
      : "Starts a function/method block.";
  }
  return mode === "edu"
    ? `Code statement: ${trimmed.slice(0, 140)}`
    : `Code statement: ${trimmed.slice(0, 140)}`;
}

function postProcessNarration(lineText: string, narration: string, mode: NarrationMode): string {
  if (mode === "edu") {
    return enrichEduNarration(lineText, narration);
  }
  return narration.trim();
}
