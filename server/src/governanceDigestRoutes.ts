/**
 * Governance Digest Routes
 * Milestone 11 – Enterprise reviewer digest and governance dashboard.
 *
 * Provides:
 *   GET  /account/governance/digest           – scoped reviewer digest (auth-gated)
 *   GET  /account/governance/digest/activity   – scoped activity summary (auth-gated)
 *   GET  {admin}/board/governance/digest       – cross-scope admin weekly digest
 *   GET  {admin}/board/governance/activity     – cross-scope admin activity summary
 */

import { FastifyInstance } from "fastify";
import {
  buildReviewerDigest,
  buildWeeklyActivitySummary,
  parsePeriodParams,
  GovernanceDigestDeps,
} from "./governanceDigestHelpers";
import { StoreState, PlanTier } from "./types";

// ── Deps contract ─────────────────────────────────────────────────────────

type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

export interface RegisterGovernanceDigestRoutesDeps {
  requireAuth: (
    request: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply
  ) => { user: StoreState["users"][number] } | undefined;
  store: { snapshot: () => StoreState };
  resolveGovernanceContextForUser: (
    snapshot: StoreState,
    userId: string,
    teamKey: string | undefined,
    requireManage: boolean
  ) =>
    | {
        scopeType: "user" | "team";
        scopeId: string;
        plan: PlanTier;
        canManage: boolean;
        team: StoreState["teams"][number] | null;
      }
    | undefined;
  canAccessGovernanceThread: (
    state: StoreState,
    thread: StoreState["mastermind_threads"][number],
    userId: string
  ) => boolean;
  hasActiveTeamSeat: (
    state: StoreState,
    teamId: string,
    userId: string
  ) => boolean;
  requireAdminPermission: (
    request: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply,
    permissionKey: string
  ) => Promise<AdminAccessContext | undefined>;
  adminPermissionKeys: { BOARD_READ: string };
  adminRoutePrefix: string;
  clampInt: (value: number, min: number, max: number) => number;
}

// ── Route registration ────────────────────────────────────────────────────

export function registerGovernanceDigestRoutes(
  app: FastifyInstance,
  deps: RegisterGovernanceDigestRoutesDeps
): void {
  const {
    requireAuth,
    store,
    resolveGovernanceContextForUser,
    canAccessGovernanceThread,
    hasActiveTeamSeat,
    requireAdminPermission,
    adminPermissionKeys,
    adminRoutePrefix,
    clampInt,
  } = deps;

  const digestDeps: GovernanceDigestDeps = {
    canAccessGovernanceThread,
    hasActiveTeamSeat,
  };

  // ── Scoped reviewer digest ──
  app.get<{
    Querystring: { team_key?: string; from?: string; to?: string };
  }>("/account/governance/digest", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return;

    const teamKey = request.query?.team_key?.trim().toUpperCase() || undefined;
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(
      snapshot, auth.user.id, teamKey, false
    );
    if (!context) {
      return reply.code(403).send({
        error: "governance access is required (team/enterprise plan, or pro when enabled)",
      });
    }

    const period = parsePeriodParams(
      request.query?.from, request.query?.to
    );
    const digest = buildReviewerDigest(
      digestDeps, snapshot,
      context.scopeType, context.scopeId,
      context.team?.team_key ?? null,
      period
    );
    return { ok: true, ...digest };
  });

  // ── Scoped activity summary (lighter) ──
  app.get<{
    Querystring: { team_key?: string; from?: string; to?: string };
  }>("/account/governance/digest/activity", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return;

    const teamKey = request.query?.team_key?.trim().toUpperCase() || undefined;
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(
      snapshot, auth.user.id, teamKey, false
    );
    if (!context) {
      return reply.code(403).send({
        error: "governance access is required",
      });
    }

    const period = parsePeriodParams(
      request.query?.from, request.query?.to
    );
    const summary = buildWeeklyActivitySummary(snapshot, period);
    return { ok: true, scope_type: context.scopeType, scope_id: context.scopeId, ...summary };
  });

  // ── Admin cross-scope digest ──
  app.get<{
    Querystring: { from?: string; to?: string };
  }>(`${adminRoutePrefix}/board/governance/digest`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request, reply, adminPermissionKeys.BOARD_READ
    );
    if (!adminAccess) return;

    const snapshot = store.snapshot();
    const period = parsePeriodParams(
      request.query?.from, request.query?.to
    );
    const summary = buildWeeklyActivitySummary(snapshot, period);

    // Also build per-team digests for teams with governance scopes
    const teamDigests = snapshot.governance_settings
      .filter((s) => s.scope_type === "team")
      .slice(0, 50)
      .map((s) => {
        const team = snapshot.teams.find((t) => t.id === s.scope_id);
        return buildReviewerDigest(
          digestDeps, snapshot, "team", s.scope_id,
          team?.team_key ?? null, period
        );
      });

    return {
      ok: true,
      activity: summary,
      team_digests: teamDigests,
    };
  });

  // ── Admin activity summary ──
  app.get<{
    Querystring: { from?: string; to?: string };
  }>(`${adminRoutePrefix}/board/governance/activity`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request, reply, adminPermissionKeys.BOARD_READ
    );
    if (!adminAccess) return;

    const snapshot = store.snapshot();
    const period = parsePeriodParams(
      request.query?.from, request.query?.to
    );
    const summary = buildWeeklyActivitySummary(snapshot, period);
    return { ok: true, ...summary };
  });
}
