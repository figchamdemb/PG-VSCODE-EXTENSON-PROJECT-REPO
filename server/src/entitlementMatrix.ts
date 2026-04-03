/**
 * Entitlement Matrix v2
 * Milestone 13B – Plan packaging + entitlement matrix v2.
 *
 * Single source of truth for per-tier feature flags, limits,
 * governance access, policy domain availability, extension
 * feature gates, and no-reinstall upgrade merge logic.
 *
 * Aligns with building-plan-doc.md §1.3 feature matrix.
 */

import type { PlanTier, ModuleScope } from "./types";
import type { PolicyDomain } from "./policyVaultTypes";

// ── Core tier ordering (used for upgrade eligibility) ───────────────────

const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  trial: 1,
  pro: 2,
  team: 3,
  enterprise: 4
};

// ── Entitlement matrix entry ────────────────────────────────────────────

export interface EntitlementMatrixEntry {
  // ── Core licensing limits ────────────────────────────────────────────
  device_limit: number;
  projects_allowed_memorybank: number;
  token_max_ttl_hours: number;

  // ── Feature flags (extension commands) ───────────────────────────────
  can_export: boolean;
  can_change_report: boolean;
  can_edu_view: boolean;
  can_workspace_export: boolean;

  // ── Provider policy scope ────────────────────────────────────────────
  provider_policy_scope: "basic" | "light_org" | "strict_org";

  // ── Governance feature flags ─────────────────────────────────────────
  governance_eod_reports: boolean;
  governance_mastermind: boolean;
  governance_reviewer_digest: boolean;
  governance_decision_sync: boolean;
  governance_slack_integration: boolean;
  governance_reviewer_automation: boolean;

  // ── Policy domains available ─────────────────────────────────────────
  policy_domains: PolicyDomain[];

  // ── Extension feature gates ──────────────────────────────────────────
  ext_trust_score: boolean;
  ext_dead_code_scan: boolean;
  ext_commit_quality_gate: boolean;
  ext_codebase_tour: boolean;
  ext_api_contract_validator: boolean;
  ext_frontend_backend_integration: boolean;
  ext_review_workflow: boolean;
  ext_environment_doctor: boolean;

  // ── Module availability ──────────────────────────────────────────────
  default_modules: ModuleScope[];
}

// ── The matrix ──────────────────────────────────────────────────────────

export const ENTITLEMENT_MATRIX: Record<PlanTier, EntitlementMatrixEntry> = {
  free: {
    device_limit: 1,
    projects_allowed_memorybank: 5,
    token_max_ttl_hours: 12,

    can_export: false,
    can_change_report: false,
    can_edu_view: false,
    can_workspace_export: false,

    provider_policy_scope: "basic",

    governance_eod_reports: false,
    governance_mastermind: false,
    governance_reviewer_digest: false,
    governance_decision_sync: false,
    governance_slack_integration: false,
    governance_reviewer_automation: false,

    policy_domains: ["coding-standards", "dependency"],

    ext_trust_score: true,
    ext_dead_code_scan: false,
    ext_commit_quality_gate: false,
    ext_codebase_tour: false,
    ext_api_contract_validator: false,
    ext_frontend_backend_integration: false,
    ext_review_workflow: false,
    ext_environment_doctor: true,

    default_modules: ["narrate"]
  },

  trial: {
    device_limit: 1,
    projects_allowed_memorybank: 5,
    token_max_ttl_hours: 24,

    can_export: false,
    can_change_report: false,
    can_edu_view: true,       // Edu view-only during trial
    can_workspace_export: false,

    provider_policy_scope: "basic",

    governance_eod_reports: false,
    governance_mastermind: false,
    governance_reviewer_digest: false,
    governance_decision_sync: false,
    governance_slack_integration: false,
    governance_reviewer_automation: false,

    policy_domains: ["coding-standards", "dependency"],

    ext_trust_score: true,
    ext_dead_code_scan: false,
    ext_commit_quality_gate: false,
    ext_codebase_tour: false,
    ext_api_contract_validator: false,
    ext_frontend_backend_integration: false,
    ext_review_workflow: false,
    ext_environment_doctor: true,

    default_modules: ["narrate"]
  },

  pro: {
    device_limit: 2,
    projects_allowed_memorybank: 20,
    token_max_ttl_hours: 24 * 14,   // 2 weeks

    can_export: true,
    can_change_report: true,
    can_edu_view: true,
    can_workspace_export: true,

    provider_policy_scope: "basic",

    governance_eod_reports: true,
    governance_mastermind: true,
    governance_reviewer_digest: false,
    governance_decision_sync: true,
    governance_slack_integration: false,
    governance_reviewer_automation: false,

    policy_domains: [
      "coding-standards", "dependency", "api-contract",
      "cloud-score", "observability"
    ],

    ext_trust_score: true,
    ext_dead_code_scan: true,
    ext_commit_quality_gate: true,
    ext_codebase_tour: true,
    ext_api_contract_validator: true,
    ext_frontend_backend_integration: true,
    ext_review_workflow: true,
    ext_environment_doctor: true,

    default_modules: ["narrate"]
  },

  team: {
    device_limit: 10,
    projects_allowed_memorybank: 200,
    token_max_ttl_hours: 24 * 14,

    can_export: true,
    can_change_report: true,
    can_edu_view: true,
    can_workspace_export: true,

    provider_policy_scope: "light_org",

    governance_eod_reports: true,
    governance_mastermind: true,
    governance_reviewer_digest: true,
    governance_decision_sync: true,
    governance_slack_integration: true,
    governance_reviewer_automation: false,

    policy_domains: [
      "coding-standards", "dependency", "api-contract",
      "cloud-score", "observability", "prompt-guard"
    ],

    ext_trust_score: true,
    ext_dead_code_scan: true,
    ext_commit_quality_gate: true,
    ext_codebase_tour: true,
    ext_api_contract_validator: true,
    ext_frontend_backend_integration: true,
    ext_review_workflow: true,
    ext_environment_doctor: true,

    default_modules: ["narrate"]
  },

  enterprise: {
    device_limit: 50,
    projects_allowed_memorybank: 2000,
    token_max_ttl_hours: 24 * 14,

    can_export: true,
    can_change_report: true,
    can_edu_view: true,
    can_workspace_export: true,

    provider_policy_scope: "strict_org",

    governance_eod_reports: true,
    governance_mastermind: true,
    governance_reviewer_digest: true,
    governance_decision_sync: true,
    governance_slack_integration: true,
    governance_reviewer_automation: true,

    policy_domains: [
      "coding-standards", "dependency", "api-contract",
      "cloud-score", "observability", "prompt-guard"
    ],

    ext_trust_score: true,
    ext_dead_code_scan: true,
    ext_commit_quality_gate: true,
    ext_codebase_tour: true,
    ext_api_contract_validator: true,
    ext_frontend_backend_integration: true,
    ext_review_workflow: true,
    ext_environment_doctor: true,

    default_modules: ["narrate"]
  }
};

// ── Backward-compatible PlanRule shape (for existing callers) ────────────

export interface PlanRule {
  device_limit: number;
  projects_allowed_memorybank: number;
  can_export: boolean;
  can_change_report: boolean;
}

/** Legacy PLAN_RULES derived from the matrix for backward compat. */
export const PLAN_RULES: Record<PlanTier, PlanRule> = Object.fromEntries(
  (Object.keys(ENTITLEMENT_MATRIX) as PlanTier[]).map((tier) => {
    const e = ENTITLEMENT_MATRIX[tier];
    return [
      tier,
      {
        device_limit: e.device_limit,
        projects_allowed_memorybank: e.projects_allowed_memorybank,
        can_export: e.can_export,
        can_change_report: e.can_change_report
      }
    ];
  })
) as Record<PlanTier, PlanRule>;

// ── Upgrade eligibility ─────────────────────────────────────────────────

/** Check if a plan can upgrade to a target plan. */
export function canUpgradeTo(current: PlanTier, target: PlanTier): boolean {
  return TIER_RANK[target] > TIER_RANK[current];
}

/** Get all tiers the current plan can upgrade to. */
export function getUpgradeTargets(current: PlanTier): PlanTier[] {
  const rank = TIER_RANK[current];
  return (Object.keys(TIER_RANK) as PlanTier[]).filter(
    (t) => TIER_RANK[t] > rank && t !== "trial"
  );
}

// ── Module merge (no-reinstall upgrade) ─────────────────────────────────

/**
 * Merge module entitlements when a user upgrades or adds a second SKU.
 * Returns the superset of enabled modules.
 *   - SKU "narrate" → narrate
 *   - SKU "memorybank" → memorybank
 *   - SKU "bundle" → narrate + memorybank + bundle
 * If user already has narrate and buys memorybank, they get all three.
 */
export function mergeModuleEntitlements(
  existingModules: ModuleScope[],
  newModuleScope: ModuleScope
): ModuleScope[] {
  const set = new Set<ModuleScope>(existingModules);
  if (newModuleScope === "bundle") {
    set.add("narrate");
    set.add("memorybank");
    set.add("bundle");
  } else {
    set.add(newModuleScope);
  }
  // If user has both individual modules, auto-grant bundle
  if (set.has("narrate") && set.has("memorybank")) {
    set.add("bundle");
  }
  return Array.from(set);
}

// ── Public plan comparison (for pricing page / web UI) ──────────────────

export interface PlanComparisonRow {
  feature: string;
  category: "core" | "governance" | "policy" | "extension" | "limits";
  free: string;
  trial: string;
  pro: string;
  team: string;
  enterprise: string;
}

function coreRows(): PlanComparisonRow[] {
  return [
    row("core", "Dev narration reading mode", "✅", "✅", "✅", "✅", "✅"),
    row("core", "Edu narration reading mode", "❌", "view-only", "✅", "✅", "✅"),
    row("core", "Export narration (file)", "❌", "❌", "✅", "✅", "✅"),
    row("core", "Export narration (workspace)", "❌", "❌", "✅", "✅", "✅"),
    row("core", "Change report (git diff)", "❌", "❌", "✅", "✅", "✅"),
    row("core", "Prompt handoff", "✅", "✅", "✅", "✅", "✅"),
  ];
}

function limitsAndGovernanceRows(): PlanComparisonRow[] {
  return [
    row("limits", "Seat package", "1 user", "1 user", "1 user", "up to 5 seats standard", "standard + custom quote"),
    row("limits", "Device limit per licensed user", "1", "1", "2", "10", "50 standard"),
    row("limits", "Memory-bank project limit", "5", "5", "20", "200", "2000 standard + custom quote"),
    row("limits", "Provider policy", "basic", "basic", "basic", "org policy", "strict policy"),
    row("governance", "EOD reports", "❌", "❌", "✅", "✅", "✅"),
    row("governance", "Mastermind debates", "❌", "❌", "✅", "✅", "✅"),
    row("governance", "Reviewer digest", "❌", "❌", "❌", "✅", "✅"),
    row("governance", "Decision sync", "❌", "❌", "✅", "✅", "✅"),
    row("governance", "Slack integration", "❌", "❌", "❌", "✅", "✅"),
    row("governance", "Reviewer automation", "❌", "❌", "❌", "❌", "✅"),
  ];
}

function policyAndExtensionRows(): PlanComparisonRow[] {
  return [
    row("policy", "Coding standards checks", "✅", "✅", "✅", "✅", "✅"),
    row("policy", "Dependency verification", "✅", "✅", "✅", "✅", "✅"),
    row("policy", "API contract validation", "❌", "❌", "✅", "✅", "✅"),
    row("policy", "Cloud scoring", "❌", "❌", "✅", "✅", "✅"),
    row("policy", "Observability checks", "❌", "❌", "✅", "✅", "✅"),
    row("policy", "Prompt guard", "❌", "❌", "❌", "✅", "✅"),
    row("extension", "Trust score", "✅", "✅", "✅", "✅", "✅"),
    row("extension", "Dead code scan", "❌", "❌", "✅", "✅", "✅"),
    row("extension", "Commit quality gate", "❌", "❌", "✅", "✅", "✅"),
    row("extension", "Codebase tour", "❌", "❌", "✅", "✅", "✅"),
    row("extension", "API contract validator", "❌", "❌", "✅", "✅", "✅"),
    row("extension", "Frontend/backend integration workflow", "❌", "❌", "✅", "✅", "✅"),
    row("extension", "Environment doctor", "✅", "✅", "✅", "✅", "✅"),
  ];
}

/** Generate a public-safe plan comparison table for pricing/web use. */
export function getPublicPlanComparison(): PlanComparisonRow[] {
  return [...coreRows(), ...limitsAndGovernanceRows(), ...policyAndExtensionRows()];
}

function row(
  category: PlanComparisonRow["category"],
  feature: string,
  free: string,
  trial: string,
  pro: string,
  team: string,
  enterprise: string
): PlanComparisonRow {
  return { feature, category, free, trial, pro, team, enterprise };
}

// ── Query helpers ───────────────────────────────────────────────────────

/** Get the matrix entry for a plan tier. */
export function getMatrixEntry(plan: PlanTier): EntitlementMatrixEntry {
  return ENTITLEMENT_MATRIX[plan];
}

/** Check if a plan has access to a specific policy domain. */
export function planHasPolicyDomain(
  plan: PlanTier,
  domain: PolicyDomain
): boolean {
  return ENTITLEMENT_MATRIX[plan].policy_domains.includes(domain);
}

/** Get the tier rank for ordering/comparison. */
export function getTierRank(plan: PlanTier): number {
  return TIER_RANK[plan];
}
