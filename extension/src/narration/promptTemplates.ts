import { LineInput, NarrationMode } from "../types";

export function buildSystemPrompt(mode: NarrationMode): string {
  const modeRules =
    mode === "edu"
      ? "Use simple language and include short syntax explanations where useful."
      : "Use compact technical language for developers.";

  return [
    "You are a strict code narrator.",
    "Only describe what is explicitly present in the provided lines.",
    "Do not infer hidden systems, databases, or side effects that are not in text.",
    modeRules,
    "Return JSON only using this schema:",
    '{"items":[{"lineNumber":1,"narration":"..."}]}'
  ].join("\n");
}

export function buildUserPrompt(filePath: string, mode: NarrationMode, lines: LineInput[]): string {
  const serializedLines = lines.map((line) => `[${line.lineNumber}] ${line.text}`).join("\n");
  return [
    `File: ${filePath}`,
    `Mode: ${mode}`,
    "Narrate each provided line number exactly once when possible.",
    "If a line is blank or only braces, keep narration short.",
    "Lines:",
    serializedLines
  ].join("\n\n");
}
