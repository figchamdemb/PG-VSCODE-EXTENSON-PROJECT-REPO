import { LineInput, NarrationMode } from "../types";

export function buildSystemPrompt(mode: NarrationMode): string {
  const modeRules =
    mode === "edu"
      ? [
          "Use plain English for absolute beginners.",
          "For non-blank lines, target 20-30 words per narration item.",
          "For blank-only lines, keep it concise but still clear (about 12-20 words).",
          "Use this order: what the line does, why it matters, then 'Example:'.",
          "Avoid jargon; if jargon is required, define it in the same sentence.",
          "Do not copy code text directly; explain meaning in natural language."
        ].join(" ")
      : "Use compact technical language for developers, around 8-14 words per line when possible.";

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
  const eduRules =
    mode === "edu"
      ? [
          "Education mode constraints:",
          "- Do not restate code tokens verbatim.",
          "- Explain in beginner-friendly words.",
          "- Keep non-blank lines between 20 and 30 words.",
          "- Add one simple concrete example using `Example:`.",
          "- Write as if teaching a first-year student."
        ].join("\n")
      : "";

  return [
    `File: ${filePath}`,
    `Mode: ${mode}`,
    "Narrate each provided line number exactly once when possible.",
    "If a line is blank or only braces, keep narration short.",
    eduRules,
    "Lines:",
    serializedLines
  ]
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
}
