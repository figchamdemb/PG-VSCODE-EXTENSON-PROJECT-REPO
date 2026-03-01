/**
 * Tech Debt Routes
 * API endpoints for the Tech Debt Counter ($) feature.
 *
 * Routes:
 *  POST /account/policy/tech-debt/evaluate    – user cost evaluation
 *  GET  /account/policy/tech-debt/model       – current cost model info
 *  POST {admin}/board/policy/tech-debt/evaluate – admin cross-scope eval
 *
 * Registered as a sub-route in policyRoutes.ts.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PlanTier, StoreState } from "./types";
import {
  evaluateTechDebt,
  TechDebtRequest
} from "./techDebtEvaluator";

// ── Deps ────────────────────────────────────────────────────────────────

type AuthResult = { user: { id: string } };
type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

export interface RegisterTechDebtRoutesDeps {
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

// ── Module-level constants ──────────────────────────────────────────────

const TECH_DEBT_RATE_MULTIPLIER: Record<string, number> = { free: 1.0, trial: 1.0, pro: 1.0, team: 0.95, enterprise: 0.9 };
const TECH_DEBT_HOURS_BY_SEVERITY = { critical: 8, warning: 3, info: 0.5 };
const TECH_DEBT_BASE_RATE = 85;
const TECH_DEBT_DESCRIPTION = "Tech debt cost model maps rule findings to estimated remediation hours, then multiplied by the effective hourly rate for the current plan tier.";

// ── Route registration ──────────────────────────────────────────────────

export function registerTechDebtRoutes(
  app: FastifyInstance,
  deps: RegisterTechDebtRoutesDeps
): void {
  // ── User tech debt evaluation ─────────────────────────────────────────

  app.post<{ Body: TechDebtRequest }>(
    "/account/policy/tech-debt/evaluate",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) return;

      const state = deps.store.snapshot();
      const { plan } = deps.resolveEffectivePlan(state, auth.user.id, new Date());

      const result = evaluateTechDebt(request.body ?? { findings: [] }, plan);

      deps.safeLogInfo("Tech debt evaluated", {
        user_id: auth.user.id, plan, status: result.status, total_findings: result.total_findings,
        total_cost: result.total_estimated_cost, currency: result.currency, domains: result.domains.length
      });

      return result;
    }
  );

  // ── Cost model info ───────────────────────────────────────────────────

  app.get(
    "/account/policy/tech-debt/model",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) return;

      const state = deps.store.snapshot();
      const { plan } = deps.resolveEffectivePlan(state, auth.user.id, new Date());

      const effectiveRate = TECH_DEBT_BASE_RATE * (TECH_DEBT_RATE_MULTIPLIER[plan] ?? 1.0);
      return {
        ok: true, plan, base_hourly_rate: TECH_DEBT_BASE_RATE,
        effective_hourly_rate: effectiveRate, currency: "USD",
        hours_by_severity: TECH_DEBT_HOURS_BY_SEVERITY,
        description: TECH_DEBT_DESCRIPTION
      };
    }
  );

  // ── Admin cross-scope tech debt evaluation ────────────────────────────

  app.post<{ Body: TechDebtRequest & { target_user_id?: string } }>(
    `${deps.adminRoutePrefix}/board/policy/tech-debt/evaluate`,
    async (request, reply) => {
      const admin = await deps.requireAdminPermission(request, reply, deps.adminPermissionKeys.BOARD_READ);
      if (!admin) return;

      const state = deps.store.snapshot();
      const targetUserId = request.body?.target_user_id ?? "";
      const { plan } = targetUserId ? deps.resolveEffectivePlan(state, targetUserId, new Date()) : { plan: "enterprise" as PlanTier };
      const result = evaluateTechDebt(request.body ?? { findings: [] }, plan);

      deps.safeLogInfo("Admin tech debt evaluated", {
        admin_email: admin.userEmail, target_user_id: targetUserId || "default-enterprise",
        status: result.status, total_cost: result.total_estimated_cost, domains: result.domains.length
      });

      return result;
    }
  );
}
