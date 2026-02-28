import { discoverOpenApiFiles, parseOpenApiContractsFromFiles } from "./openApi";
import { inferBackendContracts } from "./sourceScanBackend";
import { extractFrontendCalls } from "./sourceScanFrontend";
import { FileSnapshot } from "./sourceScanModel";
import { EndpointContract, FrontendCall } from "./types";

export type ApiContractSourceScan = {
  filesDiscovered: number;
  filesScanned: number;
  openApiFiles: string[];
  openApiContracts: EndpointContract[];
  backendContracts: EndpointContract[];
  frontendCalls: FrontendCall[];
};

export function scanApiContractSourcesFromFiles(
  files: Array<{ path: string; content: string }>
): ApiContractSourceScan {
  const snapshots = toFileSnapshots(files);
  const discoveredCount = files.length;
  const openApiFiles = discoverOpenApiFiles(snapshots.map((file) => file.relativePath));
  const openApiContracts = parseOpenApiContractsFromFiles(snapshots);
  const backendContracts = inferBackendContracts(snapshots);
  const frontendCalls = extractFrontendCalls(snapshots);

  return {
    filesDiscovered: discoveredCount,
    filesScanned: snapshots.length,
    openApiFiles,
    openApiContracts,
    backendContracts,
    frontendCalls
  };
}

function toFileSnapshots(files: Array<{ path: string; content: string }>): FileSnapshot[] {
  const snapshots: FileSnapshot[] = [];
  for (const file of files) {
    if (!file.path || typeof file.content !== "string") {
      continue;
    }
    const text = file.content;
    snapshots.push({
      relativePath: toSlash(file.path),
      text,
      lines: text.split(/\r?\n/u)
    });
  }
  return snapshots;
}

function toSlash(value: string): string {
  return value.replace(/\\/gu, "/");
}
