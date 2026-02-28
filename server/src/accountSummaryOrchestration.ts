import {
  AccountSummaryAdminSnapshot,
  buildAccountBillingSnapshot,
  buildAccountSummaryPayload,
  buildAccountTeamSummaries,
  buildGovernanceTeamScopes,
  AccountSummaryClaims
} from "./accountSummarySupport";
import { PlanTier, ProjectQuotaRecord, StoreState, UserRecord } from "./types";

type ResolveEffectivePlanResult = {
  plan: PlanTier;
  subscription?: { refund_window_ends_at: string };
};

type BuildEntitlementClaimsFn = (
  state: StoreState,
  userId: string,
  installId: string
) => AccountSummaryClaims;

type ResolveEffectivePlanFn = (
  state: StoreState,
  userId: string,
  now: Date
) => ResolveEffectivePlanResult;

type EnsureQuotaRecordFn = (
  state: StoreState,
  userId: string,
  plan: PlanTier
) => ProjectQuotaRecord;

type SupportsGovernancePlanFn = (plan: PlanTier) => boolean;

type CanManageTeamRoleFn = (role: StoreState["team_memberships"][number]["role"]) => boolean;

type ResolveAdminSnapshotFn = (email: string) => Promise<AccountSummaryAdminSnapshot>;

type ResolvedAdminAccess = {
  isSuperAdmin: boolean;
  permissions: Set<string>;
};

type ResolveAdminAccessFromDbFn = (email: string) => Promise<ResolvedAdminAccess | null>;

export type BuildAccountSummaryResponseForUserInput = {
  user: UserRecord;
  snapshot: StoreState;
  now: Date;
  buildEntitlementClaims: BuildEntitlementClaimsFn;
  resolveEffectivePlan: ResolveEffectivePlanFn;
  ensureQuotaRecord: EnsureQuotaRecordFn;
  supportsGovernancePlan: SupportsGovernancePlanFn;
  canManageTeamRole: CanManageTeamRoleFn;
  resolveAdminSnapshot: ResolveAdminSnapshotFn;
  governanceSeatPriceCents: number;
  adminRoutePrefix: string;
  cloudflareAccessEnabled: boolean;
};

export type ResolveAccountSummaryAdminSnapshotInput = {
  email: string;
  getSuperAdminEmailSet: () => Promise<Set<string>>;
  resolveAdminAccessFromDb: ResolveAdminAccessFromDbFn;
  boardReadPermission: string;
  safeLogWarn: (message: string, context: Record<string, unknown>) => void;
  toErrorMessage: (error: unknown) => string;
};

export async function buildAccountSummaryResponseForUser(
  input: BuildAccountSummaryResponseForUserInput
) {
  const claims = input.buildEntitlementClaims(input.snapshot, input.user.id, "account-summary");
  const planState = input.resolveEffectivePlan(input.snapshot, input.user.id, input.now);
  const quota = input.ensureQuotaRecord(input.snapshot, input.user.id, claims.plan);
  const teams = buildAccountTeamSummaries(input.snapshot, input.user.id);
  const billing = buildAccountBillingSnapshot(input.snapshot, input.user.id);
  const governanceTeamScopes = buildGovernanceTeamScopes(
    teams,
    input.supportsGovernancePlan,
    input.canManageTeamRole
  );
  const admin = await input.resolveAdminSnapshot(input.user.email);
  return buildAccountSummaryPayload(
    {
      user: input.user,
      now: input.now,
      claims,
      planState,
      quota,
      teams,
      governanceTeamScopes,
      billing,
      admin
    },
    {
      supportsGovernancePlan: input.supportsGovernancePlan,
      canManageTeamRole: input.canManageTeamRole,
      governanceSeatPriceCents: input.governanceSeatPriceCents,
      adminRoutePrefix: input.adminRoutePrefix,
      cloudflareAccessEnabled: input.cloudflareAccessEnabled
    }
  );
}

export async function resolveAccountSummaryAdminSnapshot(
  input: ResolveAccountSummaryAdminSnapshotInput
): Promise<AccountSummaryAdminSnapshot> {
  const superAdminEmails = await input.getSuperAdminEmailSet();
  let adminAccess: ResolvedAdminAccess | null = null;
  try {
    adminAccess = await input.resolveAdminAccessFromDb(input.email);
  } catch (error) {
    input.safeLogWarn("Failed to resolve admin access for account summary", {
      error: input.toErrorMessage(error)
    });
  }
  const canAccessAdminBoard =
    superAdminEmails.has(input.email) ||
    Boolean(adminAccess?.isSuperAdmin || adminAccess?.permissions.has(input.boardReadPermission));
  return {
    isSuperAdmin: superAdminEmails.has(input.email),
    canAccessAdminBoard,
    permissions: adminAccess ? Array.from(adminAccess.permissions).sort() : []
  };
}
