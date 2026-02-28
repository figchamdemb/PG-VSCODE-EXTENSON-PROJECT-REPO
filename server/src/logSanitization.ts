const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MAX_STRING_LENGTH = 2000;
const MAX_OBJECT_DEPTH = 4;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 80;

export function sanitizeLogText(value: unknown, maxLength = MAX_STRING_LENGTH): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const escaped = raw
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(CONTROL_CHAR_REGEX, "?");
  if (escaped.length <= maxLength) {
    return escaped;
  }
  return `${escaped.slice(0, maxLength)}...(truncated)`;
}

export function sanitizeLogValue(value: unknown): unknown {
  return sanitizeValueInternal(value, 0, new WeakSet<object>());
}

function sanitizeValueInternal(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return sanitizeLogText(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return sanitizeLogText(value.toString());
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: sanitizeLogText(value.name, 200),
      message: sanitizeLogText(value.message),
      stack: sanitizeLogText(value.stack ?? "", 4000)
    };
  }
  if (Array.isArray(value)) {
    if (depth >= MAX_OBJECT_DEPTH) {
      return `[Array depth>${MAX_OBJECT_DEPTH}]`;
    }
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValueInternal(item, depth + 1, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) {
      return "[Circular]";
    }
    if (depth >= MAX_OBJECT_DEPTH) {
      return `[Object depth>${MAX_OBJECT_DEPTH}]`;
    }
    seen.add(value as object);
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);
    const out: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      out[sanitizeLogText(key, 120)] = sanitizeValueInternal(entry, depth + 1, seen);
    }
    return out;
  }
  return sanitizeLogText(value);
}
