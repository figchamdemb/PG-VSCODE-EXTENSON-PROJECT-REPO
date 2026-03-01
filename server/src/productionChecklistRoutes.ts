/**
 * Production Checklist Routes
 * Private framework policy vault — production readiness API.
 *
 * Routes:
 *  POST /account/policy/production-checklist  – evaluate production readiness
 *  GET  /account/policy/production-checklist/domains – list available domains
 *  GET  {admin}/board/policy/production-checklist/evaluate – admin cross-scope eval
 *
 * The route handler wires all 7 domain evaluators into the production
 * checklist engine with plan-aware threshold resolution.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PlanTier, StoreState } from "./types";
import type { PolicyDomain, PolicyTenantOverlay } from "./policyVaultTypes";
import {
  evaluateProductionChecklist,
  ProductionChecklistRequest,
  DomainEvaluatorEntry
} from "./productionChecklistEvaluator";
import { evaluateCodingStandardsVerification } from "./codingStandardsVerification";
import { evaluateDependencyVerification } from "./dependencyVerification";
import { evaluateApiContractVerification } from "./apiContractVerification";
import { evaluateMcpCloudScoring } from "./mcpCloudScoring";
import { evaluateObservabilityHealth } from "./observabilityHealth";
import { evaluatePromptGuard } from "./promptExfilGuard";
import { evaluateScalabilityDiscovery } from "./scalabilityDiscoveryEvaluator";
import {
  resolveCodingThresholds,
  resolveDependencyThresholds,
  resolveCloudScoreThresholds,
  resolveObservabilityThresholds,
  resolveApiContractThresholds,
  resolvePromptGuardThresholds,
  resolveScalabilityThresholds
} from "./policyThresholdResolver";
import { ALL_POLICY_DOMAINS } from "./policyPackRegistry";

// ── Deps ────────────────────────────────────────────────────────────────

type AuthResult = { user: { id: string } };
type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

export interface RegisterProductionChecklistRoutesDeps {
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => AuthResult | undefined;
  store: {
    snapshot: () => StoreState;
  };
  resolveEffectivePlan: (
    state: StoreState,
    userId: string,
    now: Date
  ) => { plan: PlanTier };
  requireAdminPermission: (
    request: FastifyRequest,
    reply: FastifyReply,
    permissionKey: string
  ) => Promise<AdminAccessContext | undefined>;
  adminPermissionKeys: { BOARD_READ: string };
  adminRoutePrefix: string;
  safeLogInfo: (
    message: string,
    context?: Record<string, unknown>
  ) => void;
}

// ── Build evaluator list ────────────────────────────────────────────────
// Each adapter bridges the strongly-typed domain evaluator into the
// generic DomainEvaluatorEntry interface with `as any` casts.
// The production checklist engine is domain-agnostic and only reads
// status / blockers / warnings / summary from the result.

function buildSingleEvaluator(
  domain: PolicyDomain,
  evaluate: (p: any, t: any) => any,
  resolveThresholds: (plan: string, overlay: unknown) => Record<string, unknown>
): DomainEvaluatorEntry {
  return { domain, evaluate, resolveThresholds };
}

function buildEvaluators(): DomainEvaluatorEntry[] {
  type OL = PolicyTenantOverlay | null | undefined;
  return [
    buildSingleEvaluator("coding-standards", (p, t) => evaluateCodingStandardsVerification(p, t) as any,
      (plan, overlay) => resolveCodingThresholds(plan as PlanTier, overlay as OL) as any),
    buildSingleEvaluator("dependency", (p, t) => evaluateDependencyVerification(p, t) as any,
      (plan, overlay) => resolveDependencyThresholds(plan as PlanTier, overlay as OL) as any),
    buildSingleEvaluator("api-contract", (p, t) => evaluateApiContractVerification(p, t) as any,
      (plan, overlay) => resolveApiContractThresholds(plan as PlanTier, overlay as OL) as any),
    buildSingleEvaluator("cloud-score", (p, t) => evaluateMcpCloudScoring(p, t) as any,
      (plan, overlay) => resolveCloudScoreThresholds(plan as PlanTier, overlay as OL) as any),
    buildSingleEvaluator("observability", (p, t) => evaluateObservabilityHealth(p, t) as any,
      (plan, overlay) => resolveObservabilityThresholds(plan as PlanTier, overlay as OL) as any),
    buildSingleEvaluator("prompt-guard", (p, t) => evaluatePromptGuard(p, t) as any,
      (plan, overlay) => resolvePromptGuardThresholds(plan as PlanTier, overlay as OL) as any),
    buildSingleEvaluator("scalability", (p, t) => evaluateScalabilityDiscovery(p, t) as any,
      (plan, overlay) => resolveScalabilityThresholds(plan as PlanTier, overlay as OL) as any)
  ];
}

// ── Overlay helper ──────────────────────────────────────────────────────

function lookupOverlay(
  state: StoreState,
  userId: string
): PolicyTenantOverlay | null {
  const rec = state.policy_tenant_overlays.find(
    (o) => o.scope_type === "user" && o.scope_id === userId
  );
  if (!rec) return null;
  return {
    scope_type: rec.scope_type,
    scope_id: rec.scope_id,
    plan: rec.plan,
    overrides: rec.overrides as Record<string, Record<string, unknown>>,
    updated_at: rec.updated_at
  };
}

// ── Route registration ──────────────────────────────────────────────────

export function registerProductionChecklistRoutes(
  app: FastifyInstance,
  deps: RegisterProductionChecklistRoutesDeps
): void {
  const evaluators = buildEvaluators();

  // ── User production checklist evaluation ──────────────────────────────

  app.post<{ Body: ProductionChecklistRequest }>(
    "/account/policy/production-checklist",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) return;

      const state = deps.store.snapshot();
      const { plan } = deps.resolveEffectivePlan(state, auth.user.id, new Date());
      const overlay = lookupOverlay(state, auth.user.id);

      const result = evaluateProductionChecklist(request.body ?? { domains: {} }, evaluators, plan, overlay);

      deps.safeLogInfo("Production checklist evaluated", {
        user_id: auth.user.id, plan, status: result.status,
        total_blockers: result.total_blockers, total_warnings: result.total_warnings,
        domains_evaluated: result.domains_evaluated, domains_passed: result.domains_passed,
        total_duration_ms: result.total_duration_ms
      });

      return result;
    }
  );

  // ── List available domains ────────────────────────────────────────────

  app.get("/account/policy/production-checklist/domains", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) return;

    return {
      ok: true,
      domains: ALL_POLICY_DOMAINS,
      count: ALL_POLICY_DOMAINS.length,
      evaluated_at: new Date().toISOString()
    };
  });

  // ── Admin cross-scope evaluation ──────────────────────────────────────

  app.post<{ Body: ProductionChecklistRequest & { target_user_id?: string } }>(
    `${deps.adminRoutePrefix}/board/policy/production-checklist/evaluate`,
    async (request, reply) => {
      const admin = await deps.requireAdminPermission(request, reply, deps.adminPermissionKeys.BOARD_READ);
      if (!admin) return;

      const state = deps.store.snapshot();
      const targetUserId = request.body?.target_user_id ?? "";
      const { plan } = targetUserId ? deps.resolveEffectivePlan(state, targetUserId, new Date()) : { plan: "enterprise" as PlanTier };
      const overlay = targetUserId ? lookupOverlay(state, targetUserId) : null;
      const result = evaluateProductionChecklist(request.body ?? { domains: {} }, evaluators, plan, overlay);

      deps.safeLogInfo("Admin production checklist evaluated", {
        admin_email: admin.userEmail, target_user_id: targetUserId || "default-enterprise",
        status: result.status, total_blockers: result.total_blockers, domains_evaluated: result.domains_evaluated
      });

      return result;
    }
  );
}
