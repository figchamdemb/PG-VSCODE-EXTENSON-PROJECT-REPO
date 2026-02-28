import { ModuleScope, PaidPlanTier, StoreState } from "./types";

export interface GrantSubscriptionInput {
  userId: string;
  planId: PaidPlanTier;
  moduleScope: ModuleScope;
  years: number;
  source: "stripe" | "offline" | "manual";
  teamId?: string | null;
}

interface ApplySubscriptionGrantDependencies {
  refundWindowDays: number;
  addYears: (date: Date, years: number) => Date;
  addDays: (date: Date, days: number) => Date;
  ensureQuotaRecord: (state: StoreState, userId: string, planId: PaidPlanTier) => void;
  createId: () => string;
}

export function applySubscriptionGrant(
  state: StoreState,
  input: GrantSubscriptionInput,
  deps: ApplySubscriptionGrantDependencies
): string {
  const now = new Date();
  const nowIso = now.toISOString();
  const endsAt = deps.addYears(now, input.years).toISOString();
  const refundEndsAt = deps.addDays(now, deps.refundWindowDays).toISOString();

  expireActiveSubscriptions(state, input.userId);
  insertSubscription(state, input, nowIso, endsAt, refundEndsAt, deps.createId);
  replaceEntitlements(state, input, nowIso, endsAt, deps.createId);
  deps.ensureQuotaRecord(state, input.userId, input.planId);
  return endsAt;
}

function expireActiveSubscriptions(state: StoreState, userId: string): void {
  state.subscriptions = state.subscriptions.map((item) =>
    item.user_id === userId && item.status === "active" ? { ...item, status: "expired" as const } : item
  );
  state.product_entitlements = state.product_entitlements.map((item) =>
    item.user_id === userId && item.status === "active" ? { ...item, status: "expired" as const } : item
  );
}

function insertSubscription(
  state: StoreState,
  input: GrantSubscriptionInput,
  nowIso: string,
  endsAt: string,
  refundEndsAt: string,
  createId: () => string
): void {
  state.subscriptions.push({
    id: createId(),
    user_id: input.userId,
    plan_id: input.planId,
    team_id: input.teamId ?? null,
    status: "active",
    starts_at: nowIso,
    ends_at: endsAt,
    revoked_at: null,
    refund_window_ends_at: refundEndsAt,
    source: input.source,
    created_at: nowIso
  });
}

function replaceEntitlements(
  state: StoreState,
  input: GrantSubscriptionInput,
  nowIso: string,
  endsAt: string,
  createId: () => string
): void {
  const narrateEnabled = input.moduleScope === "narrate" || input.moduleScope === "bundle";
  const memorybankEnabled = input.moduleScope === "memorybank" || input.moduleScope === "bundle";
  state.product_entitlements.push({
    id: createId(),
    user_id: input.userId,
    narrate_enabled: narrateEnabled,
    memorybank_enabled: memorybankEnabled,
    bundle_enabled: input.moduleScope === "bundle",
    starts_at: nowIso,
    ends_at: endsAt,
    status: "active",
    created_at: nowIso
  });
}
