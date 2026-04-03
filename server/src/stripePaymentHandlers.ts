import { randomUUID } from "crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { ModuleScope, PaidPlanTier } from "./types";
import type { RegisterPaymentsRoutesDeps } from "./paymentsRoutes";
import {
  affiliateProgramFromCatalog,
  findAffiliateSku,
  resolveAffiliateCheckoutPricing
} from "./affiliateProgram";

// ---------------------------------------------------------------------------
// Stripe checkout + webhook handlers – extracted from paymentsRoutes.ts.
// ---------------------------------------------------------------------------

export async function handleCreateCheckoutSession(
  request: FastifyRequest<{
    Body: {
      plan_id?: PaidPlanTier;
      module_scope?: ModuleScope;
      years?: number;
      affiliate_code?: string;
      success_url?: string;
      cancel_url?: string;
    };
  }>,
  reply: FastifyReply,
  deps: RegisterPaymentsRoutesDeps
) {
  const { requireAuth, getStripeRuntimeConfig, resolveStripePriceId, safeJson, store, getPricingCatalogPublic } = deps;
  const auth = requireAuth(request, reply);
  if (!auth) {
    return;
  }
  const stripeConfig = getStripeRuntimeConfig();
  if (!stripeConfig.secretKey) {
    return reply.code(503).send({ error: "Stripe is not configured on this server." });
  }
  if (!stripeConfig.checkoutSuccessUrl || !stripeConfig.checkoutCancelUrl) {
    return reply.code(503).send({
      error: "Stripe checkout URLs are not configured on this server."
    });
  }

  const editorSuccessUrl = request.body?.success_url?.trim() || "";
  const editorCancelUrl = request.body?.cancel_url?.trim() || "";
  if (editorSuccessUrl && !deps.isAllowedCheckoutReturnUrl(editorSuccessUrl)) {
    return reply.code(400).send({ error: "success_url is not in trusted callback targets." });
  }
  if (editorCancelUrl && !deps.isAllowedCheckoutReturnUrl(editorCancelUrl)) {
    return reply.code(400).send({ error: "cancel_url is not in trusted callback targets." });
  }

  const planId = request.body?.plan_id;
  const moduleScope = request.body?.module_scope ?? "narrate";
  const years = request.body?.years && request.body.years > 0 ? request.body.years : 1;
  const affiliateCode = request.body?.affiliate_code?.trim().toUpperCase() || "";
  if (!planId) {
    return reply.code(400).send({ error: "plan_id is required" });
  }

  const pricingCatalog = getPricingCatalogPublic();
  const sku = findAffiliateSku(pricingCatalog, planId, moduleScope);
  if (!sku) {
    return reply.code(400).send({ error: `Missing public pricing entry for ${planId}:${moduleScope}.` });
  }

  const affiliateProgram = affiliateProgramFromCatalog(pricingCatalog);
  const activeAffiliate = affiliateCode
    ? store.snapshot().affiliate_codes.find(
        (item) => item.code === affiliateCode && item.status === "active"
      )
    : null;
  if (affiliateCode && !activeAffiliate) {
    return reply.code(404).send({ error: "affiliate code not found" });
  }

  const checkoutPricing = resolveAffiliateCheckoutPricing(pricingCatalog, sku, Boolean(activeAffiliate));

  const priceId = resolveStripePriceId(planId, moduleScope);
  if (!priceId && checkoutPricing.buyerDiscountMinorUnits === 0) {
    return reply.code(400).send({
      error: `Missing Stripe price mapping for ${planId}:${moduleScope}. Configure STRIPE_PRICE_MAP.`
    });
  }

  const billingMode = await resolveCheckoutBillingMode({
    secretKey: stripeConfig.secretKey,
    priceId,
    safeJson
  });

  const form = new URLSearchParams();
  form.set("mode", billingMode);
  form.set(
    "success_url",
    buildCheckoutReturnUrl(stripeConfig.checkoutSuccessUrl, editorSuccessUrl)
  );
  form.set(
    "cancel_url",
    buildCheckoutReturnUrl(stripeConfig.checkoutCancelUrl, editorCancelUrl)
  );
  if (checkoutPricing.buyerDiscountMinorUnits > 0) {
    form.set("line_items[0][price_data][currency]", "gbp");
    form.set("line_items[0][price_data][unit_amount]", String(checkoutPricing.finalMinorUnits));
    if (billingMode === "subscription") {
      form.set("line_items[0][price_data][recurring][interval]", "year");
      form.set("line_items[0][price_data][recurring][interval_count]", "1");
    }
    form.set("line_items[0][price_data][product_data][name]", `${sku.label} Referral Checkout`);
    form.set(
      "line_items[0][price_data][product_data][description]",
      `${affiliateProgram.buyer_discount_text} Base SKU ${sku.price_text}.`
    );
  } else {
    form.set("line_items[0][price]", priceId ?? "");
  }
  form.set("line_items[0][quantity]", "1");
  form.set("metadata[email]", auth.user.email);
  form.set("metadata[plan_id]", planId);
  form.set("metadata[module_scope]", moduleScope);
  form.set("metadata[years]", String(years));
  if (affiliateCode) {
    form.set("metadata[affiliate_code]", affiliateCode);
    form.set("metadata[buyer_discount_minor_units]", String(checkoutPricing.buyerDiscountMinorUnits));
    form.set("metadata[base_minor_units]", String(sku.minor_units));
    form.set("metadata[final_minor_units]", String(checkoutPricing.finalMinorUnits));
  }
  form.set("customer_email", auth.user.email);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeConfig.secretKey}`,
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

type CheckoutBillingMode = "payment" | "subscription";

async function resolveCheckoutBillingMode(input: {
  secretKey: string;
  priceId?: string;
  safeJson: (raw: string) => unknown;
}): Promise<CheckoutBillingMode> {
  if (!input.priceId) {
    return "payment";
  }

  try {
    const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(input.priceId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${input.secretKey}` },
      signal: AbortSignal.timeout(10000)
    });
    const raw = await response.text();
    const parsed = input.safeJson(raw) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(extractStripeError(parsed, raw));
    }
    const recurring = parsed.recurring;
    if (recurring && typeof recurring === "object") {
      return "subscription";
    }
    return "payment";
  } catch (error) {
    throw new Error(`Stripe price lookup failed for ${input.priceId}: ${toErrorMessage(error)}`);
  }
}

function extractStripeError(parsed: unknown, fallback: string): string {
  if (parsed && typeof parsed === "object") {
    const maybeError = (parsed as Record<string, unknown>).error;
    if (maybeError && typeof maybeError === "object" && "message" in maybeError) {
      return String((maybeError as Record<string, unknown>).message);
    }
  }
  return fallback;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function buildCheckoutReturnUrl(baseUrl: string, editorReturnUrl: string): string {
  if (!editorReturnUrl) {
    return baseUrl;
  }

  const target = new URL(baseUrl);
  target.searchParams.set("editor_return_url", editorReturnUrl);
  return target.toString();
}

export async function handleStripeWebhook(
  request: FastifyRequest<{ Body: Record<string, unknown> & { __raw_json_body?: string } }>,
  reply: FastifyReply,
  deps: RegisterPaymentsRoutesDeps
) {
  const {
    store, getStripeRuntimeConfig, safeJson, verifyStripeSignature,
    getObject, getString, normalizeEmail, asPaidPlanTier, asModuleScope,
    getNumber, grantSubscriptionByEmail, recordAffiliatePaidConversion
  } = deps;
  const stripeConfig = getStripeRuntimeConfig();

  const rawPayload =
    typeof request.body?.__raw_json_body === "string"
      ? request.body.__raw_json_body
      : JSON.stringify(request.body ?? {});
  const signatureHeader = request.headers["stripe-signature"];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  if (!stripeConfig.webhookSecret) {
    return reply.code(503).send({ error: "stripeWebhookSecret is not configured." });
  }
  if (!signature) {
    return reply.code(400).send({ error: "Missing stripe-signature header." });
  }
  if (!verifyStripeSignature(rawPayload, signature, stripeConfig.webhookSecret)) {
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
  const buyerDiscountCents = Math.max(
    0,
    Number.parseInt(getString(metadata, "buyer_discount_minor_units") || "0", 10) || 0
  );
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
    await recordAffiliatePaidConversion(affiliateCode, email, eventId, grossAmount, buyerDiscountCents);
  }

  return { ok: true, idempotent: false, event_id: eventId, ends_at: grant.endsAt };
}
