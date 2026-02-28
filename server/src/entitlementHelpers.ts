/**
 * entitlementHelpers.ts — Entitlement, plan resolution, device,
 * quota, token signing, and provider-policy functions.
 * Extracted from index.ts for COD-LIMIT-001 compliance.
 */

import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { addHours, addYears, normalizeHostList } from "./serverUtils";
import { PLAN_RULES } from "./rules";
import { hasActiveTeamSeat } from "./teamHelpers";
import {
  PlanTier,
  PaidPlanTier,
  ModuleScope,
  ProjectQuotaRecord,
  StoreState,
  SubscriptionRecord
} from "./types";

/* ── EntitlementClaimPayload type (re-exported for callers) ── */

export interface EntitlementClaimPayload {
  sub: string;
  install_id: string;
  plan: PlanTier;
  features: {
    edu_view: boolean;
    export: boolean;
    change_report: boolean;
    memorybank: boolean;
  };
  modules: Array<"narrate" | "memorybank" | "bundle">;
  projects_allowed: number;
  projects_used: number;
  trial_expires_at: string | null;
  refund_window_ends_at: string | null;
  token_max_ttl_hours: number;
  provider_policy: {
    local_only: boolean;
    byo_allowed: boolean;
    allowlist: string[];
    denylist: string[];
  };
  iat: number;
  exp: number;
}

/* ── Plan resolution ──────────────────────────────────────── */

export function resolveEffectivePlan(
  state: StoreState,
  userId: string,
  now: Date
): { plan: PlanTier; subscription?: SubscriptionRecord; trial?: StoreState["trials"][number] } {
  const activeSubscription = state.subscriptions
    .filter((item) => item.user_id === userId && item.status === "active")
    .find((item) => {
      if (new Date(item.ends_at).getTime() <= now.getTime()) {
        return false;
      }
      if (!item.team_id) {
        return true;
      }
      return hasActiveTeamSeat(state, item.team_id, userId);
    });
  if (activeSubscription) {
    return { plan: activeSubscription.plan_id, subscription: activeSubscription };
  }

  const activeTrial = state.trials.find(
    (item) => item.user_id === userId && new Date(item.trial_expires_at).getTime() > now.getTime()
  );
  if (activeTrial) {
    return { plan: "trial", trial: activeTrial };
  }
  return { plan: "free" };
}

export function resolveModules(
  state: StoreState,
  userId: string,
  plan: PlanTier,
  now: Date
): Array<"narrate" | "memorybank" | "bundle"> {
  if (plan === "free" || plan === "trial") {
    return ["narrate"];
  }

  const activeEntitlement = state.product_entitlements.find(
    (item) =>
      item.user_id === userId &&
      item.status === "active" &&
      new Date(item.ends_at).getTime() > now.getTime()
  );
  if (!activeEntitlement) {
    return ["narrate"];
  }

  const modules: Array<"narrate" | "memorybank" | "bundle"> = [];
  if (activeEntitlement.narrate_enabled) {
    modules.push("narrate");
  }
  if (activeEntitlement.memorybank_enabled) {
    modules.push("memorybank");
  }
  if (activeEntitlement.bundle_enabled) {
    modules.push("bundle");
  }
  return modules.length > 0 ? modules : ["narrate"];
}

/* ── Entitlement claims builder ───────────────────────────── */

export function buildEntitlementClaims(
  state: StoreState,
  userId: string,
  installId: string
): EntitlementClaimPayload {
  const now = new Date();
  const planState = resolveEffectivePlan(state, userId, now);
  const plan = planState.plan;
  const modules = resolveModules(state, userId, plan, now);
  const features = {
    edu_view: plan !== "free",
    export: PLAN_RULES[plan].can_export,
    change_report: PLAN_RULES[plan].can_change_report,
    memorybank: modules.includes("memorybank") || modules.includes("bundle")
  };

  const quota = ensureQuotaRecord(state, userId, plan);
  const tokenTtlHours = resolveTokenTtlHours(plan, planState.subscription, now);
  const exp = Math.floor(addHours(now, tokenTtlHours).getTime() / 1000);

  return {
    sub: userId,
    install_id: installId,
    plan,
    features,
    modules,
    projects_allowed: quota.projects_allowed,
    projects_used: quota.projects_used,
    trial_expires_at: planState.trial?.trial_expires_at ?? null,
    refund_window_ends_at: planState.subscription?.refund_window_ends_at ?? null,
    token_max_ttl_hours: tokenTtlHours,
    provider_policy: resolveProviderPolicy(state, userId, planState.subscription?.team_id ?? null),
    iat: Math.floor(now.getTime() / 1000),
    exp
  };
}

/* ── Device records ───────────────────────────────────────── */

export function ensureDeviceRecord(
  state: StoreState,
  userId: string,
  installId: string,
  deviceLabel: string,
  deviceLimit: number
): void {
  const existing = state.devices.find(
    (item) => item.user_id === userId && item.install_id === installId
  );
  if (existing) {
    if (existing.revoked_at !== null) {
      throw new Error("device revoked");
    }
    existing.last_seen_at = new Date().toISOString();
    existing.device_label = deviceLabel;
    return;
  }

  const activeCount = state.devices.filter(
    (item) => item.user_id === userId && item.revoked_at === null
  ).length;
  if (activeCount >= deviceLimit) {
    throw new Error("device limit reached");
  }
  state.devices.push({
    id: randomUUID(),
    user_id: userId,
    install_id: installId,
    device_label: deviceLabel,
    last_seen_at: new Date().toISOString(),
    revoked_at: null
  });
}

/* ── Quota records ─────────────────────────────────────────── */

export function ensureQuotaRecord(
  state: StoreState,
  userId: string,
  plan: PlanTier
): ProjectQuotaRecord {
  const now = new Date();
  const allowed = PLAN_RULES[plan].projects_allowed_memorybank;
  let record = state.project_quotas.find(
    (item) => item.user_id === userId && item.scope === "memorybank"
  );
  if (!record) {
    record = {
      id: randomUUID(),
      user_id: userId,
      scope: "memorybank",
      period_start: now.toISOString(),
      period_end: addYears(now, 1).toISOString(),
      projects_allowed: allowed,
      projects_used: 0,
      updated_at: now.toISOString()
    };
    state.project_quotas.push(record);
    return record;
  }

  if (new Date(record.period_end).getTime() <= now.getTime()) {
    record.period_start = now.toISOString();
    record.period_end = addYears(now, 1).toISOString();
    record.projects_used = 0;
  }

  record.projects_allowed = allowed;
  record.updated_at = now.toISOString();
  return record;
}

/* ── Token TTL / signing ──────────────────────────────────── */

export function resolveTokenTtlHours(
  plan: PlanTier,
  subscription: SubscriptionRecord | undefined,
  now: Date
): number {
  if (plan === "free") {
    return 12;
  }
  if (plan === "trial") {
    return 24;
  }
  if (subscription && new Date(subscription.refund_window_ends_at).getTime() > now.getTime()) {
    return 24;
  }
  return 24 * 14;
}

export function signEntitlementToken(
  state: StoreState,
  claims: EntitlementClaimPayload
): string {
  return jwt.sign(claims, state.keys.private_key_pem, {
    algorithm: state.keys.alg,
    keyid: "main"
  });
}

/* ── Provider policy ──────────────────────────────────────── */

export function resolveProviderPolicy(
  state: StoreState,
  userId: string,
  teamId: string | null
): EntitlementClaimPayload["provider_policy"] {
  const userPolicy = state.provider_policies.find(
    (item) => item.scope_type === "user" && item.scope_id === userId
  );
  if (userPolicy) {
    return {
      local_only: userPolicy.local_only,
      byo_allowed: userPolicy.byo_allowed,
      allowlist: [...userPolicy.allowlist],
      denylist: [...userPolicy.denylist]
    };
  }

  if (teamId) {
    const teamPolicy = state.provider_policies.find(
      (item) => item.scope_type === "team" && item.scope_id === teamId
    );
    if (teamPolicy) {
      return {
        local_only: teamPolicy.local_only,
        byo_allowed: teamPolicy.byo_allowed,
        allowlist: [...teamPolicy.allowlist],
        denylist: [...teamPolicy.denylist]
      };
    }
  }

  return {
    local_only: false,
    byo_allowed: true,
    allowlist: [],
    denylist: []
  };
}

export function normalizePolicyInput(input: {
  local_only?: boolean;
  byo_allowed?: boolean;
  allowlist?: string[];
  denylist?: string[];
}): EntitlementClaimPayload["provider_policy"] {
  return {
    local_only: Boolean(input.local_only),
    byo_allowed: input.byo_allowed ?? true,
    allowlist: normalizeHostList(input.allowlist),
    denylist: normalizeHostList(input.denylist)
  };
}
