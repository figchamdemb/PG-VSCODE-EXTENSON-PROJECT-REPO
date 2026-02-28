import { FieldShape } from "./types";

export function parseObjectLiteralFields(payload: string): FieldShape[] {
  const normalized = payload.trim().replace(/^\{|\}$/gu, "");
  if (!normalized) {
    return [];
  }

  const fields: FieldShape[] = [];
  const seen = new Set<string>();
  const explicitPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^,}\n]+)/gu;
  for (const match of normalized.matchAll(explicitPattern)) {
    const name = match[1];
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    fields.push({ name, type: inferLiteralType(match[2] ?? "") });
  }

  const shorthandPattern = /(^|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?=,|$)/gu;
  for (const match of normalized.matchAll(shorthandPattern)) {
    const name = match[2];
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    fields.push({ name });
  }
  return fields.sort((left, right) => left.name.localeCompare(right.name));
}

export function parseMethodFromOptions(options: string): string | undefined {
  const match = options.match(/\bmethod\s*:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/iu);
  return match?.[1]?.toUpperCase();
}

export function parseAxiosRequestUrl(config: string): string | undefined {
  const match = config.match(/\burl\s*:\s*(['"`])([^'"`]+)\1/u);
  return match?.[2];
}

export function parseAxiosRequestDataFields(config: string): FieldShape[] {
  const dataMatch = config.match(/\bdata\s*:\s*(\{[\s\S]*?\})/u);
  if (!dataMatch?.[1]) {
    return [];
  }
  return parseObjectLiteralFields(dataMatch[1]);
}

export function parseRequestFieldsFromOptions(options: string): FieldShape[] {
  const bodyMatch =
    options.match(/\bbody\s*:\s*JSON\.stringify\(\s*(\{[\s\S]*?\})\s*\)/u) ??
    options.match(/\bbody\s*:\s*(\{[\s\S]*?\})/u);
  if (!bodyMatch?.[1]) {
    return [];
  }
  return parseObjectLiteralFields(bodyMatch[1]);
}

function inferLiteralType(value: string): string | undefined {
  return inferLiteralTypeFromTrimmed(value.trim());
}

function inferLiteralTypeFromTrimmed(trimmed: string): string | undefined {
  if (!trimmed) {
    return undefined;
  }
  const first = trimmed[0];
  if (first === "'" || first === '"' || first === "`") {
    return "string";
  }
  if (/^-?\d+(\.\d+)?$/u.test(trimmed)) {
    return "number";
  }
  if (/^(true|false)$/iu.test(trimmed)) {
    return "boolean";
  }
  if (first === "[") {
    return "array";
  }
  if (first === "{") {
    return "object";
  }
  return undefined;
}
