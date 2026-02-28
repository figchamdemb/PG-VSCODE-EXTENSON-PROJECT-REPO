import * as vscode from "vscode";
import { compareApiContracts } from "./apiContractCompare";
import { scanApiContractSources } from "./apiContractCodeScan";
import {
  ApiContractSettings,
  ApiContractValidationResult
} from "./apiContractTypes";

export async function runApiContractValidation(
  workspace: vscode.WorkspaceFolder,
  settings: ApiContractSettings,
  progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<ApiContractValidationResult> {
  progress?.report({ message: "Collecting backend/frontend API sources...", increment: 5 });
  const scan = await scanApiContractSources(workspace, settings, progress);

  const contracts =
    scan.openApiContracts.length > 0 ? scan.openApiContracts : scan.backendContracts;
  const sourceMode = scan.openApiContracts.length > 0 ? "openapi" : "backend-inference";

  progress?.report({ message: "Comparing API contracts...", increment: 80 });
  const comparison = compareApiContracts(contracts, scan.frontendCalls);

  return {
    generatedAtUtc: new Date().toISOString(),
    sourceMode,
    openApiFiles: scan.openApiFiles,
    filesDiscovered: scan.filesDiscovered,
    filesScanned: scan.filesScanned,
    backendEndpointCount: contracts.length,
    frontendCallCount: scan.frontendCalls.length,
    mismatches: comparison.mismatches,
    unmatchedFrontendCalls: comparison.unmatchedFrontendCalls
  };
}
