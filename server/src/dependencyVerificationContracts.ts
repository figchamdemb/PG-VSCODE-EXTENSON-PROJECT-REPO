export type VerificationSeverity = "blocker" | "warning";

export interface DependencyCandidateInput {
  name?: string;
  requested_version?: string | null;
  group?: "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies";
  vulnerability_max_severity?: "critical" | "high" | "medium" | "low" | null;
}

export interface DependencyVerificationRequest {
  package_manager?: "npm";
  project_framework?:
    | "nextjs"
    | "react"
    | "nestjs"
    | "node"
    | "typescript"
    | "unknown"
    | string;
  runtime?: {
    node_version?: string | null;
  };
  options?: {
    allow_prerelease?: boolean;
    skip_registry_fetch?: boolean;
  };
  dependencies?: DependencyCandidateInput[];
}

export interface DependencyVerificationViolation {
  rule_id: string;
  severity: VerificationSeverity;
  package_name: string | null;
  message: string;
  hint: string;
}

export interface DependencyVerificationResult {
  ok: boolean;
  status: "pass" | "blocked";
  evaluator_version: "dependency-verification-v1";
  summary: {
    checked_dependencies: number;
    blockers: number;
    warnings: number;
    registry_lookup_failures: number;
    evaluated_at: string;
  };
  blockers: DependencyVerificationViolation[];
  warnings: DependencyVerificationViolation[];
}
