import { randomUUID } from "crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { ModuleScope, PaidPlanTier } from "./types";
import type { RegisterPaymentsRoutesDeps } from "./paymentsRoutes";

// ---------------------------------------------------------------------------
// Stripe checkout + webhook handlers – extracted from paymentsRoutes.ts.
// ---------------------------------------------------------------------------

export async function handleCreateCheckoutSession(
  request: FastifyRequest<{
    Body: { plan_id?: PaidPlanTier; module_scope?: ModuleScope; years?: number; affiliate_code?: string };
  }>,
  reply: FastifyReply,
  deps: RegisterPaymentsRoutesDeps
) {
  const { requireAuth, stripeSecretKey, checkoutSuccessUrl, checkoutCancelUrl, resolveStripePriceId, safeJson } = deps;
  const auth = requireAuth(request, reply);
  if (!auth) {
    return;
  }
  if (!stripeSecretKey) {
    return reply.code(503).send({ error: "Stripe is not configured on this server." });
  }

  const planId = request.body?.plan_id;
  const moduleScope = request.body?.module_scope ?? "narrate";
  const years = request.body?.years && request.body.years > 0 ? request.body.years : 1;
  const affiliateCode = request.body?.affiliate_code?.trim() || "";
  if (!planId) {
    return reply.code(400).send({ error: "plan_id is required" });
  }

  const priceId = resolveStripePriceId(planId, moduleScope);
  if (!priceId) {
    return reply.code(400).send({
      error: `Missing Stripe price mapping for ${planId}:${moduleScope}. Configure STRIPE_PRICE_MAP.`
    });
  }

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", checkoutSuccessUrl);
  form.set("cancel_url", checkoutCancelUrl);
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("metadata[email]", auth.user.email);
  form.set("metadata[plan_id]", planId);
  form.set("metadata[module_scope]", moduleScope);
  form.set("metadata[years]", String(years));
  if (affiliateCode) {
    form.set("metadata[affiliate_code]", affiliateCode);
  }
  form.set("customer_email", auth.user.email);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });
  const raw = await stripeResponse.text();
  const parsed = safeJson(raw) as Record<string, unknown>;
  if (!stripeResponse.ok) {
    const stripeMessage =
      typeof parsed.error === "object" &&
      parsed.error &&
      "message" in parsed.error
        ? String((parsed.error as Record<string, unknown>).message)
        : raw;
    return reply.code(502).send({ error: `Stripe checkout session creation failed: ${stripeMessage}` });
  }

  const url = typeof parsed.url === "string" ? parsed.url : "";
  const sessionId = typeof parsed.id === "string" ? parsed.id : "";
  if (!url || !sessionId) {
    return reply.code(502).send({ error: "Stripe response did not include session url/id." });
  }

  return { ok: true, url, session_id: sessionId };
}

export async function handleStripeWebhook(
  request: FastifyRequest<{ Body: Record<string, unknown> & { __raw_json_body?: string } }>,
  reply: FastifyReply,
  deps: RegisterPaymentsRoutesDeps
) {
  const {
    store, stripeWebhookSecret, safeJson, verifyStripeSignature,
    getObject, getString, normalizeEmail, asPaidPlanTier, asModuleScope,
    getNumber, grantSubscriptionByEmail, recordAffiliatePaidConversion
  } = deps;

  const rawPayload =
    typeof request.body?.__raw_json_body === "string"
      ? request.body.__raw_json_body
      : JSON.stringify(request.body ?? {});
  const signatureHeader = request.headers["stripe-signature"];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  if (!stripeWebhookSecret) {
    return reply.code(503).send({ error: "stripeWebhookSecret is not configured." });
  }
  if (!signature) {
    return reply.code(400).send({ error: "Missing stripe-signature header." });
  }
  if (!verifyStripeSignature(rawPayload, signature, stripeWebhookSecret)) {
    return reply.code(401).send({ error: "Invalid stripe webhook signature." });
  }

  const payload = safeJson(rawPayload) as Record<string, unknown>;
  const eventId = typeof payload.id === "string" ? payload.id : "";
  const eventType = typeof payload.type === "string" ? payload.type : "";
  if (!eventId || !eventType) {
    return reply.code(400).send({ error: "Invalid Stripe event payload." });
  }

  const snapshot = store.snapshot();
  if (snapshot.stripe_events.some((item) => item.event_id === eventId)) {
    return { ok: true, idempotent: true };
  }

  if (eventType !== "checkout.session.completed") {
    await store.update((state) => {
      state.stripe_events.push({
        id: randomUUID(),
        event_id: eventId,
        event_type: eventType,
        created_at: new Date().toISOString()
      });
    });
    return { ok: true, ignored: true, event_type: eventType };
  }

  return handleStripeCheckoutCompleted(reply, deps, payload, eventId, eventType);
}

export async function handleStripeCheckoutCompleted(
  reply: FastifyReply,
  deps: RegisterPaymentsRoutesDeps,
  payload: Record<string, unknown>,
  eventId: string,
  eventType: string
) {
  const {
    store, getObject, getString, normalizeEmail, asPaidPlanTier,
    asModuleScope, getNumber, grantSubscriptionByEmail, recordAffiliatePaidConversion
  } = deps;

  const eventObject = getObject(payload, ["data", "object"]);
  const metadata = getObject(eventObject, ["metadata"]);
  const emailCandidate = getString(metadata, "email") || getString(getObject(eventObject, ["customer_details"]), "email");
  const email = normalizeEmail(emailCandidate);
  const planId = asPaidPlanTier(getString(metadata, "plan_id"));
  const moduleScope = asModuleScope(getString(metadata, "module_scope")) ?? "narrate";
  const years = Math.max(1, Number.parseInt(getString(metadata, "years") || "1", 10) || 1);
  const affiliateCode = (getString(metadata, "affiliate_code") || "").trim().toUpperCase();
  const grossAmount = Math.max(0, getNumber(eventObject, "amount_total") ?? 0);

  if (!email || !planId) {
    return reply.code(400).send({ error: "Stripe metadata email and plan_id are required." });
  }

  const grant = await grantSubscriptionByEmail({
    email,
    planId,
    moduleScope,
    years,
    source: "stripe"
  });

  await store.update((state) => {
    state.stripe_events.push({
      id: randomUUID(),
      event_id: eventId,
      event_type: eventType,
      created_at: new Date().toISOString()
    });
  });

  if (affiliateCode && grossAmount > 0) {
    await recordAffiliatePaidConversion(affiliateCode, email, eventId, grossAmount);
  }

  return { ok: true, idempotent: false, event_id: eventId, ends_at: grant.endsAt };
}
