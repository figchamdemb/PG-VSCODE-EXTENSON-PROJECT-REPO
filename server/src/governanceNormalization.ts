import { StoreState } from "./types";

export function normalizeGovernanceVoteMode(
  value: string | undefined
): "majority" | "single_reviewer" | undefined {
  const candidate = value?.trim().toLowerCase();
  if (candidate === "majority" || candidate === "single_reviewer") {
    return candidate;
  }
  return undefined;
}

export function normalizeMastermindEntryType(
  value: string | undefined
): "argument" | "suggestion" | "review" | undefined {
  const candidate = value?.trim().toLowerCase();
  if (candidate === "argument" || candidate === "suggestion" || candidate === "review") {
    return candidate;
  }
  return undefined;
}

export function normalizeMastermindDecision(
  value: string | undefined
): "approve" | "reject" | "needs_change" | undefined {
  const candidate = value?.trim().toLowerCase();
  if (candidate === "approve" || candidate === "reject" || candidate === "needs_change") {
    return candidate;
  }
  return undefined;
}

export function normalizeStringList(
  list: string[] | undefined,
  maxItems: number,
  maxLength: number
): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  const unique = new Set<string>();
  for (const raw of list) {
    const value = raw.trim();
    if (!value) {
      continue;
    }
    if (value.length > maxLength) {
      throw new Error(`list item exceeds maximum length of ${maxLength}`);
    }
    unique.add(value);
    if (unique.size >= maxItems) {
      break;
    }
  }
  return Array.from(unique);
}

export function normalizeIsoDateOrNull(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const candidate = value.trim();
  if (!candidate) {
    return null;
  }
  const time = Date.parse(candidate);
  if (!Number.isFinite(time)) {
    throw new Error("invalid date value");
  }
  return new Date(time).toISOString();
}

export function normalizeMastermindOptionKey(raw: string | undefined, fallback: string): string {
  const value = (raw ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (value.length < 2) {
    return fallback;
  }
  return value.slice(0, 40);
}

export function parseMastermindOptionsInput(
  options: Array<{ option_key?: string; title?: string; rationale?: string | null }> | undefined,
  maxDebateChars: number
): Array<{ option_key: string; title: string; rationale: string | null }> {
  if (!Array.isArray(options)) {
    return [];
  }
  const normalized: Array<{ option_key: string; title: string; rationale: string | null }> = [];
  const seenKeys = new Set<string>();
  for (let index = 0; index < options.length; index += 1) {
    const candidate = options[index];
    const fallbackKey = `option-${index + 1}`;
    const optionKey = normalizeMastermindOptionKey(candidate.option_key, fallbackKey);
    if (seenKeys.has(optionKey)) {
      throw new Error(`duplicate option_key: ${optionKey}`);
    }
    seenKeys.add(optionKey);
    const title = candidate.title?.trim();
    if (!title) {
      throw new Error("each option requires title");
    }
    if (title.length > 180) {
      throw new Error("option title is too long");
    }
    const rationale = candidate.rationale?.trim() || null;
    if (rationale && rationale.length > maxDebateChars) {
      throw new Error(`option rationale exceeds max_debate_chars (${maxDebateChars})`);
    }
    normalized.push({
      option_key: optionKey,
      title,
      rationale
    });
  }
  return normalized.slice(0, 12);
}
