import { createHash } from "crypto";

export function normalizeLine(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function computeLineHash(raw: string): string {
  const normalized = normalizeLine(raw);
  return createHash("sha256").update(normalized).digest("hex");
}
