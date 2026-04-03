const PAID_TIERS = ["pro", "team", "enterprise"];
const MODULE_SCOPES = ["narrate", "memorybank", "bundle"];

export const DEFAULT_PUBLIC_PRICING_CATALOG = {
  version: 1,
  plan_cards: {
    free: {
      title: "Free",
      headline: "Free",
      summary: "Start local-first narration and baseline trust checks without Stripe.",
      bullets: [
        "Dev reading mode",
        "Prompt handoff",
        "Trust Score + Environment Doctor"
      ]
    },
    trial: {
      title: "Trial / EDU",
      headline: "2-day trial",
      summary: "Education-first onboarding before paid activation.",
      bullets: [
        "Edu narration view during trial",
        "Redeem + trial workflows",
        "No paid export/report gates yet"
      ]
    },
    pro: {
      title: "Pro",
      headline: "From £18/year",
      summary: "Individual annual access priced for solo developers who want one module or the bundle.",
      bullets: [
        "Memory-bank: £18/year, Narrate: £22/year, Bundle: £32/year",
        "Single-user annual access with up to 2 devices and 20 Memory-bank projects",
        "Includes the frontend/backend integration workflow, secure review workflow, and core PG validation tooling"
      ]
    },
    team: {
      title: "Team",
      headline: "From £69/year",
      summary: "Starter team packages with shared governance, kept modest for small companies.",
      bullets: [
        "Memory-bank: £69/year, Narrate: £79/year, Bundle: £119/year",
        "Starter package typically up to 5 seats, with 10 devices per licensed user and 200 Memory-bank projects",
        "Includes frontend/backend integration, secure review workflow, and Slack-backed team governance"
      ]
    },
    enterprise: {
      title: "Enterprise",
      headline: "From £169/year",
      summary: "Standard enterprise packages stay moderate, while Enterprise Custom uses a quote path for larger seat counts or higher Memory-bank quotas.",
      bullets: [
        "Memory-bank: from £169/year, Narrate: from £199/year, Bundle: from £299/year",
        "Standard enterprise includes 50 devices per licensed user and 2,000 Memory-bank projects",
        "Enterprise Custom adds quoted seat and quota caps with manual activation after invoice or procurement approval"
      ]
    }
  },
  skus: {
    pro: {
      narrate: buildSku({ stripeKey: "pro:narrate", label: "Pro Narrate Annual", amountGbp: 22, priceText: "£22 / year", note: "Individual Narrate access for one year.", seatHint: "Single-user annual access." }),
      memorybank: buildSku({ stripeKey: "pro:memorybank", label: "Pro Memory-bank Annual", amountGbp: 18, priceText: "£18 / year", note: "Individual Memory-bank workflow access for one year.", seatHint: "Single-user annual access." }),
      bundle: buildSku({ stripeKey: "pro:bundle", label: "Pro Bundle Annual", amountGbp: 32, priceText: "£32 / year", note: "Narrate plus Memory-bank together on one annual purchase.", seatHint: "Single-user annual access." })
    },
    team: {
      narrate: buildSku({ stripeKey: "team:narrate", label: "Team Narrate Annual", amountGbp: 79, priceText: "£79 / year", note: "Starter team Narrate package with shared governance.", seatHint: "Base package, typically up to 5 seats." }),
      memorybank: buildSku({ stripeKey: "team:memorybank", label: "Team Memory-bank Annual", amountGbp: 69, priceText: "£69 / year", note: "Starter team Memory-bank package for shared continuity.", seatHint: "Base package, typically up to 5 seats." }),
      bundle: buildSku({ stripeKey: "team:bundle", label: "Team Bundle Annual", amountGbp: 119, priceText: "£119 / year", note: "Starter team bundle for both modules together.", seatHint: "Base package, typically up to 5 seats." })
    },
    enterprise: {
      narrate: buildSku({ stripeKey: "enterprise:narrate", label: "Enterprise Narrate Annual", amountGbp: 199, priceText: "From £199 / year", note: "Base enterprise Narrate package; larger size is priced manually.", seatHint: "Base package, final amount depends on rollout size." }),
      memorybank: buildSku({ stripeKey: "enterprise:memorybank", label: "Enterprise Memory-bank Annual", amountGbp: 169, priceText: "From £169 / year", note: "Base enterprise Memory-bank package; larger size is priced manually.", seatHint: "Base package, final amount depends on rollout size." }),
      bundle: buildSku({ stripeKey: "enterprise:bundle", label: "Enterprise Bundle Annual", amountGbp: 299, priceText: "From £299 / year", note: "Base enterprise bundle; larger size is priced manually.", seatHint: "Base package, final amount depends on rollout size." })
    }
  },
  notes: {
    free_trial:
      "Free and Trial / EDU do not need Stripe products. Paid access is sold as annual plan-plus-module SKUs, and the visible pricing can be edited from the admin board. The frontend/backend integration workflow and secure review workflow are included from Pro upward, while Free and Trial stay out of those paid workflow surfaces.",
    annual_checkout:
      "Current checkout truth: Stripe runs in one-time payment mode for one year of access. Keep Stripe prices as one-time annual starter packages until recurring or automatic per-seat billing is implemented.",
    enterprise_sizing:
      "Team and enterprise prices are base packages. Enterprise Custom should stay off the public self-serve Stripe map: agree the seat and quota caps first, bill by quote, invoice, or manual Stripe invoicing, then activate from the admin portal. If you change the standard Stripe charge, create a new Stripe price and update only the Stripe price map. The public pricing catalog can be edited separately."
  },
  affiliate_program: {
    enabled: true,
    buyer_discount_minor_units: 250,
    buyer_discount_percent_bps: 1000,
    buyer_discount_text:
      "Use a valid referral or affiliate code and the buyer gets the better of £2.50 off or 10% off the annual self-serve checkout.",
    referral_minimum_commission_minor_units: 200,
    affiliate_minimum_commission_minor_units: 250,
    payout_hold_days: 5,
    default_commission_rate_bps: 1000,
    milestone_tiers: [
      {
        paid_referrals: 3,
        bonus_commission_bps: 500,
        unlocks: "After 3 paid buyers, the commission rate steps up from 10% to 15%."
      }
    ],
    influencer_note:
      "Customer referrers and affiliates can both share codes. Buyers get a discount, referral-code owners earn at least £2.00 per paid buyer, and affiliate-code owners earn at least £2.50 per paid buyer.",
    payout_note:
      "Customers can request a full refund during the first 5 days. Referral and affiliate payouts stay on hold during that full-refund window and are only approved after it closes to reduce fraud risk."
  }
};

let pricingCatalogPromise;

function buildSku(config) {
  const { stripeKey, label, amountGbp, priceText, note, seatHint } = config;
  return {
    stripe_key: stripeKey,
    label,
    amount_gbp: amountGbp,
    minor_units: Math.round(amountGbp * 100),
    price_text: priceText,
    billing_model: "annual_one_time",
    note,
    seat_hint: seatHint
  };
}

export function formatCurrencyGbp(amountGbp) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(amountGbp);
}

export function getPlanCard(catalog, key) {
  return catalog?.plan_cards?.[key] || DEFAULT_PUBLIC_PRICING_CATALOG.plan_cards[key];
}

export function getSkuEntry(catalog, planId, moduleScope) {
  return (
    catalog?.skus?.[planId]?.[moduleScope] ||
    DEFAULT_PUBLIC_PRICING_CATALOG.skus?.[planId]?.[moduleScope] ||
    null
  );
}

export function priceText(entry) {
  if (!entry) {
    return "";
  }
  return entry.price_text || `${formatCurrencyGbp(entry.amount_gbp)} / year`;
}

export function getPaidTierOrder() {
  return [...PAID_TIERS];
}

export function getModuleScopeOrder() {
  return [...MODULE_SCOPES];
}

export async function loadPublicPricingCatalog() {
  if (!pricingCatalogPromise) {
    pricingCatalogPromise = fetchCatalog();
  }
  return pricingCatalogPromise;
}

async function fetchCatalog() {
  try {
    const response = await fetch("/api/pricing/catalog", { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    return json?.catalog || DEFAULT_PUBLIC_PRICING_CATALOG;
  } catch {
    return DEFAULT_PUBLIC_PRICING_CATALOG;
  }
}
