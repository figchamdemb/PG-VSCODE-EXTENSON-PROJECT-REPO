export type TrustSeverity = "blocker" | "warning";

export type ComponentType =
  | "controller"
  | "service"
  | "repository"
  | "component"
  | "hook"
  | "screen"
  | "page"
  | "test"
  | "unknown";

export type TrustFinding = {
  ruleId: string;
  severity: TrustSeverity;
  message: string;
  file: string;
  line?: number;
  componentType?: ComponentType;
};

export type TrustReport = {
  score: number;
  status: "green" | "yellow" | "red";
  grade: string;
  blockers: number;
  warnings: number;
  findings: TrustFinding[];
  file: string;
  lineCount: number;
  componentType: ComponentType;
  updatedAtUtc: string;
};

export const ANALYZABLE_LANGUAGES = new Set([
  "typescript",
  "typescriptreact",
  "javascript",
  "javascriptreact",
  "python",
  "java",
  "go",
  "rust",
  "csharp",
  "php",
  "ruby"
]);
