// ============================================================
// CORE TYPES — Production Readiness Checker
// ============================================================

export type Severity = "blocker" | "warning" | "info";
export type Status = "pass" | "fail" | "skip";
export type Category =
  | "security"
  | "performance"
  | "error-handling"
  | "database"
  | "architecture"
  | "testing"
  | "observability"
  | "code-quality";

export type TechStack =
  | "nextjs"
  | "react"
  | "react-native"
  | "flutter"
  | "kotlin-android"
  | "java-spring-boot"
  | "nestjs"
  | "python-fastapi"
  | "python-django"
  | "typescript"
  | "prisma"
  | "postgresql"
  | "mysql"
  | "mongodb"
  | "redis"
  | "docker"
  | "kubernetes"
  | "graphql"
  | "gcp"
  | "aws";

// A single finding from a scanner
export interface Finding {
  ruleId: string;
  category: Category;
  severity: Severity;
  status: Status;
  title: string;
  detail: string;
  file?: string;
  line?: number;
  recommendation?: string;
}

// Metadata sent to the API (NEVER source code)
export interface ScanMetadata {
  scanId: string;
  timestamp: string;
  projectPath: string;
  detectedStack: TechStack[];
  findings: Finding[];
  stats: ProjectStats;
}

export interface ProjectStats {
  filesScanned: number;
  totalLoc: number;
  maxFileLoc: number;
  maxFileLocPath: string;
  fileCount: Record<string, number>; // e.g. { ".ts": 45, ".tsx": 23 }
}

// Response from the API (scored results)
export interface ScanReport {
  scanId: string;
  score: number;
  grade: string;
  productionReady: boolean;
  blockers: number;
  warnings: number;
  infos: number;
  findings: ScoredFinding[];
  summary: string;
}

export interface ScoredFinding extends Finding {
  priority: number;
}

// Scanner interface — all scanners implement this
export interface Scanner {
  name: string;
  description: string;
  supportedStacks: TechStack[];
  scan(context: ScanContext): Promise<Finding[]>;
}

export interface ScanContext {
  projectPath: string;
  detectedStack: TechStack[];
  files: FileInfo[];
}

export interface FileInfo {
  path: string;
  relativePath: string;
  extension: string;
  loc: number;
  content: string;
}

// Config for the CLI
export interface ProdCheckConfig {
  apiUrl: string;
  apiKey?: string;
  includeUiTests: boolean;
  uiTestUrl?: string;
  severityThreshold: Severity;
  ignorePaths: string[];
  ignoreRules: string[];
}
