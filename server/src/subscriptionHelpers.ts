import { randomBytes, randomUUID } from "crypto";
import { StateStore } from "./store";
import {
  addDays,
  addYears,
  normalizeEmail,
  toErrorMessage
} from "./serverUtils";
import { ensureQuotaRecord, EntitlementClaimPayload } from "./entitlementHelpers";
import {
  applySubscriptionGrant as applySubscriptionGrantImpl,
  GrantSubscriptionInput
} from "./subscriptionGrant";
import {
  ModuleScope,
  PaidPlanTier,
  StoreState
} from "./types";

export interface CreateSubscriptionHelpersDeps {
  store: StateStore;
  refundWindowDays: number;
  defaultAffiliateRateBps: number;
  stripePriceMap: Record<string, string | undefined>;
}

type GrantByEmailInput = {
  email: string;
  planId: PaidPlanTier;
  moduleScope: ModuleScope;
  years: number;
  source: "stripe" | "offline" | "manual";
  teamId?: string | null;
};

// ---------------------------------------------------------------------------
// Factory – thin delegation layer.
// ---------------------------------------------------------------------------
export function createSubscriptionHelpers(deps: CreateSubscriptionHelpersDeps) {
  return {
    grantSubscriptionByEmail: (input: GrantByEmailInput) =>
      grantSubscriptionByEmail(deps, input),
    grantSubscriptionByUserId: (input: GrantSubscriptionInput) =>
      grantSubscriptionByUserId(deps, input),
    generateCode,
    clampCommissionRate: (value: number) => clampCommissionRate(deps, value),
    recordAffiliatePaidConversion: (
      code: string, buyerEmail: string, orderId: string, grossAmountCents: number
    ) => recordAffiliatePaidConversion(deps, code, buyerEmail, orderId, grossAmountCents),
    upsertProviderPolicy: (
      scopeType: "user" | "team", scopeId: string,
      policy: EntitlementClaimPayload["provider_policy"]
    ) => upsertProviderPolicy(deps, scopeType, scopeId, policy),
    resolveStripePriceId: (planId: PaidPlanTier, moduleScope: ModuleScope) =>
      resolveStripePriceId(deps, planId, moduleScope),
  };
}

// ---------------------------------------------------------------------------
// Implementation functions (module-level, not exported).
// ---------------------------------------------------------------------------

async function grantSubscriptionByEmail(
  deps: CreateSubscriptionHelpersDeps,
  input: GrantByEmailInput
): Promise<{ userId: string; endsAt: string }> {
  let userId = "";
  let endsAt = "";

  await deps.store.update((state) => {
    const nowIso = new Date().toISOString();
    let user = state.users.find((item) => item.email === input.email);
    if (!user) {
      user = {
        id: randomUUID(),
        email: input.email,
        created_at: nowIso,
        last_login_at: nowIso
      };
      state.users.push(user);
    } else {
      user.last_login_at = nowIso;
    }

    userId = user.id;
    endsAt = applySubscriptionGrant(deps, state, {
      userId: user.id,
      planId: input.planId,
      moduleScope: input.moduleScope,
      years: input.years,
      source: input.source,
      teamId: input.teamId ?? null
    });
  });

  return { userId, endsAt };
}

async function grantSubscriptionByUserId(
  deps: CreateSubscriptionHelpersDeps,
  input: GrantSubscriptionInput
): Promise<{ endsAt: string }> {
  let endsAt = "";
  await deps.store.update((state) => {
    const user = state.users.find((item) => item.id === input.userId);
    if (!user) {
      throw new Error("user not found");
    }
    user.last_login_at = new Date().toISOString();
    endsAt = applySubscriptionGrant(deps, state, input);
  });
  return { endsAt };
}

function applySubscriptionGrant(
  deps: CreateSubscriptionHelpersDeps,
  state: StoreState,
  input: GrantSubscriptionInput
): string {
  return applySubscriptionGrantImpl(state, input, {
    refundWindowDays: deps.refundWindowDays,
    addYears,
    addDays,
    ensureQuotaRecord,
    createId: () => randomUUID()
  });
}

function generateCode(prefix: string): string {
  const chunk = () => randomBytes(2).toString("hex").toUpperCase();
  return `${prefix}-${chunk()}-${chunk()}-${chunk()}`;
}

function clampCommissionRate(
  deps: CreateSubscriptionHelpersDeps,
  value: number
): number {
  if (!Number.isFinite(value)) {
    return deps.defaultAffiliateRateBps;
  }
  return Math.max(100, Math.min(3000, Math.floor(value)));
}

async function recordAffiliatePaidConversion(
  deps: CreateSubscriptionHelpersDeps,
  code: string,
  buyerEmail: string,
  orderId: string,
  grossAmountCents: number
): Promise<
  | { ok: true; conversionId: string; commissionAmountCents: number }
  | { ok: false; code: number; error: string }
> {
  const snapshot = deps.store.snapshot();
  const affiliate = snapshot.affiliate_codes.find(
    (item) => item.code === code && item.status === "active"
  );
  if (!affiliate) {
    return { ok: false, code: 404, error: "affiliate code not found" };
  }
  const existingOrder = snapshot.affiliate_conversions.find(
    (item) => item.order_id === orderId
  );
  if (existingOrder) {
    return {
      ok: true,
      conversionId: existingOrder.id,
      commissionAmountCents: existingOrder.commission_amount_cents
    };
  }

  let conversionId = "";
  let commissionAmountCents = 0;
  await deps.store.update((state) => {
    let buyer = state.users.find((item) => item.email === buyerEmail);
    if (!buyer) {
      buyer = {
        id: randomUUID(),
        email: buyerEmail,
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      };
      state.users.push(buyer);
    }
    const currentAffiliate = state.affiliate_codes.find(
      (item) => item.code === code && item.status === "active"
    );
    if (!currentAffiliate) {
      throw new Error("affiliate code not found");
    }

    conversionId = randomUUID();
    commissionAmountCents = Math.floor(
      (grossAmountCents * currentAffiliate.commission_rate_bps) / 10000
    );
    state.affiliate_conversions.push({
      id: conversionId,
      affiliate_user_id: currentAffiliate.user_id,
      buyer_user_id: buyer.id,
      ref_code: code,
      status: "paid_confirmed",
      order_id: orderId,
      gross_amount_cents: grossAmountCents,
      commission_amount_cents: commissionAmountCents,
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      payout_id: null
    });
  });

  return { ok: true, conversionId, commissionAmountCents };
}

async function upsertProviderPolicy(
  deps: CreateSubscriptionHelpersDeps,
  scopeType: "user" | "team",
  scopeId: string,
  policy: EntitlementClaimPayload["provider_policy"]
): Promise<void> {
  await deps.store.update((state) => {
    const existing = state.provider_policies.find(
      (item) => item.scope_type === scopeType && item.scope_id === scopeId
    );
    if (existing) {
      existing.local_only = policy.local_only;
      existing.byo_allowed = policy.byo_allowed;
      existing.allowlist = [...policy.allowlist];
      existing.denylist = [...policy.denylist];
      existing.updated_at = new Date().toISOString();
      return;
    }
    state.provider_policies.push({
      id: randomUUID(),
      scope_type: scopeType,
      scope_id: scopeId,
      local_only: policy.local_only,
      byo_allowed: policy.byo_allowed,
      allowlist: [...policy.allowlist],
      denylist: [...policy.denylist],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  });
}

function resolveStripePriceId(
  deps: CreateSubscriptionHelpersDeps,
  planId: PaidPlanTier,
  moduleScope: ModuleScope
): string | undefined {
  return deps.stripePriceMap[`${planId}:${moduleScope}`.toLowerCase()];
}
