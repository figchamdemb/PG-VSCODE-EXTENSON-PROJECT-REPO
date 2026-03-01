/**
 * planRoutes.ts — Public plan comparison endpoint.
 * Milestone 13B: Plan packaging + entitlement matrix v2.
 */

import { FastifyInstance } from "fastify";
import {
  getPublicPlanComparison,
  getUpgradeTargets,
  ENTITLEMENT_MATRIX
} from "./entitlementMatrix";
import type { PlanTier } from "./types";

const VALID_TIERS = new Set<string>(Object.keys(ENTITLEMENT_MATRIX));

function buildTierResponse(entry: (typeof ENTITLEMENT_MATRIX)[PlanTier], tier: string): Record<string, unknown> {
  return {
    tier,
    device_limit: entry.device_limit,
    projects_allowed_memorybank: entry.projects_allowed_memorybank,
    features: {
      export: entry.can_export, change_report: entry.can_change_report,
      edu_view: entry.can_edu_view, workspace_export: entry.can_workspace_export
    },
    governance: {
      eod_reports: entry.governance_eod_reports, mastermind: entry.governance_mastermind,
      reviewer_digest: entry.governance_reviewer_digest, decision_sync: entry.governance_decision_sync,
      slack_integration: entry.governance_slack_integration
    },
    policy_domains: entry.policy_domains,
    extension_features: {
      trust_score: entry.ext_trust_score, dead_code_scan: entry.ext_dead_code_scan,
      commit_quality_gate: entry.ext_commit_quality_gate, codebase_tour: entry.ext_codebase_tour,
      api_contract_validator: entry.ext_api_contract_validator, environment_doctor: entry.ext_environment_doctor
    }
  };
}

export function registerPlanRoutes(app: FastifyInstance): void {
  app.get("/api/plans/comparison", async () => ({ rows: getPublicPlanComparison() }));

  app.get<{ Querystring: { current?: string } }>("/api/plans/upgrades", async (request, reply) => {
    const current = (request.query.current ?? "").trim().toLowerCase();
    if (!VALID_TIERS.has(current)) {
      return reply.status(400).send({ error: "invalid_tier", message: `Provide ?current= one of: ${[...VALID_TIERS].join(", ")}` });
    }
    return { current, targets: getUpgradeTargets(current as PlanTier) };
  });

  app.get<{ Params: { tier: string } }>("/api/plans/:tier", async (request, reply) => {
    const tier = request.params.tier.toLowerCase();
    if (!VALID_TIERS.has(tier)) {
      return reply.status(404).send({ error: "unknown_tier", message: `Unknown plan tier: ${tier}` });
    }
    return buildTierResponse(ENTITLEMENT_MATRIX[tier as PlanTier], tier);
  });
}
