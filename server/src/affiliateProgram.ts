import { ModuleScope, PaidPlanTier } from "./types";
import { PublicPricingCatalog, PublicPricingSkuEntry } from "./pricingCatalog";

export type AffiliateMilestoneTier = {
  paid_referrals: number;
  bonus_commission_bps: number;
  unlocks: string;
};

export type AffiliateProgramConfig = {
  enabled: boolean;
  buyer_discount_minor_units: number;
  buyer_discount_percent_bps: number;
  buyer_discount_text: string;
  referral_minimum_commission_minor_units: number;
  affiliate_minimum_commission_minor_units: number;
  payout_hold_days: number;
  default_commission_rate_bps: number;
  milestone_tiers: AffiliateMilestoneTier[];
  influencer_note: string;
  payout_note: string;
};

export type AffiliateCodeKind = "referral" | "affiliate";

export type AffiliateProgressSummary = {
  paidReferralsCount: number;
  currentBonusBps: number;
  currentCommissionRateBps: number;
  currentTier: AffiliateMilestoneTier | null;
  nextTier: AffiliateMilestoneTier | null;
};

export function affiliateProgramFromCatalog(catalog: PublicPricingCatalog): AffiliateProgramConfig {
  return catalog.affiliate_program;
}

export function findAffiliateSku(
  catalog: PublicPricingCatalog,
  planId: PaidPlanTier,
  moduleScope: ModuleScope
): PublicPricingSkuEntry | null {
  return catalog.skus?.[planId]?.[moduleScope] ?? null;
}

export function resolveAffiliateCodeKind(code: string): AffiliateCodeKind {
  return code.trim().toUpperCase().startsWith("REF") ? "referral" : "affiliate";
}

export function resolveAffiliateCheckoutPricing(
  catalog: PublicPricingCatalog,
  sku: PublicPricingSkuEntry,
  hasAffiliateCode: boolean
): { buyerDiscountMinorUnits: number; finalMinorUnits: number } {
  const program = affiliateProgramFromCatalog(catalog);
  if (!program.enabled || !hasAffiliateCode) {
    return { buyerDiscountMinorUnits: 0, finalMinorUnits: sku.minor_units };
  }
  const fixedDiscount = Math.max(0, Math.min(program.buyer_discount_minor_units, sku.minor_units));
  const percentDiscount = Math.max(
    0,
    Math.min(Math.floor((sku.minor_units * program.buyer_discount_percent_bps) / 10000), sku.minor_units)
  );
  const buyerDiscountMinorUnits = Math.max(fixedDiscount, percentDiscount);
  return {
    buyerDiscountMinorUnits,
    finalMinorUnits: Math.max(0, sku.minor_units - buyerDiscountMinorUnits)
  };
}

export function summarizeAffiliateProgress(
  catalog: PublicPricingCatalog,
  baseCommissionRateBps: number,
  paidReferralsCount: number
): AffiliateProgressSummary {
  const program = affiliateProgramFromCatalog(catalog);
  const orderedTiers = [...program.milestone_tiers].sort(
    (left, right) => left.paid_referrals - right.paid_referrals
  );
  let currentTier: AffiliateMilestoneTier | null = null;
  for (const tier of orderedTiers) {
    if (paidReferralsCount >= tier.paid_referrals) {
      currentTier = tier;
    }
  }
  const nextTier = orderedTiers.find((tier) => tier.paid_referrals > paidReferralsCount) ?? null;
  const currentBonusBps = currentTier?.bonus_commission_bps ?? 0;
  return {
    paidReferralsCount,
    currentBonusBps,
    currentCommissionRateBps: Math.max(0, baseCommissionRateBps + currentBonusBps),
    currentTier,
    nextTier
  };
}

export function computeAffiliateCommission(params: {
  catalog: PublicPricingCatalog;
  baseCommissionRateBps: number;
  paidReferralsCountBefore: number;
  grossAmountCents: number;
  code: string;
}): { commissionAmountCents: number; effectiveCommissionRateBps: number; appliedTier: AffiliateMilestoneTier | null } {
  const { catalog, baseCommissionRateBps, paidReferralsCountBefore, grossAmountCents, code } = params;
  const program = affiliateProgramFromCatalog(catalog);
  const progress = summarizeAffiliateProgress(
    catalog,
    baseCommissionRateBps,
    paidReferralsCountBefore + 1
  );
  const codeKind = resolveAffiliateCodeKind(code);
  const variableCommission = Math.floor(
    (Math.max(0, grossAmountCents) * progress.currentCommissionRateBps) / 10000
  );
  const minimumCommission =
    codeKind === "referral"
      ? program.referral_minimum_commission_minor_units
      : program.affiliate_minimum_commission_minor_units;
  return {
    commissionAmountCents: Math.max(minimumCommission, variableCommission),
    effectiveCommissionRateBps: progress.currentCommissionRateBps,
    appliedTier: progress.currentTier
  };
}

export function isAffiliatePayoutEligible(
  catalog: PublicPricingCatalog,
  createdAtIso: string,
  now = new Date()
): boolean {
  const createdAt = new Date(createdAtIso).getTime();
  if (!Number.isFinite(createdAt)) {
    return false;
  }
  const holdMs = affiliateProgramFromCatalog(catalog).payout_hold_days * 24 * 60 * 60 * 1000;
  return createdAt + holdMs <= now.getTime();
}