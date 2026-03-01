import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CodingStandardsVerificationRequest,
  evaluateCodingStandardsVerification
} from "./codingStandardsVerification";
import {
  DependencyVerificationRequest,
  evaluateDependencyVerification
} from "./dependencyVerification";
import {
  ApiContractVerificationRequest,
  evaluateApiContractVerification
} from "./apiContractVerification";
import { McpCloudScoringRequest, evaluateMcpCloudScoring } from "./mcpCloudScoring";
import {
  ObservabilityHealthRequest,
  evaluateObservabilityHealth
} from "./observabilityHealth";
import { PromptGuardRequest, evaluatePromptGuard } from "./promptExfilGuard";
import { logPromptGuardAuditEvent } from "./enforcementAuditRoutes";
import {
  ScalabilityDiscoveryRequest,
  evaluateScalabilityDiscovery,
  getDiscoveryQuestions
} from "./scalabilityDiscoveryEvaluator";
import { registerPolicyVaultRoutes } from "./policyVaultRoutes";
import { registerProductionChecklistRoutes } from "./productionChecklistRoutes";
import { registerAgentsProfileRoutes } from "./agentsPolicyProfile";
import { registerTechDebtRoutes } from "./techDebtRoutes";
import {
  resolveCodingThresholds, resolveDependencyThresholds, resolveCloudScoreThresholds,
  resolveObservabilityThresholds, resolveApiContractThresholds, resolvePromptGuardThresholds,
  resolveScalabilityThresholds
} from "./policyThresholdResolver";
import type { PlanTier, StoreState } from "./types";
import type { PolicyTenantOverlay } from "./policyVaultTypes";

type AuthResult = {
  user: {
    id: string;
  };
};

type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

export type RegisterPolicyRoutesDeps = {
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => AuthResult | undefined;
  safeLogInfo: (message: string, context?: Record<string, unknown>) => void;
  store: { snapshot: () => StoreState; update: (mutator: (state: StoreState) => void) => Promise<void> };
  resolveEffectivePlan: (
    state: StoreState, userId: string, now: Date
  ) => { plan: PlanTier };
  requireAdminPermission: (
    request: FastifyRequest,
    reply: FastifyReply,
    permissionKey: string
  ) => Promise<AdminAccessContext | undefined>;
  adminPermissionKeys: { BOARD_READ: string };
  adminRoutePrefix: string;
};

export function registerPolicyRoutes(
  app: FastifyInstance,
  deps: RegisterPolicyRoutesDeps
): void {
  const resolvePlan = (userId: string): PlanTier =>
    deps.resolveEffectivePlan(deps.store.snapshot(), userId, new Date()).plan;

  const lookupOverlay = (userId: string): PolicyTenantOverlay | null => {
    const state = deps.store.snapshot();
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
  };

  app.post<{ Body: DependencyVerificationRequest }>(
    "/account/policy/dependency/verify",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = await evaluateDependencyVerification(request.body ?? {}, resolveDependencyThresholds(resolvePlan(auth.user.id), lookupOverlay(auth.user.id)));
      deps.safeLogInfo("Dependency verification completed", {
        user_id: auth.user.id,
        verification_status: result.status,
        blockers: result.summary.blockers,
        warnings: result.summary.warnings
      });
      return result;
    }
  );

  app.post<{ Body: CodingStandardsVerificationRequest }>(
    "/account/policy/coding/verify",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = evaluateCodingStandardsVerification(request.body ?? {}, resolveCodingThresholds(resolvePlan(auth.user.id), lookupOverlay(auth.user.id)));
      deps.safeLogInfo("Coding standards verification completed", {
        user_id: auth.user.id,
        verification_status: result.status,
        blockers: result.summary.blockers,
        warnings: result.summary.warnings,
        checked_files: result.summary.checked_files
      });
      return result;
    }
  );

  app.post<{ Body: ApiContractVerificationRequest }>(
    "/account/policy/api-contract/verify",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = evaluateApiContractVerification(request.body ?? {}, resolveApiContractThresholds(resolvePlan(auth.user.id), lookupOverlay(auth.user.id)));
      deps.safeLogInfo("API contract verification completed", {
        user_id: auth.user.id,
        verification_status: result.status,
        blockers: result.summary.blockers,
        warnings: result.summary.warnings,
        mismatches: result.summary.mismatches,
        unmatched_frontend_calls: result.summary.unmatched_frontend_calls
      });
      return result;
    }
  );

  app.post<{ Body: PromptGuardRequest }>(
    "/account/policy/prompt/guard",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = evaluatePromptGuard(request.body ?? {}, resolvePromptGuardThresholds(resolvePlan(auth.user.id), lookupOverlay(auth.user.id)));
      deps.safeLogInfo("Prompt guard evaluation completed", {
        user_id: auth.user.id,
        guard_status: result.status,
        risk_score: result.risk_score,
        matched_rules: result.summary.matched_rules,
        source: result.summary.source
      });
      logPromptGuardAuditEvent(
        deps.store, auth.user.id, result.status,
        result.risk_score, result.summary.matched_rules, result.summary.source
      ).catch(() => { /* best-effort audit logging */ });
      return result;
    }
  );

  app.post<{ Body: McpCloudScoringRequest }>(
    "/account/policy/mcp/cloud-score",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = evaluateMcpCloudScoring(request.body ?? {}, resolveCloudScoreThresholds(resolvePlan(auth.user.id), lookupOverlay(auth.user.id)));
      deps.safeLogInfo("MCP cloud scoring completed", {
        user_id: auth.user.id,
        scoring_status: result.status,
        score: result.score,
        blockers: result.summary.blockers,
        warnings: result.summary.warnings,
        scanners: result.summary.scanners,
        workload_sensitivity: result.summary.workload_sensitivity,
        source: result.summary.source
      });
      return result;
    }
  );

  app.post<{ Body: ObservabilityHealthRequest }>(
    "/account/policy/observability/check",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = evaluateObservabilityHealth(request.body ?? {}, resolveObservabilityThresholds(resolvePlan(auth.user.id), lookupOverlay(auth.user.id)));
      deps.safeLogInfo("Observability health check completed", {
        user_id: auth.user.id,
        status: result.status,
        deployment_profile: result.summary.deployment_profile,
        enabled_adapters: result.summary.enabled_adapters,
        ready_adapters: result.summary.ready_adapters,
        blockers: result.summary.blockers,
        warnings: result.summary.warnings
      });
      return result;
    }
  );
  // ── Scalability Discovery (Milestone 10N) ─────────────────────────────

  app.post<{ Body: ScalabilityDiscoveryRequest }>(
    "/account/policy/scalability/evaluate",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) return;

      const result = evaluateScalabilityDiscovery(
        request.body ?? {},
        resolveScalabilityThresholds(resolvePlan(auth.user.id), lookupOverlay(auth.user.id))
      );
      deps.safeLogInfo("Scalability discovery evaluation completed", {
        user_id: auth.user.id,
        status: result.status,
        risk_score: result.risk_score,
        discovery_complete: result.discovery_complete,
        findings_count: result.summary.findings_count,
        categories: result.summary.categories_affected
      });
      return result;
    }
  );

  app.get("/account/policy/scalability/questions", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) return;

    return {
      ok: true,
      questions: getDiscoveryQuestions(),
      evaluated_at: new Date().toISOString()
    };
  });
  // ── Policy Vault (Milestone 10E) ────────────────────────────────────────
  registerPolicyVaultRoutes(app, {
    requireAuth: deps.requireAuth,
    store: deps.store,
    resolveEffectivePlan: deps.resolveEffectivePlan,
    requireAdminPermission: deps.requireAdminPermission,
    adminPermissionKeys: deps.adminPermissionKeys,
    adminRoutePrefix: deps.adminRoutePrefix,
    safeLogInfo: deps.safeLogInfo
  });

  // ── Production Checklist Engine ──────────────────────────────────────────
  registerProductionChecklistRoutes(app, {
    requireAuth: deps.requireAuth,
    store: deps.store,
    resolveEffectivePlan: deps.resolveEffectivePlan,
    requireAdminPermission: deps.requireAdminPermission,
    adminPermissionKeys: deps.adminPermissionKeys,
    adminRoutePrefix: deps.adminRoutePrefix,
    safeLogInfo: deps.safeLogInfo
  });
  // ── AGENTS Policy Profile ────────────────────────────────────────────────────────────────
  registerAgentsProfileRoutes(app, {
    requireAuth: deps.requireAuth,
    store: deps.store,
    resolveEffectivePlan: deps.resolveEffectivePlan,
    requireAdminPermission: deps.requireAdminPermission,
    adminPermissionKeys: deps.adminPermissionKeys,
    adminRoutePrefix: deps.adminRoutePrefix,
    safeLogInfo: deps.safeLogInfo
  });

  // ── Tech Debt Counter ($) ─────────────────────────────────────────────────────────────
  registerTechDebtRoutes(app, {
    requireAuth: deps.requireAuth,
    store: deps.store,
    resolveEffectivePlan: deps.resolveEffectivePlan,
    requireAdminPermission: deps.requireAdminPermission,
    adminPermissionKeys: deps.adminPermissionKeys,
    adminRoutePrefix: deps.adminRoutePrefix,
    safeLogInfo: deps.safeLogInfo
  });
}
