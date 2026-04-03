import { ModuleScope, PaidPlanTier } from "./types";

export type AffiliateProgramMilestoneTier = {
  paid_referrals: number;
  bonus_commission_bps: number;
  unlocks: string;
};

export type PublicAffiliateProgram = {
  enabled: boolean;
  buyer_discount_minor_units: number;
  buyer_discount_percent_bps: number;
  buyer_discount_text: string;
  referral_minimum_commission_minor_units: number;
  affiliate_minimum_commission_minor_units: number;
  payout_hold_days: number;
  default_commission_rate_bps: number;
  milestone_tiers: AffiliateProgramMilestoneTier[];
  influencer_note: string;
  payout_note: string;
};

export type PublicPricingPlanCard = {
  title: string;
  headline: string;
  summary: string;
  bullets: string[];
};

export type PublicPricingSkuEntry = {
  stripe_key: `${PaidPlanTier}:${ModuleScope}`;
  label: string;
  amount_gbp: number;
  minor_units: number;
  price_text: string;
  billing_model: "annual_one_time";
  note: string;
  seat_hint: string;
};

export type PublicPricingCatalog = {
  version: 1;
  plan_cards: {
    free: PublicPricingPlanCard;
    trial: PublicPricingPlanCard;
    pro: PublicPricingPlanCard;
    team: PublicPricingPlanCard;
    enterprise: PublicPricingPlanCard;
  };
  skus: Record<PaidPlanTier, Record<ModuleScope, PublicPricingSkuEntry>>;
  notes: {
    free_trial: string;
    annual_checkout: string;
    enterprise_sizing: string;
  };
  affiliate_program: PublicAffiliateProgram;
};

const PAID_TIERS: PaidPlanTier[] = ["pro", "team", "enterprise"];
const MODULE_SCOPES: ModuleScope[] = ["narrate", "memorybank", "bundle"];

export const DEFAULT_PUBLIC_PRICING_CATALOG: PublicPricingCatalog = {
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
        "Includes the frontend/backend integration workflow and core PG validation tooling"
      ]
    },
    team: {
      title: "Team",
      headline: "From £69/year",
      summary: "Starter team packages with shared governance, kept modest for small companies.",
      bullets: [
        "Memory-bank: £69/year, Narrate: £79/year, Bundle: £119/year",
        "Starter package typically up to 5 seats, with 10 devices per licensed user and 200 Memory-bank projects",
        "Includes the frontend/backend integration workflow plus Slack-backed team governance"
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
      narrate: {
        stripe_key: "pro:narrate",
        label: "Pro Narrate Annual",
        amount_gbp: 22,
        minor_units: 2200,
        price_text: "£22 / year",
        billing_model: "annual_one_time",
        note: "Individual Narrate access for one year.",
        seat_hint: "Single-user annual access."
      },
      memorybank: {
        stripe_key: "pro:memorybank",
        label: "Pro Memory-bank Annual",
        amount_gbp: 18,
        minor_units: 1800,
        price_text: "£18 / year",
        billing_model: "annual_one_time",
        note: "Individual Memory-bank workflow access for one year.",
        seat_hint: "Single-user annual access."
      },
      bundle: {
        stripe_key: "pro:bundle",
        label: "Pro Bundle Annual",
        amount_gbp: 32,
        minor_units: 3200,
        price_text: "£32 / year",
        billing_model: "annual_one_time",
        note: "Narrate plus Memory-bank together on one annual purchase.",
        seat_hint: "Single-user annual access."
      }
    },
    team: {
      narrate: {
        stripe_key: "team:narrate",
        label: "Team Narrate Annual",
        amount_gbp: 79,
        minor_units: 7900,
        price_text: "£79 / year",
        billing_model: "annual_one_time",
        note: "Starter team Narrate package with shared governance.",
        seat_hint: "Base package, typically up to 5 seats."
      },
      memorybank: {
        stripe_key: "team:memorybank",
        label: "Team Memory-bank Annual",
        amount_gbp: 69,
        minor_units: 6900,
        price_text: "£69 / year",
        billing_model: "annual_one_time",
        note: "Starter team Memory-bank package for shared continuity.",
        seat_hint: "Base package, typically up to 5 seats."
      },
      bundle: {
        stripe_key: "team:bundle",
        label: "Team Bundle Annual",
        amount_gbp: 119,
        minor_units: 11900,
        price_text: "£119 / year",
        billing_model: "annual_one_time",
        note: "Starter team bundle for both modules together.",
        seat_hint: "Base package, typically up to 5 seats."
      }
    },
    enterprise: {
      narrate: {
        stripe_key: "enterprise:narrate",
        label: "Enterprise Narrate Annual",
        amount_gbp: 199,
        minor_units: 19900,
        price_text: "From £199 / year",
        billing_model: "annual_one_time",
        note: "Base enterprise Narrate package; larger size is priced manually.",
        seat_hint: "Base package, final amount depends on rollout size."
      },
      memorybank: {
        stripe_key: "enterprise:memorybank",
        label: "Enterprise Memory-bank Annual",
        amount_gbp: 169,
        minor_units: 16900,
        price_text: "From £169 / year",
        billing_model: "annual_one_time",
        note: "Base enterprise Memory-bank package; larger size is priced manually.",
        seat_hint: "Base package, final amount depends on rollout size."
      },
      bundle: {
        stripe_key: "enterprise:bundle",
        label: "Enterprise Bundle Annual",
        amount_gbp: 299,
        minor_units: 29900,
        price_text: "From £299 / year",
        billing_model: "annual_one_time",
        note: "Base enterprise bundle; larger size is priced manually.",
        seat_hint: "Base package, final amount depends on rollout size."
      }
    }
  },
  notes: {
    free_trial:
      "Free and Trial / EDU do not need Stripe products. Paid access is sold as annual plan-plus-module SKUs, and the visible pricing can be edited from the admin board. The frontend/backend integration workflow is included from Pro upward, while Free and Trial stay out of that paid workflow surface.",
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

export function defaultPricingCatalogRaw(): string {
  return JSON.stringify(DEFAULT_PUBLIC_PRICING_CATALOG, null, 2);
}

export function parsePricingCatalogRaw(raw: string): PublicPricingCatalog {
  const trimmed = raw.trim();
  if (!trimmed) {
    return cloneDefaultCatalog();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("pricing_catalog_raw must be valid JSON object text.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("pricing_catalog_raw must be a JSON object.");
  }
  return coerceCatalog(parsed as Record<string, unknown>);
}

function cloneDefaultCatalog(): PublicPricingCatalog {
  return JSON.parse(JSON.stringify(DEFAULT_PUBLIC_PRICING_CATALOG)) as PublicPricingCatalog;
}

function coerceCatalog(source: Record<string, unknown>): PublicPricingCatalog {
  const defaults = cloneDefaultCatalog();
  const planCards = asObject(source.plan_cards);
  const skus = asObject(source.skus);
  const notes = asObject(source.notes);
  return {
    version: 1,
    plan_cards: {
      free: coercePlanCard(asObject(planCards.free), defaults.plan_cards.free),
      trial: coercePlanCard(asObject(planCards.trial), defaults.plan_cards.trial),
      pro: coercePlanCard(asObject(planCards.pro), defaults.plan_cards.pro),
      team: coercePlanCard(asObject(planCards.team), defaults.plan_cards.team),
      enterprise: coercePlanCard(asObject(planCards.enterprise), defaults.plan_cards.enterprise)
    },
    skus: Object.fromEntries(
      PAID_TIERS.map((tier) => [
        tier,
        Object.fromEntries(
          MODULE_SCOPES.map((moduleScope) => {
            const sourceSku = asObject(asObject(skus[tier])[moduleScope]);
            const defaultSku = defaults.skus[tier][moduleScope];
            return [moduleScope, coerceSkuEntry(sourceSku, defaultSku)];
          })
        ) as Record<ModuleScope, PublicPricingSkuEntry>
      ])
    ) as Record<PaidPlanTier, Record<ModuleScope, PublicPricingSkuEntry>>,
    notes: {
      free_trial: coerceString(notes.free_trial, defaults.notes.free_trial),
      annual_checkout: coerceString(notes.annual_checkout, defaults.notes.annual_checkout),
      enterprise_sizing: coerceString(notes.enterprise_sizing, defaults.notes.enterprise_sizing)
    },
    affiliate_program: coerceAffiliateProgram(asObject(source.affiliate_program), defaults.affiliate_program)
  };
}

function coerceAffiliateProgram(
  source: Record<string, unknown>,
  fallback: PublicAffiliateProgram
): PublicAffiliateProgram {
  const tiers = Array.isArray(source.milestone_tiers) ? source.milestone_tiers : [];
  const milestoneTiers = tiers
    .map((item) => coerceAffiliateMilestone(asObject(item), null))
    .filter((item): item is AffiliateProgramMilestoneTier => Boolean(item))
    .sort((left, right) => left.paid_referrals - right.paid_referrals);
  return {
    enabled: coerceBoolean(source.enabled, fallback.enabled),
    buyer_discount_minor_units: coerceInteger(
      source.buyer_discount_minor_units,
      fallback.buyer_discount_minor_units
    ),
    buyer_discount_percent_bps: coerceInteger(
      source.buyer_discount_percent_bps,
      fallback.buyer_discount_percent_bps
    ),
    buyer_discount_text: coerceString(source.buyer_discount_text, fallback.buyer_discount_text),
    referral_minimum_commission_minor_units: coerceInteger(
      source.referral_minimum_commission_minor_units,
      fallback.referral_minimum_commission_minor_units
    ),
    affiliate_minimum_commission_minor_units: coerceInteger(
      source.affiliate_minimum_commission_minor_units,
      fallback.affiliate_minimum_commission_minor_units
    ),
    payout_hold_days: coerceInteger(
      source.payout_hold_days,
      fallback.payout_hold_days
    ),
    default_commission_rate_bps: coerceInteger(
      source.default_commission_rate_bps,
      fallback.default_commission_rate_bps
    ),
    milestone_tiers: milestoneTiers.length ? milestoneTiers : fallback.milestone_tiers,
    influencer_note: coerceString(source.influencer_note, fallback.influencer_note),
    payout_note: coerceString(source.payout_note, fallback.payout_note)
  };
}

function coerceAffiliateMilestone(
  source: Record<string, unknown>,
  fallback: AffiliateProgramMilestoneTier | null
): AffiliateProgramMilestoneTier | null {
  const paidReferrals = coerceInteger(source.paid_referrals, fallback?.paid_referrals ?? 0);
  const bonusCommissionBps = coerceInteger(
    source.bonus_commission_bps,
    fallback?.bonus_commission_bps ?? 0
  );
  const unlocks = coerceString(source.unlocks, fallback?.unlocks ?? "");
  if (paidReferrals <= 0 || bonusCommissionBps < 0 || !unlocks) {
    return fallback;
  }
  return {
    paid_referrals: paidReferrals,
    bonus_commission_bps: bonusCommissionBps,
    unlocks
  };
}

function coercePlanCard(
  source: Record<string, unknown>,
  fallback: PublicPricingPlanCard
): PublicPricingPlanCard {
  return {
    title: coerceString(source.title, fallback.title),
    headline: coerceString(source.headline, fallback.headline),
    summary: coerceString(source.summary, fallback.summary),
    bullets: coerceStringList(source.bullets, fallback.bullets)
  };
}

function coerceSkuEntry(
  source: Record<string, unknown>,
  fallback: PublicPricingSkuEntry
): PublicPricingSkuEntry {
  const amount = coerceNumber(source.amount_gbp, fallback.amount_gbp);
  const minorUnits = coerceInteger(source.minor_units, Math.round(amount * 100));
  const priceText = coerceString(source.price_text, fallback.price_text);
  return {
    stripe_key: fallback.stripe_key,
    label: coerceString(source.label, fallback.label),
    amount_gbp: amount,
    minor_units: minorUnits,
    price_text: priceText,
    billing_model: "annual_one_time",
    note: coerceString(source.note, fallback.note),
    seat_hint: coerceString(source.seat_hint, fallback.seat_hint)
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function coerceString(value: unknown, fallback: string): string {
  const next = typeof value === "string" ? value.trim() : "";
  return next || fallback;
}

function coerceStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return items.length ? items : fallback;
}

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Number(value.toFixed(2));
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function coerceInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}
