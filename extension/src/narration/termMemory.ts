type EduLineKind =
  | "blank"
  | "brace"
  | "comment"
  | "import"
  | "type_alias"
  | "interface"
  | "function_start"
  | "property"
  | "return"
  | "statement";

const EDU_TERM_EXPLANATIONS: Array<{ pattern: RegExp; explanation: string }> = [
  { pattern: /\bclass\b/, explanation: "Class means a blueprint used to create similar objects." },
  { pattern: /\binterface\b/, explanation: "Interface means a required data shape that objects must follow." },
  { pattern: /\bextends\b/, explanation: "Extends means this type reuses rules from another type." },
  { pattern: /\bimplements\b/, explanation: "Implements means the class agrees to provide required members." },
  { pattern: /\basync\b/, explanation: "Async means the function can wait for slow work without freezing the app." },
  { pattern: /\bawait\b/, explanation: "Await means pause this function until a promise finishes." },
  { pattern: /\breturn\b/, explanation: "Return means send the result back to where the function was called." },
  { pattern: /\bif\b/, explanation: "If means run code only when a condition is true." },
  { pattern: /\bfor\b/, explanation: "For means repeat a block several times." },
  { pattern: /\btry\b/, explanation: "Try/catch means run code and safely handle failures." },
  { pattern: /=>/, explanation: "Arrow syntax is a short way to define a function." },
  { pattern: /@\w+/, explanation: "Decorator syntax adds framework metadata around a class or method." }
];

const GENERIC_PHRASE = /\b(?:code statement|comment line|block boundary|blank line)\b\s*:?\s*/gi;
const BEGINNER_SIGNAL = /\b(?:because|so that|in simple terms|example:|helps|prevents)\b/i;

export function enrichEduNarration(lineText: string, narration: string): string {
  const kind = detectLineKind(lineText);
  const cleanedNarration = normalizeWhitespace(narration.replace(GENERIC_PHRASE, " ").trim());
  const baseNarration = shouldForceBeginnerTemplate(kind, cleanedNarration, lineText)
    ? buildKindSummary(kind, lineText)
    : cleanedNarration;

  const withExample =
    kind === "blank"
      ? baseNarration
      : addExampleIfMissing(baseNarration, buildKindExample(kind, lineText));
  const withTermHint = addTermHintIfNeeded(withExample, lineText);
  const detailed = ensureBeginnerDepth(withTermHint, kind);
  return limitWords(detailed, 30);
}

function detectLineKind(lineText: string): EduLineKind {
  const trimmed = lineText.trim();
  if (!trimmed) return "blank";
  if (trimmed === "{" || trimmed === "}" || trimmed === "};") return "brace";
  if (trimmed.startsWith("//")) return "comment";
  if (trimmed.startsWith("import ")) return "import";
  if (/\btype\b/.test(trimmed)) return "type_alias";
  if (/\binterface\b/.test(trimmed)) return "interface";
  if (trimmed.includes("(") && trimmed.includes(")") && trimmed.endsWith("{")) return "function_start";
  if (/\breturn\b/.test(trimmed)) return "return";
  if (/^[A-Za-z_]\w*\??\s*:\s*[^=;]+;?$/.test(trimmed)) return "property";
  return "statement";
}

function buildKindSummary(kind: EduLineKind, lineText: string): string {
  const trimmed = lineText.trim();
  const typeAliasMatch = trimmed.match(/^(?:export\s+)?type\s+([A-Za-z_]\w*)\s*=\s*(.+);?$/);
  const interfaceMatch = trimmed.match(/^(?:export\s+)?interface\s+([A-Za-z_]\w*)/);
  const propertyMatch = trimmed.match(/^([A-Za-z_]\w*)\??\s*:\s*([^=;]+);?$/);
  const importMatch = trimmed.match(/^import\s+(.+)\s+from\s+["'](.+)["'];?$/);

  if (kind === "type_alias" && typeAliasMatch) {
    const typeName = typeAliasMatch[1];
    return `This line creates ${typeName} as a safe value rule, so later code accepts only expected options and avoids invalid mode names.`;
  }
  if (kind === "interface" && interfaceMatch) {
    const interfaceName = interfaceMatch[1];
    return `This line starts ${interfaceName}, a data blueprint that lists required fields so every matching object keeps the same structure everywhere.`;
  }
  if (kind === "property" && propertyMatch) {
    const propertyName = propertyMatch[1];
    const propertyType = propertyMatch[2].trim();
    return `This line defines ${propertyName} as ${propertyType}, so this field keeps one consistent value type and prevents wrong data from spreading.`;
  }
  if (kind === "import" && importMatch) {
    const importedName = importMatch[1].replace(/\s+/g, " ").trim();
    return `This import brings ${importedName} into this file, so later lines can reuse existing code and avoid rewriting the same logic again.`;
  }

  const summaryMap: Record<EduLineKind, string> = {
    blank: "This blank line separates two ideas, giving your eyes a pause so the next code block is easier to read and understand.",
    brace: "This brace opens or closes one block, showing exactly which lines belong together for the same function, type, or interface.",
    comment: "This comment explains intent for humans, so readers understand why the code exists without changing how the program runs.",
    import: "This import makes external code available here, so this file can call shared helpers instead of duplicating functionality.",
    type_alias: "This line defines a named value rule, helping the app reject wrong options before those mistakes become runtime bugs.",
    interface: "This line starts a required data shape, so every object using it follows the same fields and stays predictable.",
    function_start: "This line starts a function block, where related steps run together to complete one clear task in the flow.",
    property: "This line defines one field with a fixed type, so invalid data is caught early and state remains consistent.",
    return: "This line sends a result back to the caller, ending this path with a clear output for the next step.",
    statement: "This line performs one concrete action in the current flow, moving data or state toward the final outcome."
  };
  return summaryMap[kind];
}

function buildKindExample(kind: EduLineKind, lineText: string): string {
  const propertyMatch = lineText.trim().match(/^([A-Za-z_]\w*)\??\s*:\s*([^;]+);?$/);
  if (kind === "property" && propertyMatch) {
    return `${propertyMatch[1]} can store values shaped like ${propertyMatch[2].trim()}.`;
  }

  const exampleMap: Record<EduLineKind, string> = {
    blank: "keep type definitions above and interface fields below",
    brace: "all lines inside braces belong to one interface or function",
    comment: "you can explain why validation is needed without changing behavior",
    import: "importing Logger lets this file call shared logging helpers",
    type_alias: "mode can be limited to values like dev or edu",
    interface: "a User can require id:number and name:string",
    function_start: "a function like add(a,b) can return a computed sum",
    property: "this field only accepts values matching its declared type",
    return: "return total sends the computed answer back to the caller",
    statement: "editing this line can directly change feature behavior"
  };
  return exampleMap[kind];
}

function addExampleIfMissing(text: string, example: string): string {
  if (/\bexample\s*:/i.test(text)) {
    return text;
  }
  const cleanedExample = example.trim().replace(/[.]+$/, "");
  return `${text} Example: ${cleanedExample}.`;
}

function addTermHintIfNeeded(text: string, lineText: string): string {
  const lowered = text.toLowerCase();
  if (lowered.includes(" means ")) {
    return text;
  }

  for (const entry of EDU_TERM_EXPLANATIONS) {
    if (entry.pattern.test(lineText)) {
      return `${text} ${entry.explanation}`;
    }
  }
  return text;
}

function ensureBeginnerDepth(text: string, kind: EduLineKind): string {
  const minimumWords = kind === "blank" ? 16 : 24;
  if (wordCount(text) >= minimumWords) {
    return text;
  }
  return `${text} In simple terms, this line matters because later lines rely on this structure to stay correct and easier to maintain.`;
}

function shouldForceBeginnerTemplate(
  kind: EduLineKind,
  narration: string,
  lineText: string
): boolean {
  if (!narration) {
    return true;
  }
  if (isTooGeneric(narration) || looksLikeCodeEcho(narration, lineText)) {
    return true;
  }
  if (wordCount(narration) < (kind === "blank" ? 12 : 18)) {
    return true;
  }
  if (/[{}();:=<>|]/.test(narration) && !BEGINNER_SIGNAL.test(narration)) {
    return true;
  }
  if (!BEGINNER_SIGNAL.test(narration)) {
    return true;
  }
  if (kind !== "blank" && !/\bexample\s*:/i.test(narration)) {
    return true;
  }
  return false;
}

function isTooGeneric(text: string): boolean {
  const lowered = text.toLowerCase();
  return (
    lowered === "code statement." ||
    lowered === "comment line." ||
    lowered === "block boundary." ||
    lowered === "blank line." ||
    lowered.startsWith("code statement") ||
    lowered === "statement" ||
    lowered.split(/\s+/).length < 4
  );
}

function looksLikeCodeEcho(narration: string, lineText: string): boolean {
  const line = normalizeWhitespace(lineText).toLowerCase();
  const spoken = normalizeWhitespace(narration).toLowerCase();
  if (!line || line.length < 8) {
    return false;
  }

  if (spoken.includes(line)) {
    return true;
  }

  const lineTokens = line.match(/[a-z_][a-z0-9_]*/g) ?? [];
  if (lineTokens.length === 0) {
    return false;
  }
  const echoed = lineTokens.filter((token) => spoken.includes(token)).length;
  return echoed / lineTokens.length >= 0.5;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function wordCount(value: string): number {
  if (!value.trim()) {
    return 0;
  }
  return value.trim().split(/\s+/).length;
}

function limitWords(value: string, maxWords: number): string {
  const words = value.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return normalizeWhitespace(value);
  }
  const truncated = words.slice(0, maxWords);
  const exampleIndex = truncated.findIndex((word) => /^example:/i.test(word));
  if (exampleIndex >= 0 && truncated.length - exampleIndex <= 4) {
    truncated.splice(exampleIndex);
    truncated.push("Example:");
    truncated.push("same");
    truncated.push("pattern");
    truncated.push("here");
  }
  const tail = truncated[truncated.length - 1]?.toLowerCase() ?? "";
  if (["or", "and", "to", "of", "for", "with", "in", "on", "at"].includes(tail)) {
    truncated.pop();
  }
  return `${truncated.join(" ").replace(/[.,:;]+$/, "")}.`;
}
