/**
 * planRoutes.ts — Public plan comparison endpoint.
 * Milestone 13B: Plan packaging + entitlement matrix v2.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  getPublicPlanComparison,
  getUpgradeTargets,
  ENTITLEMENT_MATRIX
} from "./entitlementMatrix";
import { StateStore } from "./store";
import type { PlanTier, StoreState, UserRecord } from "./types";

const VALID_TIERS = new Set<string>(Object.keys(ENTITLEMENT_MATRIX));

type AdminAccessContext = {
  isSuperAdmin: boolean;
  permissions: Set<string>;
  mode: "db" | "key";
  userEmail?: string;
};

export interface RegisterPlanRoutesDeps {
  store: StateStore;
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => { user: UserRecord } | undefined;
  resolveEffectivePlan: (
    state: StoreState,
    userId: string,
    now: Date
  ) => { plan: PlanTier };
  requireAdminPermission: (
    request: FastifyRequest,
    reply: FastifyReply,
    permission: string
  ) => Promise<AdminAccessContext | undefined>;
  boardReadPermission: string;
  adminRoutePrefix: string;
}

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
      api_contract_validator: entry.ext_api_contract_validator,
      frontend_backend_integration: entry.ext_frontend_backend_integration,
      environment_doctor: entry.ext_environment_doctor
    }
  };
}

function isBrowserHtmlNavigation(request: FastifyRequest): boolean {
  const acceptHeader = String(request.headers.accept ?? "").toLowerCase();
  return acceptHeader.includes("text/html");
}

function resolvePlanForUser(
  deps: RegisterPlanRoutesDeps,
  userId: string
): PlanTier {
  const snapshot = deps.store.snapshot();
  return deps.resolveEffectivePlan(snapshot, userId, new Date()).plan;
}

function registerPublicComparisonRoute(
  app: FastifyInstance
): void {
  app.get("/api/plans/comparison", async (request, reply) => {
    if (isBrowserHtmlNavigation(request)) {
      return reply.redirect("/pricing");
    }
    return { rows: getPublicPlanComparison() };
  });
}

function registerEnterpriseRawRoute(
  app: FastifyInstance,
  deps: RegisterPlanRoutesDeps
): void {
  app.get("/account/plans/comparison/raw", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const plan = resolvePlanForUser(deps, auth.user.id);
    if (plan !== "enterprise") {
      return reply.code(403).send({
        error: "enterprise plan required"
      });
    }
    return {
      scope: "enterprise",
      rows: getPublicPlanComparison()
    };
  });
}

function registerAdminRawRoute(
  app: FastifyInstance,
  deps: RegisterPlanRoutesDeps
): void {
  app.get(`${deps.adminRoutePrefix}/board/plans/comparison/raw`, async (request, reply) => {
    const admin = await deps.requireAdminPermission(
      request,
      reply,
      deps.boardReadPermission
    );
    if (!admin) {
      return;
    }
    return {
      scope: "admin",
      admin_mode: admin.mode,
      rows: getPublicPlanComparison()
    };
  });
}

export function registerPlanRoutes(
  app: FastifyInstance,
  deps: RegisterPlanRoutesDeps
): void {
  registerPublicComparisonRoute(app);
  registerEnterpriseRawRoute(app, deps);
  registerAdminRawRoute(app, deps);

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
