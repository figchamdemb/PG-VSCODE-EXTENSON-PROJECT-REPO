import { randomBytes, randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AdminPermissionKeys } from "./adminRbacBootstrap";
import { StateStore } from "./store";
import { EntitlementClaimPayload, normalizePolicyInput } from "./entitlementHelpers";
import { normalizeEmail, toErrorMessage } from "./serverUtils";
import { ModuleScope, PaidPlanTier, UserRecord } from "./types";

type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

export interface RegisterAdminRoutesDeps {
  store: StateStore;
  requireAdminPermission: (
    request: FastifyRequest,
    reply: FastifyReply,
    permissionKey: string
  ) => Promise<AdminAccessContext | undefined>;
  adminPermissionKeys: AdminPermissionKeys;
  adminRoutePrefix: string;
  getOrCreateUserByEmail: (email: string) => Promise<UserRecord>;
  grantSubscriptionByEmail: (input: {
    email: string;
    planId: PaidPlanTier;
    moduleScope: ModuleScope;
    years: number;
    source: "stripe" | "offline" | "manual";
    teamId?: string | null;
  }) => Promise<{ userId: string; endsAt: string }>;
  grantSubscriptionByUserId: (input: {
    userId: string;
    planId: PaidPlanTier;
    moduleScope: ModuleScope;
    years: number;
    source: "stripe" | "offline" | "manual";
    teamId: string;
  }) => Promise<{ endsAt: string }>;
  upsertProviderPolicy: (
    scopeType: "user" | "team",
    scopeId: string,
    policy: EntitlementClaimPayload["provider_policy"]
  ) => Promise<void>;
}

export function registerAdminRoutes(
  app: FastifyInstance,
  deps: RegisterAdminRoutesDeps
): void {
  const prefix = deps.adminRoutePrefix;

  app.post<{ Body: { request_id?: string } }>(
    `${prefix}/refund/approve`,
    async (request, reply) => {
      const adminAccess = await deps.requireAdminPermission(
        request,
        reply,
        deps.adminPermissionKeys.REFUND_APPROVE
      );
      if (!adminAccess) {
        return;
      }
      const requestId = request.body?.request_id?.trim();
      if (!requestId) {
        return reply.code(400).send({ error: "request_id is required" });
      }

      await deps.store.update((state) => {
        const refund = state.refund_requests.find(
          (item) => item.id === requestId
        );
        if (!refund) {
          throw new Error("refund request not found");
        }
        if (refund.status !== "requested") {
          throw new Error("refund request is not pending");
        }

        refund.status = "approved";
        refund.approved_at = new Date().toISOString();

        const sub = state.subscriptions.find(
          (item) => item.id === refund.subscription_id
        );
        if (sub) {
          sub.status = "refunded";
          sub.revoked_at = new Date().toISOString();
        }

        const entitlement = state.product_entitlements.find(
          (item) =>
            item.user_id === refund.user_id && item.status === "active"
        );
        if (entitlement) {
          entitlement.status = "refunded";
          entitlement.ends_at = new Date().toISOString();
        }
      });

      return { ok: true };
    }
  );

  app.post<{
    Body: {
      email?: string;
      plan_id?: PaidPlanTier;
      module_scope?: ModuleScope;
      years?: number;
    };
  }>(`${prefix}/subscription/grant`, async (request, reply) => {
    const adminAccess = await deps.requireAdminPermission(
      request,
      reply,
      deps.adminPermissionKeys.SUBSCRIPTION_GRANT
    );
    if (!adminAccess) {
      return;
    }
    const email = normalizeEmail(request.body?.email);
    const planId = request.body?.plan_id;
    const moduleScope = request.body?.module_scope ?? "narrate";
    const years =
      request.body?.years && request.body.years > 0 ? request.body.years : 1;
    if (!email || !planId) {
      return reply
        .code(400)
        .send({ error: "email and plan_id are required" });
    }
    const grant = await deps.grantSubscriptionByEmail({
      email,
      planId,
      moduleScope,
      years,
      source: "manual"
    });

    return {
      ok: true,
      email,
      plan_id: planId,
      module_scope: moduleScope,
      ends_at: grant.endsAt
    };
  });

  app.post<{
    Body: {
      owner_email?: string;
      team_key?: string;
      plan_id?: "team" | "enterprise";
      module_scope?: ModuleScope;
      seat_limit?: number;
      years?: number;
    };
  }>(`${prefix}/team/create`, async (request, reply) => {
    const adminAccess = await deps.requireAdminPermission(
      request,
      reply,
      deps.adminPermissionKeys.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const ownerEmail = normalizeEmail(request.body?.owner_email);
    const planId = request.body?.plan_id ?? "team";
    const moduleScope = request.body?.module_scope ?? "bundle";
    const seatLimit = Math.max(1, request.body?.seat_limit ?? 5);
    const years =
      request.body?.years && request.body.years > 0 ? request.body.years : 1;
    const requestedTeamKey = request.body?.team_key?.trim().toUpperCase();
    if (!ownerEmail) {
      return reply.code(400).send({ error: "owner_email is required" });
    }

    const owner = await deps.getOrCreateUserByEmail(ownerEmail);
    const teamKey =
      requestedTeamKey ||
      `TEAM-${randomBytes(3).toString("hex").toUpperCase()}`;
    let teamId = "";
    try {
      await deps.store.update((state) => {
        if (state.teams.some((item) => item.team_key === teamKey)) {
          throw new Error("team_key already exists");
        }
        teamId = randomUUID();
        state.teams.push({
          id: teamId,
          team_key: teamKey,
          owner_user_id: owner.id,
          plan_id: planId,
          module_scope: moduleScope,
          seat_limit: seatLimit,
          created_at: new Date().toISOString()
        });
        state.team_memberships.push({
          id: randomUUID(),
          team_id: teamId,
          user_id: owner.id,
          role: "owner",
          status: "active",
          invited_email: owner.email,
          created_at: new Date().toISOString(),
          revoked_at: null
        });
      });
    } catch (error) {
      return reply.code(409).send({ error: toErrorMessage(error) });
    }

    const grant = await deps.grantSubscriptionByUserId({
      userId: owner.id,
      planId,
      moduleScope,
      years,
      source: "manual",
      teamId
    });

    return {
      ok: true,
      team_key: teamKey,
      owner_email: owner.email,
      seat_limit: seatLimit,
      ends_at: grant.endsAt
    };
  });

  app.post<{
    Body: {
      team_key?: string;
      email?: string;
      role?: "owner" | "manager" | "member";
      years?: number;
    };
  }>(`${prefix}/team/assign-seat`, async (request, reply) => {
    const adminAccess = await deps.requireAdminPermission(
      request,
      reply,
      deps.adminPermissionKeys.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase();
    const email = normalizeEmail(request.body?.email);
    const role = request.body?.role ?? "member";
    const years =
      request.body?.years && request.body.years > 0 ? request.body.years : 1;
    if (!teamKey || !email) {
      return reply
        .code(400)
        .send({ error: "team_key and email are required" });
    }

    const snapshot = deps.store.snapshot();
    const team = snapshot.teams.find((item) => item.team_key === teamKey);
    if (!team) {
      return reply.code(404).send({ error: "team not found" });
    }

    const user = await deps.getOrCreateUserByEmail(email);
    const activeSeats = snapshot.team_memberships.filter(
      (item) => item.team_id === team.id && item.status === "active"
    ).length;
    const existingActive = snapshot.team_memberships.find(
      (item) =>
        item.team_id === team.id &&
        item.user_id === user.id &&
        item.status === "active"
    );
    if (!existingActive && activeSeats >= team.seat_limit) {
      return reply.code(403).send({ error: "team seat limit reached" });
    }

    await deps.store.update((state) => {
      const membership = state.team_memberships.find(
        (item) => item.team_id === team.id && item.user_id === user.id
      );
      if (membership) {
        membership.status = "active";
        membership.revoked_at = null;
        membership.role = role;
        membership.invited_email = email;
      } else {
        state.team_memberships.push({
          id: randomUUID(),
          team_id: team.id,
          user_id: user.id,
          role,
          status: "active",
          invited_email: email,
          created_at: new Date().toISOString(),
          revoked_at: null
        });
      }
    });

    const grant = await deps.grantSubscriptionByUserId({
      userId: user.id,
      planId: team.plan_id,
      moduleScope: team.module_scope,
      years,
      source: "manual",
      teamId: team.id
    });

    return {
      ok: true,
      team_key: teamKey,
      email,
      ends_at: grant.endsAt
    };
  });

  app.post<{
    Body: { team_key?: string; email?: string };
  }>(`${prefix}/team/revoke-seat`, async (request, reply) => {
    const adminAccess = await deps.requireAdminPermission(
      request,
      reply,
      deps.adminPermissionKeys.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase();
    const email = normalizeEmail(request.body?.email);
    if (!teamKey || !email) {
      return reply
        .code(400)
        .send({ error: "team_key and email are required" });
    }

    const snapshot = deps.store.snapshot();
    const team = snapshot.teams.find((item) => item.team_key === teamKey);
    const user = snapshot.users.find((item) => item.email === email);
    if (!team || !user) {
      return reply.code(404).send({ error: "team or user not found" });
    }

    await deps.store.update((state) => {
      const membership = state.team_memberships.find(
        (item) =>
          item.team_id === team.id &&
          item.user_id === user.id &&
          item.status === "active"
      );
      if (!membership) {
        throw new Error("active membership not found");
      }
      membership.status = "revoked";
      membership.revoked_at = new Date().toISOString();

      for (const sub of state.subscriptions) {
        if (
          sub.user_id === user.id &&
          sub.team_id === team.id &&
          sub.status === "active"
        ) {
          sub.status = "revoked";
          sub.revoked_at = new Date().toISOString();
        }
      }
    });

    return { ok: true, team_key: teamKey, email };
  });

  app.get<{
    Querystring: { team_key?: string };
  }>(`${prefix}/team/status`, async (request, reply) => {
    const adminAccess = await deps.requireAdminPermission(
      request,
      reply,
      deps.adminPermissionKeys.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const teamKey = request.query?.team_key?.trim().toUpperCase();
    if (!teamKey) {
      return reply.code(400).send({ error: "team_key is required" });
    }

    const snapshot = deps.store.snapshot();
    const team = snapshot.teams.find((item) => item.team_key === teamKey);
    if (!team) {
      return reply.code(404).send({ error: "team not found" });
    }
    const members = snapshot.team_memberships
      .filter((item) => item.team_id === team.id)
      .map((item) => ({
        ...item,
        email:
          snapshot.users.find((user) => user.id === item.user_id)?.email ??
          item.invited_email
      }));
    const activeSeats = members.filter(
      (item) => item.status === "active"
    ).length;

    return {
      ok: true,
      team,
      seats: {
        used: activeSeats,
        limit: team.seat_limit,
        remaining: Math.max(0, team.seat_limit - activeSeats)
      },
      members
    };
  });

  app.post<{
    Body: {
      team_key?: string;
      local_only?: boolean;
      byo_allowed?: boolean;
      allowlist?: string[];
      denylist?: string[];
    };
  }>(`${prefix}/team/provider-policy/set`, async (request, reply) => {
    const adminAccess = await deps.requireAdminPermission(
      request,
      reply,
      deps.adminPermissionKeys.PROVIDER_POLICY_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase();
    if (!teamKey) {
      return reply.code(400).send({ error: "team_key is required" });
    }

    const snapshot = deps.store.snapshot();
    const team = snapshot.teams.find((item) => item.team_key === teamKey);
    if (!team) {
      return reply.code(404).send({ error: "team not found" });
    }

    const policy = normalizePolicyInput(request.body);
    await deps.upsertProviderPolicy("team", team.id, policy);
    return { ok: true, team_key: teamKey, policy };
  });

  app.post<{
    Body: {
      email?: string;
      local_only?: boolean;
      byo_allowed?: boolean;
      allowlist?: string[];
      denylist?: string[];
    };
  }>(`${prefix}/provider-policy/set-user`, async (request, reply) => {
    const adminAccess = await deps.requireAdminPermission(
      request,
      reply,
      deps.adminPermissionKeys.PROVIDER_POLICY_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const email = normalizeEmail(request.body?.email);
    if (!email) {
      return reply.code(400).send({ error: "email is required" });
    }
    const snapshot = deps.store.snapshot();
    const user = snapshot.users.find((item) => item.email === email);
    if (!user) {
      return reply.code(404).send({ error: "user not found" });
    }

    const policy = normalizePolicyInput(request.body);
    await deps.upsertProviderPolicy("user", user.id, policy);
    return { ok: true, email, policy };
  });
}
