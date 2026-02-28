import { FastifyReply, FastifyRequest } from "fastify";
import { AdminPermissionKeys } from "./adminRbacBootstrap";
import { StateStore } from "./store";
import { PlanTier, StoreState, UserRecord } from "./types";

type GovernanceScopeContext = {
  scopeType: "team" | "user";
  scopeId: string;
  plan: PlanTier;
  canManage: boolean;
  team: StoreState["teams"][number] | null;
};

type GovernanceSettingsRecord = StoreState["governance_settings"][number];
type MastermindDecision = "approve" | "reject" | "needs_change";

type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

type MastermindOptionInput = Array<{ option_key?: string; title?: string; rationale?: string | null }>;
type ParsedMastermindOption = { option_key: string; title: string; rationale: string | null };

export interface RegisterGovernanceRoutesDeps {
  requireAuth: (request: FastifyRequest, reply: FastifyReply) => { user: UserRecord } | undefined;
  store: StateStore;
  resolveGovernanceContextForUser: (
    snapshot: StoreState,
    userId: string,
    teamKey: string | undefined,
    requireManage: boolean
  ) => GovernanceScopeContext | undefined;
  getGovernanceSettingsForScope: (
    snapshot: StoreState,
    scopeType: "team" | "user",
    scopeId: string
  ) => GovernanceSettingsRecord | undefined;
  buildDefaultGovernanceSettings: (
    scopeType: "team" | "user",
    scopeId: string,
    nowIso: string
  ) => GovernanceSettingsRecord;
  governanceSlackAddonSeatPriceCents: number;
  upsertGovernanceSettings: (
    state: StoreState,
    scopeType: "team" | "user",
    scopeId: string,
    input: {
      slack_enabled?: boolean;
      slack_channel?: string | null;
      vote_mode?: "majority" | "single_reviewer";
      retention_days?: number;
      max_debate_chars?: number;
    }
  ) => GovernanceSettingsRecord;
  normalizeGovernanceVoteMode: (value: string | undefined) => "majority" | "single_reviewer" | undefined;
  pruneGovernanceState: (state: StoreState) => void;
  dispatchSlackGovernanceNotification: (
    settings: GovernanceSettingsRecord,
    message: string
  ) => Promise<void>;
  normalizeStringList: (list: string[] | undefined, maxItems: number, maxItemLength: number) => string[];
  normalizeIsoDateOrNull: (value: string | null | undefined) => string | null;
  parseMastermindOptionsInput: (
    options: MastermindOptionInput | undefined,
    maxDebateChars: number
  ) => ParsedMastermindOption[];
  applyMastermindThreadCreateStateUpdate: (input: {
    state: StoreState;
    user: UserRecord;
    teamKey: string | undefined;
    title: string;
    question: string;
    parsedOptions: ParsedMastermindOption[];
    requestedVoteMode: "majority" | "single_reviewer" | undefined;
  }) => { threadId: string; voteMode: "majority" | "single_reviewer" };
  canAccessGovernanceThread: (
    state: StoreState,
    thread: StoreState["mastermind_threads"][number],
    userId: string
  ) => boolean;
  buildMastermindThreadDetail: (
    state: StoreState,
    thread: StoreState["mastermind_threads"][number]
  ) => unknown;
  normalizeMastermindEntryType: (
    value: string | undefined
  ) => "argument" | "suggestion" | "review" | undefined;
  resolveGovernanceSettingsForThread: (
    state: StoreState,
    thread: StoreState["mastermind_threads"][number],
    userId: string
  ) => GovernanceSettingsRecord;
  addDays: (date: Date, days: number) => Date;
  normalizeMastermindDecision: (value: string | undefined) => MastermindDecision | undefined;
  applySlackDecisionStateUpdate: (input: {
    state: StoreState;
    user: UserRecord;
    threadId: string;
    decision: MastermindDecision;
    requestedOptionKey: string | null;
    note: string | null;
  }) => StoreState["mastermind_outcomes"][number] | null;
  toErrorMessage: (error: unknown) => string;
  buildMastermindVoteTally: (state: StoreState, threadId: string) => unknown;
  clampInt: (value: number, min: number, max: number) => number;
  hasActiveTeamSeat: (state: StoreState, teamId: string, userId: string) => boolean;
  setGovernanceSlackAddonState: (
    state: StoreState,
    scopeType: "team" | "user",
    scopeId: string,
    active: boolean
  ) => GovernanceSettingsRecord;
  requireAdminPermission: (
    request: FastifyRequest,
    reply: FastifyReply,
    permissionKey: string
  ) => Promise<AdminAccessContext | undefined>;
  adminPermissionKeys: AdminPermissionKeys;
  adminRoutePrefix: string;
  getSuperAdminEmailSet: () => Promise<Set<string>>;
  resolveEffectivePlan: (state: StoreState, userId: string, now: Date) => { plan: PlanTier };
  safeLogWarn: (message: string, context?: Record<string, unknown>) => void;
  normalizeEmail: (value: string | undefined) => string | undefined;
}
