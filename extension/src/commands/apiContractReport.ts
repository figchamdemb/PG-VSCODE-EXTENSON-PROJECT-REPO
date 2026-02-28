import {
  ApiContractMismatch,
  ApiContractValidationResult
} from "./apiContractTypes";

export function buildApiContractReportMarkdown(
  workspaceRoot: string,
  result: ApiContractValidationResult
): string {
  const lines: string[] = [];
  appendHeader(lines, workspaceRoot, result);
  appendSummary(lines, result);
  appendRuleBreakdown(lines, result.mismatches);
  appendMismatchDetails(lines, result.mismatches);
  appendUnmatchedCalls(lines, result);
  appendRemediationHints(lines);
  return lines.join("\n");
}

function appendHeader(
  lines: string[],
  workspaceRoot: string,
  result: ApiContractValidationResult
): void {
  lines.push("# Narrate API Contract Validator");
  lines.push("");
  lines.push(`UTC: ${result.generatedAtUtc}`);
  lines.push(`Workspace: ${workspaceRoot}`);
  lines.push(`Contract source mode: ${result.sourceMode}`);
  lines.push("");
}

function appendSummary(lines: string[], result: ApiContractValidationResult): void {
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Files discovered: ${result.filesDiscovered}`);
  lines.push(`- Files scanned: ${result.filesScanned}`);
  lines.push(`- Backend endpoints analyzed: ${result.backendEndpointCount}`);
  lines.push(`- Frontend calls analyzed: ${result.frontendCallCount}`);
  lines.push(`- Mismatches found: ${result.mismatches.length}`);
  lines.push(`- Unmatched frontend calls: ${result.unmatchedFrontendCalls.length}`);
  if (result.openApiFiles.length > 0) {
    lines.push(`- OpenAPI candidates: ${result.openApiFiles.length}`);
  }
  lines.push("");
  if (result.openApiFiles.length > 0) {
    lines.push("### OpenAPI Candidate Files");
    lines.push("");
    for (const file of result.openApiFiles.slice(0, 20)) {
      lines.push(`- \`${file}\``);
    }
    lines.push("");
  }
}

function appendRuleBreakdown(lines: string[], mismatches: ApiContractMismatch[]): void {
  const counts = new Map<string, number>();
  for (const mismatch of mismatches) {
    counts.set(mismatch.ruleId, (counts.get(mismatch.ruleId) ?? 0) + 1);
  }

  lines.push("## Rule Breakdown");
  lines.push("");
  if (counts.size === 0) {
    lines.push("- none");
    lines.push("");
    return;
  }
  const sorted = Array.from(counts.entries()).sort((left, right) => {
    if (left[1] !== right[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });
  for (const [ruleId, count] of sorted) {
    lines.push(`- \`${ruleId}\`: ${count}`);
  }
  lines.push("");
}

function appendMismatchDetails(lines: string[], mismatches: ApiContractMismatch[]): void {
  lines.push("## Mismatch Details");
  lines.push("");
  if (mismatches.length === 0) {
    lines.push("- none");
    lines.push("");
    return;
  }

  const grouped = groupByEndpoint(mismatches);
  for (const [endpoint, endpointMismatches] of grouped.entries()) {
    lines.push(`### ${endpoint}`);
    lines.push("");
    for (const mismatch of endpointMismatches) {
      lines.push(
        `- [${mismatch.severity.toUpperCase()}] \`${mismatch.ruleId}\` at \`${mismatch.file}:${mismatch.line}\` - ${mismatch.message}`
      );
    }
    lines.push("");
  }
}

function appendUnmatchedCalls(lines: string[], result: ApiContractValidationResult): void {
  lines.push("## Unmatched Frontend Calls");
  lines.push("");
  if (result.unmatchedFrontendCalls.length === 0) {
    lines.push("- none");
    lines.push("");
    return;
  }
  for (const call of result.unmatchedFrontendCalls.slice(0, 40)) {
    lines.push(`- \`${call.method} ${call.path}\` at \`${call.file}:${call.line}\``);
  }
  lines.push("");
}

function appendRemediationHints(lines: string[]): void {
  lines.push("## Remediation Hints");
  lines.push("");
  lines.push("- Prefer OpenAPI JSON as source-of-truth for request/response contracts.");
  lines.push("- Align frontend payload keys with backend required fields (`API-REQ-001`).");
  lines.push(
    "- Resolve naming drift with explicit mappers/DTO transforms (`API-REQ-002`) when snake_case and camelCase differ."
  );
  lines.push("- Align payload value types with backend schema (`API-TYPE-001`).");
  lines.push(
    "- Remove or guard frontend reads of response fields not returned by backend (`API-RES-001`)."
  );
}

function groupByEndpoint(
  mismatches: ApiContractMismatch[]
): Map<string, ApiContractMismatch[]> {
  const map = new Map<string, ApiContractMismatch[]>();
  for (const mismatch of mismatches) {
    const key = `${mismatch.method} ${mismatch.path}`;
    const current = map.get(key) ?? [];
    current.push(mismatch);
    map.set(key, current);
  }
  for (const [key, values] of map.entries()) {
    values.sort((left, right) => {
      if (left.file !== right.file) {
        return left.file.localeCompare(right.file);
      }
      if (left.line !== right.line) {
        return left.line - right.line;
      }
      return left.ruleId.localeCompare(right.ruleId);
    });
    map.set(key, values);
  }
  return map;
}
