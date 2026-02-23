import { NarrationItem } from "../types";

interface ParsedPayload {
  items?: NarrationItem[];
}

export function parseNarrationPayload(rawContent: string): NarrationItem[] {
  const normalized = stripCodeFences(rawContent).trim();
  const parsed = JSON.parse(normalized) as ParsedPayload;
  if (!Array.isArray(parsed.items)) {
    return [];
  }

  return parsed.items
    .filter((item) => Number.isInteger(item.lineNumber) && typeof item.narration === "string")
    .map((item) => ({ lineNumber: item.lineNumber, narration: item.narration.trim() }))
    .filter((item) => item.lineNumber > 0 && item.narration.length > 0);
}

function stripCodeFences(raw: string): string {
  if (raw.startsWith("```")) {
    return raw.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n```$/, "");
  }
  return raw;
}
