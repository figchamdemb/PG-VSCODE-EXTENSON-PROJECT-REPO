import * as path from "path";
import * as vscode from "vscode";
import {
  ApiContractSettings,
  EndpointContract,
  FrontendCall
} from "./apiContractTypes";
import {
  discoverOpenApiFiles,
  parseOpenApiContractsFromFiles
} from "./apiContractOpenApi";
import { inferBackendContracts } from "./apiContractSourceScanBackend";
import { extractFrontendCalls } from "./apiContractSourceScanFrontend";
import { FileSnapshot } from "./apiContractSourceScanModel";

export type ApiContractSourceScan = {
  filesDiscovered: number;
  filesScanned: number;
  openApiFiles: string[];
  openApiContracts: EndpointContract[];
  backendContracts: EndpointContract[];
  frontendCalls: FrontendCall[];
};

export async function scanApiContractSources(
  workspace: vscode.WorkspaceFolder,
  settings: ApiContractSettings,
  progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<ApiContractSourceScan> {
  const files = await loadWorkspaceFiles(workspace, settings, progress);
  const openApiFiles = discoverOpenApiFiles(files.map((file) => file.relativePath));
  const openApiContracts = parseOpenApiContractsFromFiles(files);
  const backendContracts = inferBackendContracts(files);
  const frontendCalls = extractFrontendCalls(files);

  return {
    filesDiscovered: files.length,
    filesScanned: files.length,
    openApiFiles,
    openApiContracts,
    backendContracts,
    frontendCalls
  };
}

async function loadWorkspaceFiles(
  workspace: vscode.WorkspaceFolder,
  settings: ApiContractSettings,
  progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<FileSnapshot[]> {
  const uris = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspace, settings.includeGlob),
    new vscode.RelativePattern(workspace, settings.excludeGlob),
    settings.maxFiles
  );

  const snapshots: FileSnapshot[] = [];
  for (let index = 0; index < uris.length; index += 1) {
    progress?.report({
      message: `Reading ${index + 1}/${uris.length} ${vscode.workspace.asRelativePath(uris[index], false)}`,
      increment: uris.length === 0 ? 0 : ((index + 1) / uris.length) * 50
    });
    try {
      const doc = await vscode.workspace.openTextDocument(uris[index]);
      const text = doc.getText();
      snapshots.push({
        relativePath: toSlash(vscode.workspace.asRelativePath(uris[index], false)),
        text,
        lines: text.split(/\r?\n/u)
      });
    } catch {
      // Skip unreadable files.
    }
  }
  return snapshots;
}

function toSlash(value: string): string {
  return value.split(path.sep).join("/");
}
