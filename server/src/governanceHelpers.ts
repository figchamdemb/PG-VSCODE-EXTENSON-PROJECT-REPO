import { randomUUID } from "crypto";
import { PlanTier, StoreState } from "./types";
import {
  normalizeGovernanceVoteMode,
  normalizeMastermindEntryType,
  normalizeMastermindDecision,
  normalizeStringList,
  normalizeIsoDateOrNull,
  parseMastermindOptionsInput,
  normalizeMastermindOptionKey
} from "./governanceNormalization";
import { createGovernanceSettingsHelpers } from "./governanceSettingsHelpers";

export interface GovernanceHelpersDeps {
  GOVERNANCE_ALLOW_PRO: boolean;
  GOVERNANCE_DEFAULT_MAX_DEBATE_CHARS: number;
  GOVERNANCE_DEFAULT_RETENTION_DAYS: number;
  GOVERNANCE_MIN_RETENTION_DAYS: number;
  GOVERNANCE_MAX_RETENTION_DAYS: number;
  GOVERNANCE_MIN_DEBATE_CHARS: number;
  GOVERNANCE_MAX_DEBATE_CHARS: number;
  addDays: (date: Date, days: number) => Date;
  clampInt: (value: number, min: number, max: number) => number;
  resolveTeamAccessForUser: (
    state: StoreState,
    userId: string,
    teamKey: string | undefined,
    requireManagement: boolean
  ) =>
    | {
        team: StoreState["teams"][number];
        membership: StoreState["team_memberships"][number];
      }
    | undefined;
  canManageTeamRole: (
    role: StoreState["team_memberships"][number]["role"]
  ) => boolean;
  resolveEffectivePlan: (
    state: StoreState,
    userId: string,
    now: Date
  ) => { plan: PlanTier };
  hasActiveTeamSeat: (
    state: StoreState,
    teamId: string,
    userId: string
  ) => boolean;
}

// ---------------------------------------------------------------------------
// Factory – returns all governance helper functions.
// Destructured deps shadow original module-level names.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Factory – thin delegation layer.
// ---------------------------------------------------------------------------
export function createGovernanceHelpers(deps: GovernanceHelpersDeps) {
  const settingsHelpers = createGovernanceSettingsHelpers(deps);
  return createGovernanceHelperSurface(deps, settingsHelpers);
}

// ---------------------------------------------------------------------------
// Settings sub-factory result type (used by module-level functions).
// ---------------------------------------------------------------------------
type SettingsHelpers = ReturnType<typeof createGovernanceSettingsHelpers>;

function createGovernanceHelperSurface(deps: GovernanceHelpersDeps, settingsHelpers: SettingsHelpers) {
  return {
    ...settingsHelpers,
    ...createGovernanceAccessSurface(deps, settingsHelpers),
    ...GOVERNANCE_NORMALIZATION_SURFACE,
    ...createGovernanceDecisionSurface(deps, settingsHelpers)
  };
}

const GOVERNANCE_NORMALIZATION_SURFACE = {
  normalizeGovernanceVoteMode,
  normalizeMastermindEntryType,
  normalizeMastermindDecision,
  normalizeStringList,
  normalizeIsoDateOrNull,
  parseMastermindOptionsInput,
  normalizeMastermindOptionKey
};

function createGovernanceAccessSurface(deps: GovernanceHelpersDeps, settingsHelpers: SettingsHelpers) {
  return {
    supportsGovernancePlan: (plan: PlanTier) => supportsGovernancePlan(deps, plan),
    resolveGovernanceContextForUser: (
      state: StoreState, userId: string, teamKey: string | undefined, requireManage: boolean
    ) => resolveGovernanceContextForUser(deps, state, userId, teamKey, requireManage),
    canAccessGovernanceThread: (
      state: StoreState, thread: StoreState["mastermind_threads"][number], userId: string
    ) => canAccessGovernanceThread(deps, state, thread, userId),
    canFinalizeGovernanceThread: (
      state: StoreState, thread: StoreState["mastermind_threads"][number], userId: string
    ) => canFinalizeGovernanceThread(deps, state, thread, userId),
    resolveGovernanceSettingsForThread: (
      state: StoreState, thread: StoreState["mastermind_threads"][number], fallbackUserId: string
    ) => resolveGovernanceSettingsForThread(settingsHelpers, state, thread, fallbackUserId)
  };
}

function createGovernanceDecisionSurface(deps: GovernanceHelpersDeps, settingsHelpers: SettingsHelpers) {
  return {
    buildMastermindVoteTally: (state: StoreState, threadId: string) => buildMastermindVoteTally(state, threadId),
    chooseWinningOptionFromVotes: (state: StoreState, threadId: string) => chooseWinningOptionFromVotes(state, threadId),
    buildMastermindThreadDetail: (
      state: StoreState, thread: StoreState["mastermind_threads"][number]
    ) => buildMastermindThreadDetail(state, thread),
    createGovernanceDecisionEvent: (
      state: StoreState, thread: StoreState["mastermind_threads"][number],
      outcome: StoreState["mastermind_outcomes"][number], retentionDays: number
    ) => createGovernanceDecisionEvent(deps, state, thread, outcome, retentionDays),
    pruneGovernanceState: (state: StoreState) => pruneGovernanceState(deps, settingsHelpers, state)
  };
}

// ---------------------------------------------------------------------------
// Implementation functions (module-level).
// ---------------------------------------------------------------------------

function supportsGovernancePlan(deps: GovernanceHelpersDeps, plan: PlanTier): boolean {
  if (plan === "team" || plan === "enterprise") {
    return true;
  }
  return plan === "pro" && deps.GOVERNANCE_ALLOW_PRO;
}

function resolveGovernanceContextForUser(
  deps: GovernanceHelpersDeps,
  state: StoreState,
  userId: string,
  teamKey: string | undefined,
  requireManage: boolean
):
  | {
      scopeType: "user" | "team";
      scopeId: string;
      plan: PlanTier;
      canManage: boolean;
      team: StoreState["teams"][number] | null;
    }
  | undefined {
  if (teamKey) {
    const access = deps.resolveTeamAccessForUser(state, userId, teamKey, false);
    if (!access) {
      return undefined;
    }
    const canManage = deps.canManageTeamRole(access.membership.role);
    if (requireManage && !canManage) {
      return undefined;
    }
    if (!supportsGovernancePlan(deps, access.team.plan_id)) {
      return undefined;
    }
    return {
      scopeType: "team",
      scopeId: access.team.id,
      plan: access.team.plan_id,
      canManage,
      team: access.team
    };
  }

  const planState = deps.resolveEffectivePlan(state, userId, new Date());
  if (!supportsGovernancePlan(deps, planState.plan)) {
    return undefined;
  }
  return {
    scopeType: "user",
    scopeId: userId,
    plan: planState.plan,
    canManage: true,
    team: null
  };
}

function canAccessGovernanceThread(
  deps: GovernanceHelpersDeps,
  state: StoreState,
  thread: StoreState["mastermind_threads"][number],
  userId: string
): boolean {
  if (thread.team_id) {
    if (deps.hasActiveTeamSeat(state, thread.team_id, userId)) {
      return true;
    }
  }
  if (thread.created_by_user_id === userId) {
    return true;
  }
  return (
    state.mastermind_entries.some((entry) => entry.thread_id === thread.id && entry.user_id === userId) ||
    state.mastermind_votes.some((vote) => vote.thread_id === thread.id && vote.user_id === userId)
  );
}

function canFinalizeGovernanceThread(
  deps: GovernanceHelpersDeps,
  state: StoreState,
  thread: StoreState["mastermind_threads"][number],
  userId: string
): boolean {
  if (!thread.team_id) {
    return thread.created_by_user_id === userId;
  }
  const membership = state.team_memberships.find(
    (item) =>
      item.team_id === thread.team_id &&
      item.user_id === userId &&
      item.status === "active" &&
      item.revoked_at === null
  );
  if (!membership) {
    return false;
  }
  return deps.canManageTeamRole(membership.role);
}

function resolveGovernanceSettingsForThread(
  settingsHelpers: SettingsHelpers,
  state: StoreState,
  thread: StoreState["mastermind_threads"][number],
  fallbackUserId: string
): StoreState["governance_settings"][number] {
  const nowIso = new Date().toISOString();
  if (thread.team_id) {
    return (
      settingsHelpers.getGovernanceSettingsForScope(state, "team", thread.team_id) ??
      settingsHelpers.buildDefaultGovernanceSettings("team", thread.team_id, nowIso)
    );
  }
  const scopeUserId = thread.created_by_user_id || fallbackUserId;
  return (
    settingsHelpers.getGovernanceSettingsForScope(state, "user", scopeUserId) ??
    settingsHelpers.buildDefaultGovernanceSettings("user", scopeUserId, nowIso)
  );
}

function buildMastermindVoteTally(
  state: StoreState,
  threadId: string
): Array<{ option_key: string; title: string; votes: number; weight: number }> {
  const options = state.mastermind_options.filter((item) => item.thread_id === threadId);
  const tally = new Map<string, { votes: number; weight: number; title: string }>();
  for (const option of options) {
    tally.set(option.option_key, { votes: 0, weight: 0, title: option.title });
  }
  for (const vote of state.mastermind_votes.filter((item) => item.thread_id === threadId)) {
    const bucket = tally.get(vote.option_key);
    if (!bucket) {
      continue;
    }
    bucket.votes += 1;
    bucket.weight += vote.weight;
  }
  return Array.from(tally.entries())
    .map(([option_key, value]) => ({
      option_key,
      title: value.title,
      votes: value.votes,
      weight: value.weight
    }))
    .sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      if (b.votes !== a.votes) {
        return b.votes - a.votes;
      }
      return a.option_key.localeCompare(b.option_key);
    });
}

function chooseWinningOptionFromVotes(state: StoreState, threadId: string): string | undefined {
  return buildMastermindVoteTally(state, threadId)[0]?.option_key;
}

function buildMastermindThreadDetail(
  state: StoreState,
  thread: StoreState["mastermind_threads"][number]
): {
  thread: StoreState["mastermind_threads"][number];
  options: StoreState["mastermind_options"];
  entries: StoreState["mastermind_entries"];
  votes: StoreState["mastermind_votes"];
  tally: Array<{ option_key: string; title: string; votes: number; weight: number }>;
  outcome: StoreState["mastermind_outcomes"][number] | null;
} {
  const options = state.mastermind_options
    .filter((item) => item.thread_id === thread.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const entries = state.mastermind_entries
    .filter((item) => item.thread_id === thread.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const votes = state.mastermind_votes
    .filter((item) => item.thread_id === thread.id)
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  const outcome =
    state.mastermind_outcomes
      .filter((item) => item.thread_id === thread.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  return {
    thread,
    options,
    entries,
    votes,
    tally: buildMastermindVoteTally(state, thread.id),
    outcome
  };
}

function createGovernanceDecisionEvent(
  deps: GovernanceHelpersDeps,
  state: StoreState,
  thread: StoreState["mastermind_threads"][number],
  outcome: StoreState["mastermind_outcomes"][number],
  retentionDays: number
): void {
  const now = new Date();
  const nowIso = now.toISOString();
  const sequence =
    state.governance_decision_events.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;
  const eventId = randomUUID();
  const summary = `${outcome.title} -> ${outcome.decision}${
    outcome.winning_option_key ? ` (${outcome.winning_option_key})` : ""
  }`;
  state.governance_decision_events.push({
    id: eventId,
    sequence,
    event_type: "decision_finalized",
    thread_id: thread.id,
    team_id: thread.team_id,
    decision: outcome.decision,
    winning_option_key: outcome.winning_option_key,
    summary,
    created_at: nowIso,
    expires_at: deps.addDays(now, deps.clampInt(retentionDays, 1, 365)).toISOString()
  });

  const recipients = new Set<string>();
  recipients.add(thread.created_by_user_id);
  for (const entry of state.mastermind_entries) {
    if (entry.thread_id === thread.id) {
      recipients.add(entry.user_id);
    }
  }
  for (const vote of state.mastermind_votes) {
    if (vote.thread_id === thread.id) {
      recipients.add(vote.user_id);
    }
  }
  if (thread.team_id) {
    for (const membership of state.team_memberships) {
      if (
        membership.team_id === thread.team_id &&
        membership.status === "active" &&
        membership.revoked_at === null
      ) {
        recipients.add(membership.user_id);
      }
    }
  }

  for (const userId of recipients) {
    state.governance_decision_acks.push({
      id: randomUUID(),
      event_id: eventId,
      user_id: userId,
      status: "pending",
      note: null,
      updated_at: nowIso,
      acked_at: null
    });
  }
}

function pruneGovernanceState(
  deps: GovernanceHelpersDeps,
  settingsHelpers: SettingsHelpers,
  state: StoreState
): void {
  const nowMs = Date.now();
  state.governance_eod_reports = state.governance_eod_reports.filter((report) => {
    const retentionDays = settingsHelpers.resolveGovernanceRetentionDaysForScope(
      state,
      report.team_id ? "team" : "user",
      report.team_id ?? report.user_id
    );
    const reference = new Date(report.updated_at || report.created_at).getTime();
    const expiresMs = deps.addDays(new Date(reference), retentionDays).getTime();
    return expiresMs > nowMs;
  });

  const staleThreadIds = new Set(
    state.mastermind_threads
      .filter((thread) => new Date(thread.expires_at).getTime() <= nowMs)
      .map((thread) => thread.id)
  );
  if (staleThreadIds.size > 0) {
    state.mastermind_threads = state.mastermind_threads.filter((thread) => !staleThreadIds.has(thread.id));
    state.mastermind_options = state.mastermind_options.filter((option) => !staleThreadIds.has(option.thread_id));
    state.mastermind_entries = state.mastermind_entries.filter((entry) => !staleThreadIds.has(entry.thread_id));
    state.mastermind_votes = state.mastermind_votes.filter((vote) => !staleThreadIds.has(vote.thread_id));
  }

  const activeEventIds = new Set<string>();
  state.governance_decision_events = state.governance_decision_events.filter((event) => {
    const keep = new Date(event.expires_at).getTime() > nowMs;
    if (keep) {
      activeEventIds.add(event.id);
    }
    return keep;
  });
  state.governance_decision_acks = state.governance_decision_acks.filter((ack) =>
    activeEventIds.has(ack.event_id)
  );
}
