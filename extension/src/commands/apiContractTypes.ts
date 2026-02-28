export type ApiContractSettings = {
  includeGlob: string;
  excludeGlob: string;
  maxFiles: number;
};

export type ContractSourceMode = "openapi" | "backend-inference";

export type FieldShape = {
  name: string;
  type?: string;
  required?: boolean;
};

export type EndpointContract = {
  method: string;
  path: string;
  sourceFile: string;
  requestFields: FieldShape[];
  responseFields: FieldShape[];
};

export type FrontendCall = {
  method: string;
  path: string;
  file: string;
  line: number;
  requestFields: FieldShape[];
  responseFields: string[];
};

export type ApiContractRuleId =
  | "API-REQ-001"
  | "API-REQ-002"
  | "API-TYPE-001"
  | "API-RES-001";

export type ApiContractMismatch = {
  ruleId: ApiContractRuleId;
  severity: "blocker" | "warning";
  method: string;
  path: string;
  file: string;
  line: number;
  message: string;
};

export type ApiContractValidationResult = {
  generatedAtUtc: string;
  sourceMode: ContractSourceMode;
  openApiFiles: string[];
  filesDiscovered: number;
  filesScanned: number;
  backendEndpointCount: number;
  frontendCallCount: number;
  mismatches: ApiContractMismatch[];
  unmatchedFrontendCalls: FrontendCall[];
};

export const DEFAULT_API_CONTRACT_INCLUDE_GLOB =
  "**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs,json,yml,yaml}";
export const DEFAULT_API_CONTRACT_EXCLUDE_GLOB =
  "**/{node_modules,.git,dist,build,out,coverage,.next,.turbo,Memory-bank,logs,.venv,venv,target}/**";
export const DEFAULT_API_CONTRACT_MAX_FILES = 1200;

export const OPENAPI_CANDIDATE_GLOBS = [
  "**/openapi*.json",
  "**/swagger*.json",
  "**/openapi*.yaml",
  "**/openapi*.yml",
  "**/swagger*.yaml",
  "**/swagger*.yml"
];
