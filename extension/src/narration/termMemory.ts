const EDU_TERM_EXPLANATIONS: Array<{ pattern: RegExp; explanation: string }> = [
  { pattern: /\bclass\b/, explanation: "class = a blueprint used to create objects." },
  { pattern: /\binterface\b/, explanation: "interface = a contract that defines required methods." },
  { pattern: /\bextends\b/, explanation: "extends = inherits behavior from a parent type." },
  { pattern: /\bimplements\b/, explanation: "implements = promises to provide interface methods." },
  { pattern: /\basync\b/, explanation: "async = allows waiting for non-blocking operations." },
  { pattern: /\bawait\b/, explanation: "await = pauses this function until async work finishes." },
  { pattern: /\breturn\b/, explanation: "return = sends a value back from a function." },
  { pattern: /\bif\b/, explanation: "if = runs code only when a condition is true." },
  { pattern: /\bfor\b/, explanation: "for = repeats code in a loop." },
  { pattern: /\btry\b/, explanation: "try/catch = handles runtime errors safely." },
  { pattern: /=>/, explanation: "=> = arrow function syntax." },
  { pattern: /@\w+/, explanation: "@name = annotation/decorator metadata." }
];

export function enrichEduNarration(lineText: string, narration: string): string {
  const cleanedNarration = narration.trim();
  const notes: string[] = [];

  for (const entry of EDU_TERM_EXPLANATIONS) {
    if (entry.pattern.test(lineText)) {
      notes.push(entry.explanation);
    }
    if (notes.length >= 2) {
      break;
    }
  }

  if (notes.length === 0) {
    return cleanedNarration;
  }

  const noteSuffix = `Syntax note: ${notes.join(" ")}`;
  if (cleanedNarration.toLowerCase().includes("syntax note:")) {
    return cleanedNarration;
  }
  return `${cleanedNarration} ${noteSuffix}`;
}
