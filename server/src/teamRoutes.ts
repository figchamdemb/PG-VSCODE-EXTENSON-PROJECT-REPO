import { randomBytes, randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { StateStore } from "./store";
import {
  buildTeamStatusPayload,
  canManageTeamRole,
  resolveTeamAccessForUser
} from "./teamHelpers";
import { EntitlementClaimPayload, normalizePolicyInput } from "./entitlementHelpers";
import { normalizeEmail, toErrorMessage } from "./serverUtils";
import { ModuleScope, UserRecord } from "./types";

export interface RegisterTeamRoutesDeps {
  store: StateStore;
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => { user: UserRecord } | undefined;
  getOrCreateUserByEmail: (email: string) => Promise<UserRecord>;
  grantSubscriptionByUserId: (input: {
    userId: string;
    planId: "team" | "enterprise";
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

export function registerTeamRoutes(
  app: FastifyInstance,
  deps: RegisterTeamRoutesDeps
): void {
  app.post<{
    Body: {
      team_key?: string;
      plan_id?: "team" | "enterprise";
      module_scope?: ModuleScope;
      seat_limit?: number;
      years?: number;
    };
  }>("/account/team/create", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const planId = request.body?.plan_id ?? "team";
    const moduleScope = request.body?.module_scope ?? "bundle";
    const seatLimit = Math.max(1, Math.floor(request.body?.seat_limit ?? 5));
    const years =
      request.body?.years && request.body.years > 0 ? request.body.years : 1;
    const requestedTeamKey = request.body?.team_key?.trim().toUpperCase();
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
          owner_user_id: auth.user.id,
          plan_id: planId,
          module_scope: moduleScope,
          seat_limit: seatLimit,
          created_at: new Date().toISOString()
        });
        state.team_memberships.push({
          id: randomUUID(),
          team_id: teamId,
          user_id: auth.user.id,
          role: "owner",
          status: "active",
          invited_email: auth.user.email,
          created_at: new Date().toISOString(),
          revoked_at: null
        });
      });
    } catch (error) {
      return reply.code(409).send({ error: toErrorMessage(error) });
    }

    const grant = await deps.grantSubscriptionByUserId({
      userId: auth.user.id,
      planId,
      moduleScope,
      years,
      source: "manual",
      teamId
    });

    return {
      ok: true,
      team_key: teamKey,
      owner_email: auth.user.email,
      seat_limit: seatLimit,
      plan_id: planId,
      module_scope: moduleScope,
      ends_at: grant.endsAt
    };
  });

  app.get<{
    Querystring: { team_key?: string };
  }>("/account/team/status", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const teamKey = request.query?.team_key?.trim().toUpperCase();
    const snapshot = deps.store.snapshot();
    const access = resolveTeamAccessForUser(
      snapshot,
      auth.user.id,
      teamKey,
      false
    );
    if (!access) {
      return reply
        .code(404)
        .send({ error: "team not found for this account" });
    }

    return {
      ok: true,
      membership_role: access.membership.role,
      can_manage: canManageTeamRole(access.membership.role),
      ...buildTeamStatusPayload(snapshot, access.team)
    };
  });

  app.post<{
    Body: {
      team_key?: string;
      email?: string;
      role?: "manager" | "member";
      years?: number;
    };
  }>("/account/team/assign-seat", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const teamKey = request.body?.team_key?.trim().toUpperCase();
    const email = normalizeEmail(request.body?.email);
    const role = request.body?.role ?? "member";
    const years =
      request.body?.years && request.body.years > 0 ? request.body.years : 1;
    if (!email) {
      return reply.code(400).send({ error: "email is required" });
    }

    const snapshot = deps.store.snapshot();
    const access = resolveTeamAccessForUser(
      snapshot,
      auth.user.id,
      teamKey,
      true
    );
    if (!access) {
      return reply
        .code(403)
        .send({ error: "you do not have team management access" });
    }

    const team = access.team;
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
      team_key: team.team_key,
      email,
      role,
      ends_at: grant.endsAt
    };
  });

  app.post<{
    Body: { team_key?: string; email?: string };
  }>("/account/team/revoke-seat", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const teamKey = request.body?.team_key?.trim().toUpperCase();
    const email = normalizeEmail(request.body?.email);
    if (!email) {
      return reply.code(400).send({ error: "email is required" });
    }

    const snapshot = deps.store.snapshot();
    const access = resolveTeamAccessForUser(
      snapshot,
      auth.user.id,
      teamKey,
      true
    );
    if (!access) {
      return reply
        .code(403)
        .send({ error: "you do not have team management access" });
    }
    const user = snapshot.users.find((item) => item.email === email);
    if (!user) {
      return reply.code(404).send({ error: "user not found" });
    }

    try {
      await deps.store.update((state) => {
        const membership = state.team_memberships.find(
          (item) =>
            item.team_id === access.team.id &&
            item.user_id === user.id &&
            item.status === "active"
        );
        if (!membership) {
          throw new Error("active membership not found");
        }
        if (membership.role === "owner") {
          throw new Error(
            "owner seat cannot be revoked via self-service"
          );
        }

        membership.status = "revoked";
        membership.revoked_at = new Date().toISOString();

        for (const sub of state.subscriptions) {
          if (
            sub.user_id === user.id &&
            sub.team_id === access.team.id &&
            sub.status === "active"
          ) {
            sub.status = "revoked";
            sub.revoked_at = new Date().toISOString();
          }
        }
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    return { ok: true, team_key: access.team.team_key, email };
  });

  app.post<{
    Body: {
      team_key?: string;
      local_only?: boolean;
      byo_allowed?: boolean;
      allowlist?: string[];
      denylist?: string[];
    };
  }>("/account/team/provider-policy/set", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const teamKey = request.body?.team_key?.trim().toUpperCase();
    const snapshot = deps.store.snapshot();
    const access = resolveTeamAccessForUser(
      snapshot,
      auth.user.id,
      teamKey,
      true
    );
    if (!access) {
      return reply
        .code(403)
        .send({ error: "you do not have team management access" });
    }

    const policy = normalizePolicyInput(request.body);
    await deps.upsertProviderPolicy("team", access.team.id, policy);
    return { ok: true, team_key: access.team.team_key, policy };
  });
}
