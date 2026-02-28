import { FastifyInstance } from "fastify";
import { buildAdminBoardSummaryResponse as buildAdminBoardSummaryResponseSupport } from "./accountSummarySupport";
import { RegisterGovernanceRoutesDeps } from "./governanceRoutes.shared";

export function registerGovernanceAdminBoardRoutes(
  app: FastifyInstance,
  deps: RegisterGovernanceRoutesDeps
): void {
  const {
    requireAdminPermission,
    adminPermissionKeys,
    store,
    setGovernanceSlackAddonState,
    pruneGovernanceState,
    toErrorMessage,
    normalizeEmail,
    adminRoutePrefix,
    getSuperAdminEmailSet,
    resolveEffectivePlan
  } = deps;

  app.post<{
    Body: { team_key?: string; active?: boolean };
  }>(`${adminRoutePrefix}/governance/slack-addon/team`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      adminPermissionKeys.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase();
    if (!teamKey) {
      return reply.code(400).send({ error: "team_key is required" });
    }
    const snapshot = store.snapshot();
    const team = snapshot.teams.find((item) => item.team_key === teamKey);
    if (!team) {
      return reply.code(404).send({ error: "team not found" });
    }
    let slackAddonActive = false;
    let settings: unknown = null;
    try {
      await store.update((state) => {
        const updated = setGovernanceSlackAddonState(
          state,
          "team",
          team.id,
          request.body?.active === true
        );
        slackAddonActive = updated.slack_addon_active;
        settings = updated;
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }
    return {
      ok: true,
      team_key: teamKey,
      slack_addon_active: slackAddonActive,
      settings
    };
  });

  app.post<{
    Body: { email?: string; active?: boolean };
  }>(`${adminRoutePrefix}/governance/slack-addon/user`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      adminPermissionKeys.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const email = normalizeEmail(request.body?.email);
    if (!email) {
      return reply.code(400).send({ error: "email is required" });
    }
    const snapshot = store.snapshot();
    const user = snapshot.users.find((item) => item.email === email);
    if (!user) {
      return reply.code(404).send({ error: "user not found" });
    }
    let slackAddonActive = false;
    let settings: unknown = null;
    try {
      await store.update((state) => {
        const updated = setGovernanceSlackAddonState(
          state,
          "user",
          user.id,
          request.body?.active === true
        );
        slackAddonActive = updated.slack_addon_active;
        settings = updated;
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }
    return {
      ok: true,
      email,
      slack_addon_active: slackAddonActive,
      settings
    };
  });

  app.get(`${adminRoutePrefix}/board/governance`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      adminPermissionKeys.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }
    const snapshot = store.snapshot();
    const nowMs = Date.now();
    const openThreads = snapshot.mastermind_threads.filter(
      (item) => item.status === "open" && new Date(item.expires_at).getTime() > nowMs
    );
    const decidedThreads = snapshot.mastermind_threads.filter((item) => item.status === "decided");
    const activeSlackScopes = snapshot.governance_settings.filter(
      (item) => item.slack_addon_active && item.slack_enabled
    );
    return {
      ok: true,
      totals: {
        eod_reports: snapshot.governance_eod_reports.length,
        mastermind_open: openThreads.length,
        mastermind_decided: decidedThreads.length,
        governance_scopes_with_slack_enabled: activeSlackScopes.length,
        decision_events_pending_ack: snapshot.governance_decision_acks.filter(
          (item) => item.status === "pending"
        ).length
      }
    };
  });

  app.get(`${adminRoutePrefix}/board/summary`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      adminPermissionKeys.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }
    return buildAdminBoardSummaryResponseSupport(
      store.snapshot(),
      new Date(),
      adminAccess,
      resolveEffectivePlan
    );
  });

  app.get<{
    Querystring: { q?: string; limit?: number };
  }>(`${adminRoutePrefix}/board/users`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      adminPermissionKeys.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }

    const query = request.query?.q?.trim().toLowerCase() ?? "";
    const limit = Math.max(1, Math.min(500, Number(request.query?.limit ?? 100)));
    const snapshot = store.snapshot();
    const now = new Date();
    const superAdminEmails = await getSuperAdminEmailSet();
    const users = [...snapshot.users]
      .filter((user) => !query || user.email.includes(query) || user.id.includes(query))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((user) => {
        const planState = resolveEffectivePlan(snapshot, user.id, now);
        const latestSubscription = [...snapshot.subscriptions]
          .filter((item) => item.user_id === user.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_login_at: user.last_login_at,
          current_plan: planState.plan,
          is_super_admin: superAdminEmails.has(user.email),
          latest_subscription: latestSubscription
            ? {
                id: latestSubscription.id,
                plan_id: latestSubscription.plan_id,
                status: latestSubscription.status,
                source: latestSubscription.source,
                ends_at: latestSubscription.ends_at
              }
            : null
        };
      });

    return { ok: true, users };
  });

  app.get<{
    Querystring: { status?: "active" | "expired" | "revoked" | "refunded"; limit?: number };
  }>(`${adminRoutePrefix}/board/subscriptions`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      adminPermissionKeys.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }

    const statusFilter = request.query?.status;
    const limit = Math.max(1, Math.min(500, Number(request.query?.limit ?? 200)));
    const snapshot = store.snapshot();
    const subscriptions = [...snapshot.subscriptions]
      .filter((item) => !statusFilter || item.status === statusFilter)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((item) => ({
        ...item,
        email: snapshot.users.find((user) => user.id === item.user_id)?.email ?? null
      }));
    return { ok: true, subscriptions };
  });

  app.get<{
    Querystring: { status?: "open" | "in_progress" | "resolved" | "closed"; limit?: number };
  }>(`${adminRoutePrefix}/board/support`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      adminPermissionKeys.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }

    const statusFilter = request.query?.status;
    const limit = Math.max(1, Math.min(500, Number(request.query?.limit ?? 200)));
    const snapshot = store.snapshot();
    const tickets = [...snapshot.support_tickets]
      .filter((item) => !statusFilter || item.status === statusFilter)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
    return { ok: true, tickets };
  });

  app.get(`${adminRoutePrefix}/board/payments`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      adminPermissionKeys.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }

    const snapshot = store.snapshot();
    const offline = [...snapshot.offline_payment_refs].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
    const refunds = [...snapshot.refund_requests]
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at))
      .map((refund) => ({
        ...refund,
        email: snapshot.users.find((user) => user.id === refund.user_id)?.email ?? null
      }));
    return { ok: true, offline_references: offline, refund_requests: refunds };
  });

  app.post<{
    Body: {
      ticket_id?: string;
      status?: "open" | "in_progress" | "resolved" | "closed";
      resolution_note?: string;
    };
  }>(`${adminRoutePrefix}/board/support/status`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      adminPermissionKeys.BOARD_SUPPORT_WRITE
    );
    if (!adminAccess) {
      return;
    }
    const ticketId = request.body?.ticket_id?.trim();
    const status = request.body?.status;
    const resolutionNote = request.body?.resolution_note?.trim() || null;
    if (!ticketId || !status) {
      return reply.code(400).send({ error: "ticket_id and status are required" });
    }

    try {
      await store.update((state) => {
        const ticket = state.support_tickets.find((item) => item.id === ticketId);
        if (!ticket) {
          throw new Error("support ticket not found");
        }
        ticket.status = status;
        ticket.updated_at = new Date().toISOString();
        ticket.resolution_note = resolutionNote;
      });
    } catch (error) {
      return reply.code(404).send({ error: toErrorMessage(error) });
    }

    return { ok: true, ticket_id: ticketId, status };
  });

  app.post<{
    Body: { subscription_id?: string };
  }>(`${adminRoutePrefix}/board/subscription/revoke`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      adminPermissionKeys.BOARD_SUBSCRIPTION_WRITE
    );
    if (!adminAccess) {
      return;
    }
    const subscriptionId = request.body?.subscription_id?.trim();
    if (!subscriptionId) {
      return reply.code(400).send({ error: "subscription_id is required" });
    }

    try {
      await store.update((state) => {
        const subscription = state.subscriptions.find((item) => item.id === subscriptionId);
        if (!subscription) {
          throw new Error("subscription not found");
        }
        if (subscription.status !== "active") {
          throw new Error("subscription is not active");
        }
        subscription.status = "revoked";
        subscription.revoked_at = new Date().toISOString();

        const entitlement = state.product_entitlements.find(
          (item) => item.user_id === subscription.user_id && item.status === "active"
        );
        if (entitlement) {
          entitlement.status = "revoked";
          entitlement.ends_at = new Date().toISOString();
        }
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    return { ok: true, subscription_id: subscriptionId };
  });

  app.post<{
    Body: { user_id?: string };
  }>(`${adminRoutePrefix}/board/sessions/revoke-user`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      adminPermissionKeys.BOARD_SESSION_REVOKE
    );
    if (!adminAccess) {
      return;
    }
    const userId = request.body?.user_id?.trim();
    if (!userId) {
      return reply.code(400).send({ error: "user_id is required" });
    }

    let revokedCount = 0;
    await store.update((state) => {
      const nowIso = new Date().toISOString();
      for (const session of state.sessions) {
        if (session.user_id === userId) {
          session.expires_at = nowIso;
          revokedCount += 1;
        }
      }
    });

    return { ok: true, user_id: userId, sessions_revoked: revokedCount };
  });
}
