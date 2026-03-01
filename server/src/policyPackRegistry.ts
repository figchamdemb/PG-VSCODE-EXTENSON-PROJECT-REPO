/**
 * Policy Pack Registry
 * Milestone 10E – Private framework/checklist policy vault.
 *
 * Server-private registry of default policy pack configs, tenant overlay
 * merge logic, and summary-only metadata generation.
 *
 * Rule bodies/weights/deny-lists live HERE (server-private), never exposed
 * to clients.  API callers receive only rule-IDs + finding messages.
 */

import type { PlanTier } from "./types";
import type {
  ApiContractThresholds,
  CloudScoreThresholds,
  CodingStandardsThresholds,
  DependencyThresholds,
  ObservabilityThresholds,
  PolicyDomain,
  PolicyPackSummary,
  PolicyTenantOverlay,
  PromptGuardThresholds,
  ScalabilityThresholds,
  ResolvedPolicyPack
} from "./policyVaultTypes";

// ── Version tags (bump when rule content changes) ───────────────────────

export const PACK_VERSIONS: Record<PolicyDomain, string> = {
  "coding-standards": "cs-v1.4",
  dependency: "dep-v1.2",
  "api-contract": "api-v1.1",
  "cloud-score": "cld-v1.3",
  observability: "obs-v1.1",
  "prompt-guard": "pg-v1.0",
  scalability: "scale-v1.0"
};

// ── Default threshold configs (server-private) ──────────────────────────

const DEFAULT_CODING_STANDARDS: CodingStandardsThresholds = {
  absolute_file_hard_limit: 500,
  function_target_limit: 20,
  function_hard_limit: 40,
  param_target_limit: 3,
  param_hard_limit: 5,
  controller_branch_hard_limit: 2,
  max_findings_per_file: 25
};

const DEFAULT_DEPENDENCY: DependencyThresholds = {
  stale_warning_months: 12,
  stale_block_months: 24
};

const DEFAULT_CLOUD_SCORE: CloudScoreThresholds = {
  blocker_penalty: 15,
  warning_penalty: 4
};

const DEFAULT_OBSERVABILITY: ObservabilityThresholds = {
  enabled_adapters: ["otlp", "sentry", "signoz"],
  default_deployment_profile: "pg-hosted"
};

const DEFAULT_API_CONTRACT: ApiContractThresholds = {
  max_files: 200
};

const DEFAULT_PROMPT_GUARD: PromptGuardThresholds = {
  blocker_score_threshold: 70
};

const DEFAULT_SCALABILITY: ScalabilityThresholds = {
  blocker_score_threshold: 70,
  max_findings: 30,
  discovery_block_if_missing: true
};

// ── Default map ─────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: Record<PolicyDomain, Record<string, unknown>> = {
  "coding-standards": DEFAULT_CODING_STANDARDS as unknown as Record<string, unknown>,
  dependency: DEFAULT_DEPENDENCY as unknown as Record<string, unknown>,
  "api-contract": DEFAULT_API_CONTRACT as unknown as Record<string, unknown>,
  "cloud-score": DEFAULT_CLOUD_SCORE as unknown as Record<string, unknown>,
  observability: DEFAULT_OBSERVABILITY as unknown as Record<string, unknown>,
  "prompt-guard": DEFAULT_PROMPT_GUARD as unknown as Record<string, unknown>,
  scalability: DEFAULT_SCALABILITY as unknown as Record<string, unknown>
};

// ── Pack metadata (for summary-only API) ────────────────────────────────

const PACK_SUMMARIES: PolicyPackSummary[] = [
  {
    domain: "coding-standards",
    version: PACK_VERSIONS["coding-standards"],
    available_tiers: ["free", "trial", "pro", "team", "enterprise"],
    description:
      "File/function/param LOC limits, controller structure enforcement, " +
      "input-validation requirement, query-optimization checks, log-safety analysis.",
    rule_count: 18
  },
  {
    domain: "dependency",
    version: PACK_VERSIONS.dependency,
    available_tiers: ["free", "trial", "pro", "team", "enterprise"],
    description:
      "Deny-list enforcement, staleness checks, native-alternative hints, " +
      "registry lookup validation, pre-release/pinning policies.",
    rule_count: 14
  },
  {
    domain: "api-contract",
    version: PACK_VERSIONS["api-contract"],
    available_tiers: ["pro", "team", "enterprise"],
    description:
      "OpenAPI-first contract parsing, frontend fetch/axios extraction, " +
      "request/response/type mismatch detection with rule IDs.",
    rule_count: 4
  },
  {
    domain: "cloud-score",
    version: PACK_VERSIONS["cloud-score"],
    available_tiers: ["pro", "team", "enterprise"],
    description:
      "Network/encryption/IAM/monitoring/DR/cost control rule evaluation " +
      "against cloud architecture evidence with workload-sensitivity profiles.",
    rule_count: 20
  },
  {
    domain: "observability",
    version: PACK_VERSIONS.observability,
    available_tiers: ["pro", "team", "enterprise"],
    description:
      "Adapter readiness checks for OTLP/Sentry/SigNoz with deployment-profile " +
      "awareness (PG-hosted, customer-hosted, hybrid).",
    rule_count: 8
  },
  {
    domain: "prompt-guard",
    version: PACK_VERSIONS["prompt-guard"],
    available_tiers: ["team", "enterprise"],
    description:
      "Jailbreak/policy-exfiltration pattern matching with risk-scored " +
      "allow/warn/block output and obfuscation detection.",
    rule_count: 10
  },
  {
    domain: "scalability",
    version: PACK_VERSIONS.scalability,
    available_tiers: ["pro", "team", "enterprise"],
    description:
      "Anti-pattern detection (polling, blocking I/O, in-memory state, missing reconnection) " +
      "and mandatory discovery-question completion gate for architecture-affecting features.",
    rule_count: 15
  }
];

// ── Overlay merge ───────────────────────────────────────────────────────

function deepMerge(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(overlay)) {
    const baseVal = base[key];
    const overlayVal = overlay[key];
    if (
      baseVal !== null &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal) &&
      overlayVal !== null &&
      typeof overlayVal === "object" &&
      !Array.isArray(overlayVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overlayVal as Record<string, unknown>
      );
    } else {
      result[key] = overlayVal;
    }
  }
  return result;
}

// ── Public API ──────────────────────────────────────────────────────────

/** All known policy domains. */
export const ALL_POLICY_DOMAINS: PolicyDomain[] = [
  "coding-standards",
  "dependency",
  "api-contract",
  "cloud-score",
  "observability",
  "prompt-guard",
  "scalability"
];

/** Return version string for a domain (useful for cache headers). */
export function getPolicyPackVersion(domain: PolicyDomain): string {
  return PACK_VERSIONS[domain] ?? "unknown";
}

/**
 * Resolve a full policy pack config for a given domain, plan tier,
 * and optional tenant overlay.  The overlay is deep-merged over the
 * server-private defaults.
 */
export function resolvePolicyPack(
  domain: PolicyDomain,
  plan: PlanTier,
  overlay?: PolicyTenantOverlay | null
): ResolvedPolicyPack {
  const base = DEFAULT_THRESHOLDS[domain];
  if (!base) {
    return {
      domain,
      version: "unknown",
      plan,
      tenant_overlay_applied: false,
      thresholds: {},
      resolved_at: new Date().toISOString()
    };
  }
  const domainOverride =
    overlay?.overrides?.[domain] as Record<string, unknown> | undefined;
  const merged = domainOverride ? deepMerge(base, domainOverride) : { ...base };
  return {
    domain,
    version: PACK_VERSIONS[domain],
    plan,
    tenant_overlay_applied: !!domainOverride,
    thresholds: merged,
    resolved_at: new Date().toISOString()
  };
}

/**
 * Get the summary-only list of available packs for a given plan tier.
 * Filters packs to those the plan can access.
 */
export function getAvailablePacks(plan: PlanTier): PolicyPackSummary[] {
  return PACK_SUMMARIES.filter((p) => p.available_tiers.includes(plan));
}

/**
 * Get summary-only detail for a single pack domain.
 * Returns undefined if the plan cannot access the pack.
 */
export function getPackDetail(
  domain: PolicyDomain,
  plan: PlanTier
): PolicyPackSummary | undefined {
  return PACK_SUMMARIES.find(
    (p) => p.domain === domain && p.available_tiers.includes(plan)
  );
}

/**
 * Build a tenant overlay record from raw input.
 * Validates that only known domain keys are present.
 */
export function buildTenantOverlay(
  scopeType: "user" | "team",
  scopeId: string,
  plan: PlanTier,
  rawOverrides: Record<string, unknown>
): PolicyTenantOverlay {
  const sanitized: Partial<Record<PolicyDomain, Record<string, unknown>>> = {};
  for (const domain of ALL_POLICY_DOMAINS) {
    const val = rawOverrides[domain];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      sanitized[domain] = val as Record<string, unknown>;
    }
  }
  return {
    scope_type: scopeType,
    scope_id: scopeId,
    plan,
    overrides: sanitized,
    updated_at: new Date().toISOString()
  };
}

/**
 * Count the number of override fields for a tenant overlay
 * (used in summary-only API).
 */
export function countOverrideFields(
  overlay: PolicyTenantOverlay | null | undefined
): number {
  if (!overlay?.overrides) return 0;
  let count = 0;
  for (const domain of ALL_POLICY_DOMAINS) {
    const domainOverrides = overlay.overrides[domain];
    if (domainOverrides) {
      count += Object.keys(domainOverrides).length;
    }
  }
  return count;
}

// ── Re-exports for convenience ──────────────────────────────────────────

export type {
  CodingStandardsThresholds,
  DependencyThresholds,
  CloudScoreThresholds,
  ObservabilityThresholds,
  ApiContractThresholds,
  PromptGuardThresholds,
  ScalabilityThresholds
} from "./policyVaultTypes";
