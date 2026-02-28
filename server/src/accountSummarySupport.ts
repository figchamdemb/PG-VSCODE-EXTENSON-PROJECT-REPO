import { PlanTier, ProjectQuotaRecord, StoreState, UserRecord } from "./types";

export type AccountTeamSummary = {
  team_key: string;
  plan_id: StoreState["teams"][number]["plan_id"];
  module_scope: StoreState["teams"][number]["module_scope"];
  role: StoreState["team_memberships"][number]["role"];
  seat_limit: number;
  seats_used: number;
  seats_remaining: number;
};

export type AccountBillingSnapshot = {
  activeSubscription: StoreState["subscriptions"][number] | null;
  latestTrial: StoreState["trials"][number] | null;
  activeRefundRequest: StoreState["refund_requests"][number] | null;
};

export type AccountSummaryAdminSnapshot = {
  isSuperAdmin: boolean;
  canAccessAdminBoard: boolean;
  permissions: string[];
};

export type AccountSummaryClaims = {
  plan: PlanTier;
  features: {
    edu_view: boolean;
    export: boolean;
    change_report: boolean;
    memorybank: boolean;
  };
  modules: Array<"narrate" | "memorybank" | "bundle">;
};

export type AccountSummaryPayloadInput = {
  user: UserRecord;
  now: Date;
  claims: AccountSummaryClaims;
  planState: { subscription?: { refund_window_ends_at: string } };
  quota: ProjectQuotaRecord;
  teams: AccountTeamSummary[];
  governanceTeamScopes: Array<{ team_key: string; plan_id: PlanTier; can_manage: boolean }>;
  billing: AccountBillingSnapshot;
  admin: AccountSummaryAdminSnapshot;
};

type AccountSummaryBuildOptions = {
  supportsGovernancePlan: (plan: PlanTier) => boolean;
  canManageTeamRole: (role: StoreState["team_memberships"][number]["role"]) => boolean;
  governanceSeatPriceCents: number;
  adminRoutePrefix: string;
  cloudflareAccessEnabled: boolean;
};

export type AdminBoardAccessContext = {
  mode: "db" | "key";
  userEmail?: string;
};

type ResolveEffectivePlanFn = (
  state: StoreState,
  userId: string,
  now: Date
) => { plan: PlanTier };

type PlanRulesMap = {
  free: unknown;
  trial: unknown;
  pro: unknown;
  team: unknown;
  enterprise: unknown;
};

export function buildCatalogPlansResponse(
  planRules: PlanRulesMap,
  governanceAllowPro: boolean,
  governanceSlackAddonSeatPriceCents: number
) {
  return {
    plans: [
      {
        id: "free",
        billing_period: "none",
        features: planRules.free,
        governance: { enabled: false, slack_addon_available: false }
      },
      {
        id: "trial",
        billing_period: "48h",
        features: planRules.trial,
        governance: { enabled: false, slack_addon_available: false }
      },
      {
        id: "pro",
        billing_period: "annual",
        features: planRules.pro,
        governance: { enabled: governanceAllowPro, slack_addon_available: governanceAllowPro }
      },
      {
        id: "team",
        billing_period: "annual",
        features: planRules.team,
        governance: { enabled: true, slack_addon_available: true }
      },
      {
        id: "enterprise",
        billing_period: "annual",
        features: planRules.enterprise,
        governance: { enabled: true, slack_addon_available: true }
      }
    ],
    add_ons: [
      {
        id: "slack_governance_bridge",
        label: "Slack Governance Bridge",
        billing: "per-seat-month",
        price_cents_per_seat_month: governanceSlackAddonSeatPriceCents,
        enabled_for_plans: governanceAllowPro ? ["pro", "team", "enterprise"] : ["team", "enterprise"]
      }
    ]
  };
}

export function buildAccountTeamSummaries(snapshot: StoreState, userId: string): AccountTeamSummary[] {
  const activeMemberships = snapshot.team_memberships.filter(
    (item) => item.user_id === userId && item.status === "active" && item.revoked_at === null
  );
  return activeMemberships
    .map((membership) => {
      const team = snapshot.teams.find((item) => item.id === membership.team_id);
      if (!team) {
        return null;
      }
      const seatsUsed = snapshot.team_memberships.filter(
        (item) => item.team_id === team.id && item.status === "active"
      ).length;
      return {
        team_key: team.team_key,
        plan_id: team.plan_id,
        module_scope: team.module_scope,
        role: membership.role,
        seat_limit: team.seat_limit,
        seats_used: seatsUsed,
        seats_remaining: Math.max(0, team.seat_limit - seatsUsed)
      };
    })
    .filter((item): item is AccountTeamSummary => item !== null);
}

export function buildAccountBillingSnapshot(snapshot: StoreState, userId: string): AccountBillingSnapshot {
  const userSubscriptions = snapshot.subscriptions
    .filter((item) => item.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const userRefundRequests = snapshot.refund_requests
    .filter((item) => item.user_id === userId)
    .sort((a, b) => b.requested_at.localeCompare(a.requested_at));
  const latestTrial =
    snapshot.trials
      .filter((item) => item.user_id === userId)
      .sort((a, b) => b.trial_started_at.localeCompare(a.trial_started_at))[0] ?? null;
  return {
    activeSubscription: userSubscriptions.find((item) => item.status === "active") ?? null,
    latestTrial,
    activeRefundRequest: userRefundRequests.find((item) => item.status === "requested") ?? null
  };
}

export function buildGovernanceTeamScopes(
  teams: AccountTeamSummary[],
  supportsGovernancePlan: (plan: PlanTier) => boolean,
  canManageTeamRole: (role: StoreState["team_memberships"][number]["role"]) => boolean
) {
  return teams
    .filter((team) => supportsGovernancePlan(team.plan_id as PlanTier))
    .map((team) => ({
      team_key: team.team_key,
      plan_id: team.plan_id as PlanTier,
      can_manage: canManageTeamRole(team.role)
    }));
}

export function buildAccountSummaryPayload(
  input: AccountSummaryPayloadInput,
  options: AccountSummaryBuildOptions
) {
  const trial = buildAccountTrialSummary(input.billing.latestTrial, input.now);
  const subscription = buildAccountSubscriptionSummary(input.billing.activeSubscription);
  const governance = buildAccountGovernanceSummary(
    input.claims.plan,
    input.governanceTeamScopes,
    options.supportsGovernancePlan,
    options.governanceSeatPriceCents
  );
  const refund = buildAccountRefundSummary(input.planState, input.billing.activeRefundRequest, input.now);
  return {
    ok: true,
    account: {
      user_id: input.user.id,
      email: input.user.email,
      created_at: input.user.created_at,
      last_login_at: input.user.last_login_at
    },
    plan: input.claims.plan,
    features: input.claims.features,
    modules: input.claims.modules,
    quota: buildAccountQuotaSummary(input.quota),
    trial,
    subscription,
    renewal: input.billing.activeSubscription ? { next_due_at: input.billing.activeSubscription.ends_at } : null,
    is_super_admin: input.admin.isSuperAdmin,
    can_access_admin_board: input.admin.canAccessAdminBoard,
    admin_route_prefix: input.admin.canAccessAdminBoard ? options.adminRoutePrefix : null,
    admin_cloudflare_access_enabled: options.cloudflareAccessEnabled,
    admin_permissions: input.admin.permissions,
    governance,
    refund,
    teams: input.teams,
    can_manage_team: input.teams.some((item) => options.canManageTeamRole(item.role))
  };
}

function buildAccountTrialSummary(latestTrial: StoreState["trials"][number] | null, now: Date) {
  if (!latestTrial) {
    return null;
  }
  return {
    started_at: latestTrial.trial_started_at,
    expires_at: latestTrial.trial_expires_at,
    is_active: new Date(latestTrial.trial_expires_at).getTime() > now.getTime()
  };
}

function buildAccountSubscriptionSummary(
  activeSubscription: StoreState["subscriptions"][number] | null
) {
  if (!activeSubscription) {
    return null;
  }
  return {
    id: activeSubscription.id,
    plan_id: activeSubscription.plan_id,
    status: activeSubscription.status,
    source: activeSubscription.source,
    starts_at: activeSubscription.starts_at,
    ends_at: activeSubscription.ends_at,
    refund_window_ends_at: activeSubscription.refund_window_ends_at,
    team_id: activeSubscription.team_id
  };
}

function buildAccountQuotaSummary(quota: ProjectQuotaRecord) {
  return {
    projects_allowed: quota.projects_allowed,
    projects_used: quota.projects_used,
    projects_remaining: Math.max(0, quota.projects_allowed - quota.projects_used)
  };
}

function buildAccountGovernanceSummary(
  plan: PlanTier,
  governanceTeamScopes: Array<{ team_key: string; plan_id: PlanTier; can_manage: boolean }>,
  supportsGovernancePlan: (plan: PlanTier) => boolean,
  governanceSeatPriceCents: number
) {
  return {
    enabled: supportsGovernancePlan(plan) || governanceTeamScopes.length > 0,
    current_plan_supported: supportsGovernancePlan(plan),
    team_scopes: governanceTeamScopes,
    slack_addon_seat_price_cents_per_month: governanceSeatPriceCents
  };
}

function buildAccountRefundSummary(
  planState: { subscription?: { refund_window_ends_at: string } },
  activeRefundRequest: StoreState["refund_requests"][number] | null,
  now: Date
) {
  return {
    active_request: activeRefundRequest,
    can_request:
      planState.subscription !== undefined &&
      new Date(planState.subscription.refund_window_ends_at).getTime() > now.getTime()
  };
}

export function buildAdminBoardSummaryResponse(
  snapshot: StoreState,
  now: Date,
  adminAccess: AdminBoardAccessContext,
  resolveEffectivePlan: ResolveEffectivePlanFn
) {
  const activeSubscriptions = snapshot.subscriptions.filter(
    (item) => item.status === "active" && new Date(item.ends_at).getTime() > now.getTime()
  );
  const paidUserIds = new Set(activeSubscriptions.map((item) => item.user_id));
  const openTickets = snapshot.support_tickets.filter(
    (item) => item.status === "open" || item.status === "in_progress"
  );
  const pendingOfflinePayments = snapshot.offline_payment_refs.filter(
    (item) => item.status === "pending" || item.status === "submitted"
  );
  const pendingRefunds = snapshot.refund_requests.filter((item) => item.status === "requested");
  const openMastermind = snapshot.mastermind_threads.filter((item) => item.status === "open");
  const pendingDecisionAcks = snapshot.governance_decision_acks.filter((item) => item.status === "pending");
  return {
    ok: true,
    admin: { email: adminAccess.userEmail ?? "key-admin", mode: adminAccess.mode },
    totals: {
      users_registered: snapshot.users.length,
      users_paid_active: paidUserIds.size,
      users_free_or_trial: Math.max(0, snapshot.users.length - paidUserIds.size),
      subscriptions_active: activeSubscriptions.length,
      support_tickets_open: openTickets.length,
      refunds_pending: pendingRefunds.length,
      offline_payments_pending: pendingOfflinePayments.length,
      governance_threads_open: openMastermind.length,
      governance_acks_pending: pendingDecisionAcks.length
    },
    recent_users: buildAdminRecentUsers(snapshot, now, paidUserIds, resolveEffectivePlan)
  };
}

function buildAdminRecentUsers(
  snapshot: StoreState,
  now: Date,
  paidUserIds: Set<string>,
  resolveEffectivePlan: ResolveEffectivePlanFn
) {
  return [...snapshot.users]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
      current_plan: resolveEffectivePlan(snapshot, user.id, now).plan,
      has_active_paid_subscription: paidUserIds.has(user.id)
    }));
}
