import { randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AdminPermissionKeys } from "./adminRbacBootstrap";
import { StateStore } from "./store";
import { ModuleScope, PaidPlanTier, UserRecord } from "./types";
import {
  handleCreateCheckoutSession,
  handleStripeWebhook,
} from "./stripePaymentHandlers";

type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

type AffiliatePaidConversionResult =
  | { ok: true; conversionId: string; commissionAmountCents: number }
  | { ok: false; code: number; error: string };

export interface RegisterPaymentsRoutesDeps {
  requireAuth: (request: FastifyRequest, reply: FastifyReply) => { user: UserRecord } | undefined;
  store: StateStore;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  resolveStripePriceId: (planId: PaidPlanTier, moduleScope: ModuleScope) => string | undefined;
  safeJson: (raw: string) => unknown;
  verifyStripeSignature: (payload: string, signatureHeader: string, secret: string) => boolean;
  getObject: (source: Record<string, unknown>, pathSegments: string[]) => Record<string, unknown>;
  getString: (source: Record<string, unknown>, key: string) => string | undefined;
  normalizeEmail: (value: string | undefined) => string | undefined;
  asPaidPlanTier: (value: string | undefined) => PaidPlanTier | undefined;
  asModuleScope: (value: string | undefined) => ModuleScope | undefined;
  getNumber: (source: Record<string, unknown>, key: string) => number | undefined;
  grantSubscriptionByEmail: (input: {
    email: string;
    planId: PaidPlanTier;
    moduleScope: ModuleScope;
    years: number;
    source: "stripe" | "offline" | "manual";
    teamId?: string | null;
  }) => Promise<{ userId: string; endsAt: string }>;
  recordAffiliatePaidConversion: (
    code: string,
    buyerEmail: string,
    orderId: string,
    grossAmountCents: number
  ) => Promise<AffiliatePaidConversionResult>;
  addDays: (date: Date, days: number) => Date;
  offlineRefTtlDays: number;
  generateCode: (prefix: string) => string;
  requireAdminPermission: (
    request: FastifyRequest,
    reply: FastifyReply,
    permissionKey: string
  ) => Promise<AdminAccessContext | undefined>;
  adminPermissionKeys: AdminPermissionKeys;
  adminRoutePrefix: string;
  grantSubscriptionByUserId: (input: {
    userId: string;
    planId: PaidPlanTier;
    moduleScope: ModuleScope;
    years: number;
    source: "stripe" | "offline" | "manual";
    teamId?: string | null;
  }) => Promise<{ endsAt: string }>;
  toErrorMessage: (error: unknown) => string;
}

export function registerPaymentsRoutes(app: FastifyInstance, deps: RegisterPaymentsRoutesDeps): void {
  app.post<{
    Body: { plan_id?: PaidPlanTier; module_scope?: ModuleScope; years?: number; affiliate_code?: string };
  }>(
    "/payments/stripe/create-checkout-session",
    (request, reply) => handleCreateCheckoutSession(request, reply, deps)
  );
  app.post<{
    Body: Record<string, unknown> & { __raw_json_body?: string };
  }>(
    "/payments/stripe/webhook",
    (request, reply) => handleStripeWebhook(request, reply, deps)
  );
  app.post<{
    Body: { email?: string; amount_cents?: number; plan_id?: PaidPlanTier; module_scope?: ModuleScope; years?: number };
  }>(
    "/payments/offline/create-ref",
    (request, reply) => handleCreateOfflineRef(request, reply, deps)
  );
  app.post<{
    Body: { ref_code?: string; proof_url?: string };
  }>(
    "/payments/offline/submit-proof",
    (request, reply) => handleSubmitProof(request, reply, deps)
  );
  app.post<{ Body: { ref_code?: string } }>(
    `${deps.adminRoutePrefix}/offline/approve`,
    (request, reply) => handleApproveOffline(request, reply, deps)
  );
  app.post<{ Body: { ref_code?: string; reason?: string } }>(
    `${deps.adminRoutePrefix}/offline/reject`,
    (request, reply) => handleRejectOffline(request, reply, deps)
  );
  app.post<{ Body: { code?: string } }>(
    "/redeem/apply",
    (request, reply) => handleRedeemApply(request, reply, deps)
  );
}

async function handleCreateOfflineRef(
  request: FastifyRequest<{
    Body: { email?: string; amount_cents?: number; plan_id?: PaidPlanTier; module_scope?: ModuleScope; years?: number };
  }>,
  reply: FastifyReply,
  deps: RegisterPaymentsRoutesDeps
) {
  const { normalizeEmail, store, addDays, offlineRefTtlDays, generateCode } = deps;
  const email = normalizeEmail(request.body?.email);
  const amountCents = Math.max(0, request.body?.amount_cents ?? 0);
  const planId = request.body?.plan_id;
  const moduleScope = request.body?.module_scope ?? "narrate";
  const years = request.body?.years && request.body.years > 0 ? request.body.years : 1;
  if (!email || !planId || amountCents <= 0) {
    return reply.code(400).send({ error: "email, plan_id and amount_cents are required" });
  }

  const now = new Date();
  const refCode = generateCode("OFF");
  await store.update((state) => {
    state.offline_payment_refs.push({
      id: randomUUID(),
      email,
      ref_code: refCode,
      amount_cents: amountCents,
      plan_id: planId,
      module_scope: moduleScope,
      years,
      proof_url: null,
      status: "pending",
      expires_at: addDays(now, offlineRefTtlDays).toISOString(),
      created_at: now.toISOString(),
      submitted_at: null,
      approved_at: null,
      rejected_at: null,
      rejection_reason: null,
      redeem_code: null
    });
  });

  return {
    ok: true,
    ref_code: refCode,
    expires_at: addDays(now, offlineRefTtlDays).toISOString()
  };
}

async function handleSubmitProof(
  request: FastifyRequest<{ Body: { ref_code?: string; proof_url?: string } }>,
  reply: FastifyReply,
  deps: RegisterPaymentsRoutesDeps
) {
  const { store, toErrorMessage } = deps;
  const refCode = request.body?.ref_code?.trim().toUpperCase();
  const proofUrl = request.body?.proof_url?.trim() || null;
  if (!refCode || !proofUrl) {
    return reply.code(400).send({ error: "ref_code and proof_url are required" });
  }

  try {
    await store.update((state) => {
      const ref = state.offline_payment_refs.find((item) => item.ref_code === refCode);
      if (!ref) {
        throw new Error("offline ref not found");
      }
      if (new Date(ref.expires_at).getTime() <= Date.now()) {
        throw new Error("offline ref expired");
      }
      if (ref.status === "approved") {
        return;
      }
      if (ref.status === "rejected") {
        throw new Error("offline ref rejected");
      }
      ref.proof_url = proofUrl;
      ref.status = "submitted";
      ref.submitted_at = new Date().toISOString();
    });
  } catch (error) {
    return reply.code(400).send({ error: toErrorMessage(error) });
  }

  return { ok: true, status: "submitted" };
}

async function handleApproveOffline(
  request: FastifyRequest<{ Body: { ref_code?: string } }>,
  reply: FastifyReply,
  deps: RegisterPaymentsRoutesDeps
) {
  const { requireAdminPermission, adminPermissionKeys, store, generateCode, toErrorMessage } = deps;
  const adminAccess = await requireAdminPermission(
    request,
    reply,
    adminPermissionKeys.OFFLINE_PAYMENT_REVIEW
  );
  if (!adminAccess) {
    return;
  }
  const refCode = request.body?.ref_code?.trim().toUpperCase();
  if (!refCode) {
    return reply.code(400).send({ error: "ref_code is required" });
  }

  let redeemCode = "";
  try {
    await store.update((state) => {
      const ref = state.offline_payment_refs.find((item) => item.ref_code === refCode);
      if (!ref) {
        throw new Error("offline ref not found");
      }
      if (ref.status === "rejected") {
        throw new Error("offline ref rejected");
      }
      if (ref.status === "approved" && ref.redeem_code) {
        redeemCode = ref.redeem_code;
        return;
      }

      redeemCode = generateCode("RDM");
      ref.status = "approved";
      ref.approved_at = new Date().toISOString();
      ref.redeem_code = redeemCode;

      state.redeem_codes.push({
        id: randomUUID(),
        code: redeemCode,
        email: ref.email,
        plan_id: ref.plan_id,
        module_scope: ref.module_scope,
        years: ref.years,
        status: "unused",
        source: "offline",
        created_at: new Date().toISOString(),
        used_at: null,
        used_by_user_id: null,
        revoked_at: null
      });
    });
  } catch (error) {
    return reply.code(400).send({ error: toErrorMessage(error) });
  }

  return { ok: true, ref_code: refCode, redeem_code: redeemCode };
}

async function handleRejectOffline(
  request: FastifyRequest<{ Body: { ref_code?: string; reason?: string } }>,
  reply: FastifyReply,
  deps: RegisterPaymentsRoutesDeps
) {
  const { requireAdminPermission, adminPermissionKeys, store, toErrorMessage } = deps;
  const adminAccess = await requireAdminPermission(
    request,
    reply,
    adminPermissionKeys.OFFLINE_PAYMENT_REVIEW
  );
  if (!adminAccess) {
    return;
  }
  const refCode = request.body?.ref_code?.trim().toUpperCase();
  if (!refCode) {
    return reply.code(400).send({ error: "ref_code is required" });
  }
  const reason = request.body?.reason?.trim() || null;

  try {
    await store.update((state) => {
      const ref = state.offline_payment_refs.find((item) => item.ref_code === refCode);
      if (!ref) {
        throw new Error("offline ref not found");
      }
      if (ref.status === "approved") {
        throw new Error("cannot reject an approved offline ref");
      }
      ref.status = "rejected";
      ref.rejected_at = new Date().toISOString();
      ref.rejection_reason = reason;
    });
  } catch (error) {
    return reply.code(400).send({ error: toErrorMessage(error) });
  }

  return { ok: true, ref_code: refCode, status: "rejected" };
}

async function handleRedeemApply(
  request: FastifyRequest<{ Body: { code?: string } }>,
  reply: FastifyReply,
  deps: RegisterPaymentsRoutesDeps
) {
  const { requireAuth, store, grantSubscriptionByUserId } = deps;
  const auth = requireAuth(request, reply);
  if (!auth) {
    return;
  }

  const code = request.body?.code?.trim().toUpperCase();
  if (!code) {
    return reply.code(400).send({ error: "code is required" });
  }

  const snapshot = store.snapshot();
  const redeem = snapshot.redeem_codes.find((item) => item.code === code);
  if (!redeem) {
    return reply.code(404).send({ error: "redeem code not found" });
  }
  if (redeem.status !== "unused") {
    return reply.code(409).send({ error: "redeem code already used or revoked" });
  }
  if (redeem.email !== auth.user.email) {
    return reply.code(403).send({ error: "redeem code is not valid for this account email" });
  }

  const grant = await grantSubscriptionByUserId({
    userId: auth.user.id,
    planId: redeem.plan_id,
    moduleScope: redeem.module_scope,
    years: redeem.years,
    source: "offline"
  });

  await store.update((state) => {
    const codeRecord = state.redeem_codes.find((item) => item.code === code);
    if (!codeRecord) {
      throw new Error("redeem code not found");
    }
    if (codeRecord.status !== "unused") {
      throw new Error("redeem code already used or revoked");
    }
    codeRecord.status = "used";
    codeRecord.used_at = new Date().toISOString();
    codeRecord.used_by_user_id = auth.user.id;
  });

  return {
    ok: true,
    plan_id: redeem.plan_id,
    module_scope: redeem.module_scope,
    ends_at: grant.endsAt
  };}