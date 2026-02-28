import { randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AdminPermissionKeys } from "./adminRbacBootstrap";
import { StateStore } from "./store";
import { UserRecord } from "./types";

type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

type AffiliatePaidConversionResult =
  | { ok: true; conversionId: string; commissionAmountCents: number }
  | { ok: false; code: number; error: string };

export interface RegisterAffiliateRoutesDeps {
  requireAuth: (request: FastifyRequest, reply: FastifyReply) => { user: UserRecord } | undefined;
  store: StateStore;
  clampCommissionRate: (value: number) => number;
  defaultAffiliateRateBps: number;
  generateCode: (prefix: string) => string;
  normalizeEmail: (value: string | undefined) => string | undefined;
  requireAdminPermission: (
    request: FastifyRequest,
    reply: FastifyReply,
    permissionKey: string
  ) => Promise<AdminAccessContext | undefined>;
  adminPermissionKeys: AdminPermissionKeys;
  adminRoutePrefix: string;
  recordAffiliatePaidConversion: (
    code: string,
    buyerEmail: string,
    orderId: string,
    grossAmountCents: number
  ) => Promise<AffiliatePaidConversionResult>;
  toErrorMessage: (error: unknown) => string;
}

export function registerAffiliateRoutes(app: FastifyInstance, deps: RegisterAffiliateRoutesDeps): void {
  app.post<{ Body: { code?: string; commission_rate_bps?: number } }>(
    "/affiliate/code/create",
    (request, reply) => handleCreateAffiliateCode(request, reply, deps)
  );
  app.post<{ Body: { code?: string } }>(
    "/affiliate/track-click",
    (request, reply) => handleTrackClick(request, reply, deps)
  );
  app.post<{
    Body: { code?: string; buyer_email?: string; order_id?: string; gross_amount_cents?: number };
  }>(
    `${deps.adminRoutePrefix}/affiliate/conversion/confirm`,
    (request, reply) => handleConfirmConversion(request, reply, deps)
  );
  app.get("/affiliate/dashboard", (request, reply) => handleDashboard(request, reply, deps));
  app.post<{ Body: { affiliate_user_id?: string; payout_reference?: string } }>(
    `${deps.adminRoutePrefix}/affiliate/payout/approve`,
    (request, reply) => handleApprovePayout(request, reply, deps)
  );
}

async function handleCreateAffiliateCode(
  request: FastifyRequest<{ Body: { code?: string; commission_rate_bps?: number } }>,
  reply: FastifyReply,
  deps: RegisterAffiliateRoutesDeps
) {
  const { requireAuth, store, clampCommissionRate, defaultAffiliateRateBps, generateCode } = deps;
  const auth = requireAuth(request, reply);
  if (!auth) {
    return;
  }

  const requestedCode = request.body?.code?.trim().toUpperCase();
  const commissionRateBps = clampCommissionRate(
    request.body?.commission_rate_bps ?? defaultAffiliateRateBps
  );

  const snapshot = store.snapshot();
  const existing = snapshot.affiliate_codes.find(
    (item) => item.user_id === auth.user.id && item.status === "active"
  );
  if (existing) {
    return {
      ok: true,
      code: existing.code,
      commission_rate_bps: existing.commission_rate_bps,
      idempotent: true
    };
  }

  const code = requestedCode && requestedCode.length >= 6 ? requestedCode : generateCode("AFF");
  if (snapshot.affiliate_codes.some((item) => item.code === code)) {
    return reply.code(409).send({ error: "affiliate code already exists" });
  }

  await store.update((state) => {
    state.affiliate_codes.push({
      id: randomUUID(),
      user_id: auth.user.id,
      code,
      commission_rate_bps: commissionRateBps,
      status: "active",
      created_at: new Date().toISOString()
    });
  });

  return { ok: true, code, commission_rate_bps: commissionRateBps, idempotent: false };
}

async function handleTrackClick(
  request: FastifyRequest<{ Body: { code?: string } }>,
  reply: FastifyReply,
  deps: RegisterAffiliateRoutesDeps
) {
  const { store } = deps;
  const code = request.body?.code?.trim().toUpperCase();
  if (!code) {
    return reply.code(400).send({ error: "code is required" });
  }
  const snapshot = store.snapshot();
  const affiliateCode = snapshot.affiliate_codes.find(
    (item) => item.code === code && item.status === "active"
  );
  if (!affiliateCode) {
    return reply.code(404).send({ error: "affiliate code not found" });
  }

  const conversionId = randomUUID();
  await store.update((state) => {
    state.affiliate_conversions.push({
      id: conversionId,
      affiliate_user_id: affiliateCode.user_id,
      buyer_user_id: null,
      ref_code: code,
      status: "clicked",
      order_id: null,
      gross_amount_cents: 0,
      commission_amount_cents: 0,
      confirmed_at: null,
      created_at: new Date().toISOString(),
      payout_id: null
    });
  });

  return { ok: true, conversion_id: conversionId };
}

async function handleConfirmConversion(
  request: FastifyRequest<{
    Body: { code?: string; buyer_email?: string; order_id?: string; gross_amount_cents?: number };
  }>,
  reply: FastifyReply,
  deps: RegisterAffiliateRoutesDeps
) {
  const { requireAdminPermission, adminPermissionKeys, normalizeEmail, recordAffiliatePaidConversion } = deps;
  const adminAccess = await requireAdminPermission(
    request,
    reply,
    adminPermissionKeys.AFFILIATE_MANAGE
  );
  if (!adminAccess) {
    return;
  }

  const code = request.body?.code?.trim().toUpperCase();
  const buyerEmail = normalizeEmail(request.body?.buyer_email);
  const orderId = request.body?.order_id?.trim() || randomUUID();
  const grossAmount = Math.max(0, request.body?.gross_amount_cents ?? 0);
  if (!code || !buyerEmail || grossAmount <= 0) {
    return reply.code(400).send({ error: "code, buyer_email and gross_amount_cents are required" });
  }

  const result = await recordAffiliatePaidConversion(code, buyerEmail, orderId, grossAmount);
  if (!result.ok) {
    return reply.code(result.code).send({ error: result.error });
  }

  return {
    ok: true,
    conversion_id: result.conversionId,
    commission_amount_cents: result.commissionAmountCents
  };
}

async function handleDashboard(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: RegisterAffiliateRoutesDeps
) {
  const { requireAuth, store } = deps;
  const auth = requireAuth(request, reply);
  if (!auth) {
    return;
  }

  const snapshot = store.snapshot();
  const codes = snapshot.affiliate_codes.filter((item) => item.user_id === auth.user.id);
  const conversions = snapshot.affiliate_conversions.filter(
    (item) => item.affiliate_user_id === auth.user.id
  );
  const payouts = snapshot.affiliate_payouts.filter(
    (item) => item.affiliate_user_id === auth.user.id
  );

  const pendingCommission = conversions
    .filter((item) => item.status === "paid_confirmed" && item.payout_id === null)
    .reduce((sum, item) => sum + item.commission_amount_cents, 0);

  const paidCommission = payouts
    .filter((item) => item.status === "approved" || item.status === "paid")
    .reduce((sum, item) => sum + item.amount_cents, 0);

  return {
    ok: true,
    codes,
    summary: {
      conversions_total: conversions.length,
      pending_commission_cents: pendingCommission,
      paid_commission_cents: paidCommission
    }
  };
}

async function handleApprovePayout(
  request: FastifyRequest<{ Body: { affiliate_user_id?: string; payout_reference?: string } }>,
  reply: FastifyReply,
  deps: RegisterAffiliateRoutesDeps
) {
  const { requireAdminPermission, adminPermissionKeys, store } = deps;
  const adminAccess = await requireAdminPermission(
    request,
    reply,
    adminPermissionKeys.AFFILIATE_MANAGE
  );
  if (!adminAccess) {
    return;
  }
  const affiliateUserId = request.body?.affiliate_user_id?.trim();
  const payoutReference = request.body?.payout_reference?.trim() || null;
  if (!affiliateUserId) {
    return reply.code(400).send({ error: "affiliate_user_id is required" });
  }

  const snapshot = store.snapshot();
  const pending = snapshot.affiliate_conversions.filter(
    (item) =>
      item.affiliate_user_id === affiliateUserId &&
      item.status === "paid_confirmed" &&
      item.payout_id === null
  );
  if (pending.length === 0) {
    return reply.code(400).send({ error: "no pending affiliate commission for user" });
  }

  const amountCents = pending.reduce((sum, item) => sum + item.commission_amount_cents, 0);
  const periodStart = pending
    .map((item) => item.created_at)
    .sort((a, b) => a.localeCompare(b))[0];
  const periodEnd = pending
    .map((item) => item.created_at)
    .sort((a, b) => b.localeCompare(a))[0];
  const payoutId = randomUUID();

  await store.update((state) => {
    state.affiliate_payouts.push({
      id: payoutId,
      affiliate_user_id: affiliateUserId,
      period_start: periodStart,
      period_end: periodEnd,
      amount_cents: amountCents,
      status: "approved",
      payout_reference: payoutReference,
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    for (const conversion of state.affiliate_conversions) {
      if (
        conversion.affiliate_user_id === affiliateUserId &&
        conversion.status === "paid_confirmed" &&
        conversion.payout_id === null
      ) {
        conversion.payout_id = payoutId;
      }
    }
  });

  return { ok: true, payout_id: payoutId, amount_cents: amountCents };
}
