import { ApiContractValidationResult } from "./apiContractTypes";

const MAX_MISMATCHES_IN_PROMPT = 120;
const MAX_UNMATCHED_CALLS_IN_PROMPT = 40;

export function buildApiContractHandoffPrompt(
  workspaceRoot: string,
  result: ApiContractValidationResult
): string {
  const mismatchLines = result.mismatches
    .slice(0, MAX_MISMATCHES_IN_PROMPT)
    .map(
      (mismatch) =>
        `- [${mismatch.ruleId}] ${mismatch.method} ${mismatch.path} at ${mismatch.file}:${mismatch.line} -> ${mismatch.message}`
    );

  const unmatchedCallLines = result.unmatchedFrontendCalls
    .slice(0, MAX_UNMATCHED_CALLS_IN_PROMPT)
    .map((call) => `- ${call.method} ${call.path} at ${call.file}:${call.line}`);

  return [
    "Task: fix API contract mismatches in this workspace with minimal safe edits.",
    "",
    `Workspace: ${workspaceRoot}`,
    `Source mode: ${result.sourceMode}`,
    `Total mismatches: ${result.mismatches.length}`,
    `Unmatched frontend calls: ${result.unmatchedFrontendCalls.length}`,
    "",
    "Rules detected:",
    "- API-REQ-001: required backend field missing in frontend request.",
    "- API-REQ-002: naming mismatch (snake_case vs camelCase).",
    "- API-TYPE-001: request field type mismatch.",
    "- API-RES-001: frontend reads response field not in backend contract.",
    "",
    "Mismatch findings:",
    mismatchLines.length > 0 ? mismatchLines.join("\n") : "- none",
    "",
    "Unmatched frontend calls (no backend endpoint match):",
    unmatchedCallLines.length > 0 ? unmatchedCallLines.join("\n") : "- none",
    "",
    "Fix strategy:",
    "1. Prioritize blockers first (`API-REQ-001`, `API-TYPE-001`).",
    "2. Apply smallest change: mapper/DTO transform before broad rewrites.",
    "3. Keep API path/method behavior stable unless mismatch requires change.",
    "4. Do not edit unrelated files.",
    "",
    "Output requirements:",
    "- Provide unified diffs with file-by-file changes.",
    "- Explain each fix briefly with rule IDs addressed.",
    "- After edits, rerun API Contract Validator and summarize remaining mismatches."
  ].join("\n");
}
