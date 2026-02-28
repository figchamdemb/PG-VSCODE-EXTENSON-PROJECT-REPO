import { randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { StateStore } from "./store";
import {
  buildEntitlementClaims,
  ensureDeviceRecord,
  ensureQuotaRecord,
  EntitlementClaimPayload,
  resolveEffectivePlan,
  signEntitlementToken
} from "./entitlementHelpers";
import {
  normalizeSupportCategory,
  normalizeSupportSeverity
} from "./teamHelpers";
import {
  addHours,
  getBearerToken,
  toErrorMessage
} from "./serverUtils";
import { PLAN_RULES } from "./rules";
import {
  buildAccountSummaryResponseForUser as buildAccountSummaryResponseForUserSupport,
  resolveAccountSummaryAdminSnapshot as resolveAccountSummaryAdminSnapshotSupport
} from "./accountSummaryOrchestration";
import { canManageTeamRole } from "./teamHelpers";
import { PlanTier, ProjectQuotaRecord, UserRecord } from "./types";

type AdminAccessContext = {
  isSuperAdmin: boolean;
  permissions: Set<string>;
};

export interface RegisterAccountRoutesDeps {
  store: StateStore;
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => { user: UserRecord } | undefined;
  issueEntitlement: (
    request: FastifyRequest<{ Body: { install_id?: string; device_label?: string } }>,
    reply: FastifyReply,
    action: "activate" | "refresh"
  ) => Promise<void | object>;
  trialDurationHours: number;
  sessionTtlHours: number;
  supportsGovernancePlan: (plan: PlanTier) => boolean;
  getSuperAdminEmailSet: () => Promise<Set<string>>;
  resolveAdminAccessFromDb: (
    email: string
  ) => Promise<AdminAccessContext | null>;
  governanceSeatPriceCents: number;
  adminRoutePrefix: string;
  cloudflareAccessEnabled: boolean;
  boardReadPermission: string;
  safeLogWarn: (message: string, context: Record<string, unknown>) => void;
  toErrorMessage: (error: unknown) => string;
}

export function registerAccountRoutes(
  app: FastifyInstance,
  deps: RegisterAccountRoutesDeps
): void {
  app.post("/trial/start", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const snapshot = deps.store.snapshot();
    const existing = snapshot.trials.find(
      (item) => item.user_id === auth.user.id
    );
    if (existing) {
      return reply.code(409).send({
        error: "trial already claimed for this account",
        trial_expires_at: existing.trial_expires_at
      });
    }

    const now = new Date();
    const trialExpires = addHours(now, deps.trialDurationHours).toISOString();
    await deps.store.update((state) => {
      state.trials.push({
        user_id: auth.user.id,
        trial_started_at: now.toISOString(),
        trial_expires_at: trialExpires
      });
    });

    return { trial_expires_at: trialExpires };
  });

  app.post<{
    Body: { install_id?: string; device_label?: string };
  }>("/entitlement/activate", async (request, reply) => {
    return deps.issueEntitlement(request, reply, "activate");
  });

  app.post<{
    Body: { install_id?: string; device_label?: string };
  }>("/entitlement/refresh", async (request, reply) => {
    return deps.issueEntitlement(request, reply, "refresh");
  });

  app.get("/entitlement/status", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const snapshot = deps.store.snapshot();
    const activeDevice = snapshot.devices.find(
      (item) =>
        item.user_id === auth.user.id && item.revoked_at === null
    );
    const installId = activeDevice?.install_id ?? "status-view";
    const claims = buildEntitlementClaims(
      snapshot,
      auth.user.id,
      installId
    );
    const token = signEntitlementToken(snapshot, claims);
    return {
      entitlement_token: token,
      expires_at: new Date(claims.exp * 1000).toISOString(),
      claims
    };
  });

  app.post("/devices/list", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const snapshot = deps.store.snapshot();
    const devices = snapshot.devices.filter(
      (item) => item.user_id === auth.user.id
    );
    return { devices };
  });

  app.post<{ Body: { device_id?: string } }>(
    "/devices/revoke",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }
      const deviceId = request.body?.device_id?.trim();
      if (!deviceId) {
        return reply.code(400).send({ error: "device_id is required" });
      }
      await deps.store.update((state) => {
        const device = state.devices.find(
          (item) =>
            item.user_id === auth.user.id && item.id === deviceId
        );
        if (!device) {
          throw new Error("device not found");
        }
        device.revoked_at = new Date().toISOString();
        device.last_seen_at = new Date().toISOString();
      });
      return { ok: true };
    }
  );

  app.post<{
    Body: {
      scope?: "memorybank";
      repo_fingerprint?: string;
      repo_label?: string;
    };
  }>("/projects/activate", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const scope = request.body?.scope;
    const repoFingerprint = request.body?.repo_fingerprint?.trim();
    const repoLabel = request.body?.repo_label?.trim() ?? null;
    if (scope !== "memorybank" || !repoFingerprint) {
      return reply.code(400).send({
        error: "scope=memorybank and repo_fingerprint are required"
      });
    }

    const snapshot = deps.store.snapshot();
    const claimTemplate = buildEntitlementClaims(
      snapshot,
      auth.user.id,
      "project-activation"
    );
    if (!claimTemplate.features.memorybank) {
      return reply
        .code(403)
        .send({ error: "memorybank entitlement is not enabled" });
    }

    let idempotent = false;
    let quotaAfter: ProjectQuotaRecord | undefined;
    await deps.store.update((state) => {
      const existing = state.project_activations.find(
        (item) =>
          item.user_id === auth.user.id &&
          item.scope === "memorybank" &&
          item.repo_fingerprint === repoFingerprint
      );
      const quota = ensureQuotaRecord(
        state,
        auth.user.id,
        claimTemplate.plan
      );

      if (existing) {
        existing.last_seen_at = new Date().toISOString();
        idempotent = true;
        quotaAfter = quota;
        return;
      }

      if (quota.projects_used >= quota.projects_allowed) {
        throw new Error("project quota exceeded");
      }

      state.project_activations.push({
        id: randomUUID(),
        user_id: auth.user.id,
        scope: "memorybank",
        repo_fingerprint: repoFingerprint,
        repo_label: repoLabel,
        first_activated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      });
      quota.projects_used += 1;
      quota.updated_at = new Date().toISOString();
      quotaAfter = quota;
    });

    if (!quotaAfter) {
      return reply.code(500).send({ error: "quota update failed" });
    }

    return {
      scope: "memorybank",
      idempotent,
      projects_allowed: quotaAfter.projects_allowed,
      projects_used: quotaAfter.projects_used,
      projects_remaining: Math.max(
        0,
        quotaAfter.projects_allowed - quotaAfter.projects_used
      )
    };
  });

  app.get<{ Querystring: { scope?: "memorybank" } }>(
    "/projects/quota",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }
      const scope = request.query?.scope ?? "memorybank";
      if (scope !== "memorybank") {
        return reply.code(400).send({
          error: "only memorybank scope is supported in milestone 5"
        });
      }

      const snapshot = deps.store.snapshot();
      const claimTemplate = buildEntitlementClaims(
        snapshot,
        auth.user.id,
        "quota-view"
      );
      const quota = ensureQuotaRecord(
        snapshot,
        auth.user.id,
        claimTemplate.plan
      );
      return {
        scope,
        projects_allowed: quota.projects_allowed,
        projects_used: quota.projects_used,
        projects_remaining: Math.max(
          0,
          quota.projects_allowed - quota.projects_used
        )
      };
    }
  );

  app.post<{ Body: { reason?: string } }>(
    "/refund/request",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }
      const snapshot = deps.store.snapshot();
      const activeSub = snapshot.subscriptions.find(
        (item) =>
          item.user_id === auth.user.id && item.status === "active"
      );
      if (!activeSub) {
        return reply
          .code(400)
          .send({ error: "no active subscription found" });
      }
      if (
        new Date(activeSub.refund_window_ends_at).getTime() < Date.now()
      ) {
        return reply
          .code(400)
          .send({ error: "refund window already closed" });
      }

      const requestId = randomUUID();
      await deps.store.update((state) => {
        state.refund_requests.push({
          id: requestId,
          user_id: auth.user.id,
          subscription_id: activeSub.id,
          requested_at: new Date().toISOString(),
          status: "requested",
          approved_at: null,
          reason: request.body?.reason?.trim() || null
        });
      });
      return { request_id: requestId, status: "requested" };
    }
  );

  app.get("/account/summary", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    return buildAccountSummaryResponseForUserSupport({
      user: auth.user,
      snapshot: deps.store.snapshot(),
      now: new Date(),
      buildEntitlementClaims,
      resolveEffectivePlan,
      ensureQuotaRecord,
      supportsGovernancePlan: deps.supportsGovernancePlan,
      canManageTeamRole,
      resolveAdminSnapshot: (email) =>
        resolveAccountSummaryAdminSnapshotSupport({
          email,
          getSuperAdminEmailSet: deps.getSuperAdminEmailSet,
          resolveAdminAccessFromDb: deps.resolveAdminAccessFromDb,
          boardReadPermission: deps.boardReadPermission,
          safeLogWarn: deps.safeLogWarn,
          toErrorMessage: deps.toErrorMessage
        }),
      governanceSeatPriceCents: deps.governanceSeatPriceCents,
      adminRoutePrefix: deps.adminRoutePrefix,
      cloudflareAccessEnabled: deps.cloudflareAccessEnabled
    });
  });

  app.get("/account/billing/history", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const snapshot = deps.store.snapshot();
    const subscriptions = snapshot.subscriptions
      .filter((item) => item.user_id === auth.user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const refunds = snapshot.refund_requests
      .filter((item) => item.user_id === auth.user.id)
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at));
    const offlineRefs = snapshot.offline_payment_refs
      .filter((item) => item.email === auth.user.email)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    return {
      ok: true,
      email: auth.user.email,
      subscriptions,
      refund_requests: refunds,
      offline_references: offlineRefs
    };
  });

  app.get("/account/support/history", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const snapshot = deps.store.snapshot();
    const tickets = snapshot.support_tickets
      .filter((item) => item.user_id === auth.user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { ok: true, tickets };
  });

  app.post<{
    Body: {
      category?: "support" | "billing" | "bug" | "feature";
      severity?: "low" | "medium" | "high";
      subject?: string;
      message?: string;
    };
  }>("/account/support/request", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const category = normalizeSupportCategory(request.body?.category);
    const severity = normalizeSupportSeverity(request.body?.severity);
    const subject = request.body?.subject?.trim();
    const message = request.body?.message?.trim();
    if (!subject || !message || !category || !severity) {
      return reply.code(400).send({
        error:
          "category, severity, subject, and message are required"
      });
    }
    if (subject.length > 160 || message.length > 4000) {
      return reply
        .code(400)
        .send({ error: "subject or message is too long" });
    }

    const ticketId = randomUUID();
    const nowIso = new Date().toISOString();
    await deps.store.update((state) => {
      state.support_tickets.push({
        id: ticketId,
        user_id: auth.user.id,
        email: auth.user.email,
        category,
        severity,
        subject,
        message,
        status: "open",
        resolution_note: null,
        created_at: nowIso,
        updated_at: nowIso
      });
    });

    return { ok: true, ticket_id: ticketId, status: "open" };
  });

  app.post<{
    Body: { rating?: number; message?: string };
  }>("/account/feedback", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const rating = Math.floor(request.body?.rating ?? 0);
    const message = request.body?.message?.trim() || null;
    if (rating < 1 || rating > 5) {
      return reply
        .code(400)
        .send({ error: "rating must be between 1 and 5" });
    }
    if (message && message.length > 1200) {
      return reply
        .code(400)
        .send({ error: "feedback message is too long" });
    }

    const feedbackId = randomUUID();
    await deps.store.update((state) => {
      state.feedback_entries.push({
        id: feedbackId,
        user_id: auth.user.id,
        email: auth.user.email,
        rating: rating as 1 | 2 | 3 | 4 | 5,
        message,
        created_at: new Date().toISOString()
      });
    });

    return { ok: true, feedback_id: feedbackId };
  });
}
