/**
 * Policy Threshold Resolver
 * Milestones 13A + 10E – Evaluator threshold injection from resolved packs.
 *
 * Resolves per-domain typed thresholds from the server-private policy
 * pack registry with optional tenant overlay merge.  Evaluators call
 * the domain-specific resolver to get plan-aware thresholds or fall
 * back to hardcoded defaults when no pack is available.
 */

import type { PlanTier } from "./types";
import type {
  ApiContractThresholds,
  CloudScoreThresholds,
  CodingStandardsThresholds,
  DependencyThresholds,
  ObservabilityThresholds,
  PolicyDomain,
  PolicyTenantOverlay,
  PromptGuardThresholds,
  ScalabilityThresholds
} from "./policyVaultTypes";
import { resolvePolicyPack } from "./policyPackRegistry";

// ── Generic helper ──────────────────────────────────────────────────────

function resolveThresholds<T>(
  domain: PolicyDomain,
  plan: PlanTier,
  overlay?: PolicyTenantOverlay | null
): T | null {
  const pack = resolvePolicyPack(domain, plan, overlay);
  if (!pack || Object.keys(pack.thresholds).length === 0) {
    return null;
  }
  return pack.thresholds as unknown as T;
}

// ── Typed per-domain resolvers ──────────────────────────────────────────

export function resolveCodingThresholds(
  plan: PlanTier,
  overlay?: PolicyTenantOverlay | null
): CodingStandardsThresholds | null {
  return resolveThresholds<CodingStandardsThresholds>(
    "coding-standards", plan, overlay
  );
}

export function resolveDependencyThresholds(
  plan: PlanTier,
  overlay?: PolicyTenantOverlay | null
): DependencyThresholds | null {
  return resolveThresholds<DependencyThresholds>(
    "dependency", plan, overlay
  );
}

export function resolveCloudScoreThresholds(
  plan: PlanTier,
  overlay?: PolicyTenantOverlay | null
): CloudScoreThresholds | null {
  return resolveThresholds<CloudScoreThresholds>(
    "cloud-score", plan, overlay
  );
}

export function resolveObservabilityThresholds(
  plan: PlanTier,
  overlay?: PolicyTenantOverlay | null
): ObservabilityThresholds | null {
  return resolveThresholds<ObservabilityThresholds>(
    "observability", plan, overlay
  );
}

export function resolveApiContractThresholds(
  plan: PlanTier,
  overlay?: PolicyTenantOverlay | null
): ApiContractThresholds | null {
  return resolveThresholds<ApiContractThresholds>(
    "api-contract", plan, overlay
  );
}

export function resolvePromptGuardThresholds(
  plan: PlanTier,
  overlay?: PolicyTenantOverlay | null
): PromptGuardThresholds | null {
  return resolveThresholds<PromptGuardThresholds>(
    "prompt-guard", plan, overlay
  );
}

export function resolveScalabilityThresholds(
  plan: PlanTier,
  overlay?: PolicyTenantOverlay | null
): ScalabilityThresholds | null {
  return resolveThresholds<ScalabilityThresholds>(
    "scalability", plan, overlay
  );
}
