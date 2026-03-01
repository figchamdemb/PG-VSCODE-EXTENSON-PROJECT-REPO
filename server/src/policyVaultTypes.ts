/**
 * Policy Vault Types
 * Milestone 10E – Private framework/checklist policy vault.
 *
 * Shared type definitions for the server-private policy vault,
 * tenant overlay resolution, and summary-only API contracts.
 * No actual policy logic or rule bodies live in this file.
 */

import type { PlanTier } from "./types";

// ── Policy domains ──────────────────────────────────────────────────────

/** Each evaluator module maps to exactly one policy domain. */
export type PolicyDomain =
  | "coding-standards"
  | "dependency"
  | "api-contract"
  | "cloud-score"
  | "observability"
  | "prompt-guard"
  | "scalability";

// ── Coding-standards overridable thresholds ─────────────────────────────

export interface CodingStandardsThresholds {
  absolute_file_hard_limit: number;
  function_target_limit: number;
  function_hard_limit: number;
  param_target_limit: number;
  param_hard_limit: number;
  controller_branch_hard_limit: number;
  max_findings_per_file: number;
  /** Optional component-type limit overrides. key = ComponentType */
  component_overrides?: Record<string, { target?: number; hard?: number }>;
}

// ── Dependency overridable thresholds ───────────────────────────────────

export interface DependencyThresholds {
  stale_warning_months: number;
  stale_block_months: number;
  /** Additional deny-list package names (merged with built-in). */
  extra_deny_packages?: string[];
  /** Additional native-alternative hints. key = package name */
  extra_native_hints?: Record<string, string>;
}

// ── Cloud-score overridable thresholds ──────────────────────────────────

export interface CloudScoreThresholds {
  blocker_penalty: number;
  warning_penalty: number;
  /** Override which control rules are critical for standard/regulated. */
  control_overrides?: Record<string, { regulated_critical?: boolean; standard_recommended?: boolean }>;
}

// ── Observability overridable thresholds ────────────────────────────────

export interface ObservabilityThresholds {
  /** Supported adapters to evaluate (subset if tenant only uses some). */
  enabled_adapters?: ("otlp" | "sentry" | "signoz")[];
  /** Override default deployment profile baseline. */
  default_deployment_profile?: "pg-hosted" | "customer-hosted" | "hybrid";
}

// ── API-contract overridable thresholds ─────────────────────────────────

export interface ApiContractThresholds {
  max_files: number;
  /** Rule-IDs to downgrade from blocker to warning for a specific tenant. */
  downgrade_to_warning?: string[];
}

// ── Prompt-guard overridable thresholds ─────────────────────────────────

export interface PromptGuardThresholds {
  /** Score threshold above which a finding becomes a blocker. */
  blocker_score_threshold: number;
  /** Extra deny-phrase patterns (regex strings). */
  extra_deny_patterns?: string[];
}

// ── Scalability overridable thresholds ──────────────────────────────────

export interface ScalabilityThresholds {
  /** Score above which a single finding becomes a blocker (default 70). */
  blocker_score_threshold: number;
  /** Max findings returned per evaluation. */
  max_findings: number;
  /** Whether missing discovery answers block (true) or warn (false). */
  discovery_block_if_missing: boolean;
  /** Rule-IDs to downgrade from blocker to warning. */
  downgrade_to_warning?: string[];
}

// ── Unified policy pack config ──────────────────────────────────────────

export interface PolicyPackConfig {
  domain: PolicyDomain;
  version: string;
  thresholds:
    | CodingStandardsThresholds
    | DependencyThresholds
    | CloudScoreThresholds
    | ObservabilityThresholds
    | ApiContractThresholds
    | PromptGuardThresholds
    | ScalabilityThresholds;
}

// ── Tenant overlay ──────────────────────────────────────────────────────

export interface PolicyTenantOverlay {
  scope_type: "user" | "team";
  scope_id: string;
  plan: PlanTier;
  /** Per-domain threshold overrides (sparse — only fields that differ). */
  overrides: Partial<Record<PolicyDomain, Record<string, unknown>>>;
  /** ISO date when overlay was last updated. */
  updated_at: string;
}

// ── Resolved pack (after overlay merge) ─────────────────────────────────

export interface ResolvedPolicyPack {
  domain: PolicyDomain;
  version: string;
  plan: PlanTier;
  tenant_overlay_applied: boolean;
  thresholds: Record<string, unknown>;
  resolved_at: string;
}

// ── Summary-only API response types ─────────────────────────────────────

export interface PolicyPackSummary {
  domain: PolicyDomain;
  version: string;
  /** Plan tiers that can access this pack. */
  available_tiers: PlanTier[];
  /** Human-readable pack description (no rule bodies). */
  description: string;
  /** Number of rules in the pack (opaque — no rule bodies). */
  rule_count: number;
}

export interface PolicyPackSummaryResponse {
  ok: true;
  packs: PolicyPackSummary[];
  plan: PlanTier;
  evaluated_at: string;
}

export interface PolicyPackDetailResponse {
  ok: true;
  pack: PolicyPackSummary;
  plan: PlanTier;
  /** Whether this pack has tenant-specific overrides active. */
  tenant_overlay_active: boolean;
  /** Override field count (opaque). */
  tenant_override_fields: number;
  evaluated_at: string;
}
