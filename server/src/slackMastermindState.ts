import { randomUUID } from "crypto";
import type { SlackIntegrationDeps } from "./slackIntegration";
import type { StoreState, UserRecord } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MastermindOptionInput = {
  option_key: string;
  title: string;
  rationale: string | null;
};

export type MastermindThreadCreateStateUpdateInput = {
  state: StoreState;
  user: UserRecord;
  teamKey?: string;
  requestedVoteMode?: "majority" | "single_reviewer";
  title: string;
  question: string;
  parsedOptions: MastermindOptionInput[];
};

export type SlackDecisionStateUpdateInput = {
  state: StoreState;
  user: UserRecord;
  threadId: string;
  decision: "approve" | "reject" | "needs_change";
  requestedOptionKey: string | null;
  note: string | null;
};

// ---------------------------------------------------------------------------
// Sub-factory deps
// ---------------------------------------------------------------------------

export type SlackMastermindStateDeps = Pick<
  SlackIntegrationDeps,
  | "resolveGovernanceContextForUser"
  | "getGovernanceSettingsForScope"
  | "upsertGovernanceSettings"
  | "normalizeGovernanceVoteMode"
  | "pruneGovernanceState"
  | "resolveGovernanceSettingsForThread"
  | "canFinalizeGovernanceThread"
  | "chooseWinningOptionFromVotes"
  | "addDays"
  | "createGovernanceDecisionEvent"
>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Factory – thin delegation layer.
// ---------------------------------------------------------------------------
export function createSlackMastermindHelpers(deps: SlackMastermindStateDeps) {
  return {
    applyMastermindThreadCreateStateUpdate: (input: MastermindThreadCreateStateUpdateInput) =>
      applyMastermindThreadCreateStateUpdate(deps, input),
    applySlackDecisionStateUpdate: (input: SlackDecisionStateUpdateInput) =>
      applySlackDecisionStateUpdate(deps, input),
  };
}

// ---------------------------------------------------------------------------
// Implementation functions (module-level).
// ---------------------------------------------------------------------------

function applyMastermindThreadCreateStateUpdate(
  deps: SlackMastermindStateDeps,
  input: MastermindThreadCreateStateUpdateInput
): {
  threadId: string;
  voteMode: "majority" | "single_reviewer";
  settings: StoreState["governance_settings"][number];
} {
  const liveContext = deps.resolveGovernanceContextForUser(input.state, input.user.id, input.teamKey, false);
  if (!liveContext) {
    throw new Error("governance context not found");
  }
  const settings =
    deps.getGovernanceSettingsForScope(input.state, liveContext.scopeType, liveContext.scopeId) ??
    deps.upsertGovernanceSettings(input.state, liveContext.scopeType, liveContext.scopeId, {});
  const selectedVoteMode =
    deps.normalizeGovernanceVoteMode(input.requestedVoteMode) ?? settings.vote_mode;
  if (input.question.length > settings.max_debate_chars) {
    throw new Error(`question exceeds max_debate_chars (${settings.max_debate_chars})`);
  }
  const now = new Date();
  const nowIso = now.toISOString();
  const threadId = randomUUID();
  input.state.mastermind_threads.push(
    buildMastermindThreadRecord(
      deps, input, liveContext.scopeType, liveContext.scopeId,
      settings, selectedVoteMode, threadId, now, nowIso
    )
  );
  appendMastermindOptions(input.state, input.parsedOptions, threadId, nowIso);
  deps.pruneGovernanceState(input.state);
  return { threadId, voteMode: selectedVoteMode, settings };
}

function buildMastermindThreadRecord(
  deps: SlackMastermindStateDeps,
  input: MastermindThreadCreateStateUpdateInput,
  scopeType: "user" | "team",
  scopeId: string,
  settings: StoreState["governance_settings"][number],
  voteMode: "majority" | "single_reviewer",
  threadId: string,
  now: Date,
  nowIso: string
): StoreState["mastermind_threads"][number] {
  return {
    id: threadId,
    team_id: scopeType === "team" ? scopeId : null,
    created_by_user_id: input.user.id,
    created_by_email: input.user.email,
    title: input.title,
    question: input.question,
    status: "open",
    vote_mode: voteMode,
    decision: null,
    decision_option_key: null,
    decision_note: null,
    decided_by_user_id: null,
    decided_by_email: null,
    decided_at: null,
    last_activity_at: nowIso,
    expires_at: deps.addDays(now, settings.retention_days).toISOString(),
    created_at: nowIso,
    updated_at: nowIso
  };
}

function appendMastermindOptions(
  state: StoreState,
  parsedOptions: MastermindOptionInput[],
  threadId: string,
  nowIso: string
): void {
  for (const option of parsedOptions) {
    state.mastermind_options.push({
      id: randomUUID(),
      thread_id: threadId,
      option_key: option.option_key,
      title: option.title,
      rationale: option.rationale,
      created_at: nowIso
    });
  }
}

function applySlackDecisionStateUpdate(
  deps: SlackMastermindStateDeps,
  input: SlackDecisionStateUpdateInput
): StoreState["mastermind_outcomes"][number] {
  const thread = resolveOpenDecisionThread(deps, input.state, input.user.id, input.threadId);
  const settings = deps.resolveGovernanceSettingsForThread(input.state, thread, input.user.id);
  if (input.note && input.note.length > settings.max_debate_chars) {
    throw new Error(`note exceeds max_debate_chars (${settings.max_debate_chars})`);
  }
  const now = new Date();
  const nowIso = now.toISOString();
  const winningOptionKey = resolveWinningOptionKeyForDecision(
    deps, input.state, thread.id, input.requestedOptionKey
  );
  applyDecisionToThread(deps, thread, input.user, input.decision, input.note, winningOptionKey, settings, now, nowIso);
  const outcome = buildMastermindOutcomeRecord(
    thread, input.user.email, input.decision, input.note, winningOptionKey, nowIso
  );
  input.state.mastermind_outcomes.push(outcome);
  deps.createGovernanceDecisionEvent(input.state, thread, outcome, settings.retention_days);
  deps.pruneGovernanceState(input.state);
  return outcome;
}

function resolveOpenDecisionThread(
  deps: SlackMastermindStateDeps,
  state: StoreState,
  userId: string,
  threadId: string
): StoreState["mastermind_threads"][number] {
  const thread = state.mastermind_threads.find((item) => item.id === threadId);
  if (!thread) {
    throw new Error("thread not found");
  }
  if (!deps.canFinalizeGovernanceThread(state, thread, userId)) {
    throw new Error("only owner/manager (or thread creator for personal scope) can finalize");
  }
  if (thread.status !== "open") {
    throw new Error("thread is already finalized");
  }
  return thread;
}

function resolveWinningOptionKeyForDecision(
  deps: SlackMastermindStateDeps,
  state: StoreState,
  threadId: string,
  requestedOptionKey: string | null
): string | null {
  const winningOptionKey = requestedOptionKey ?? deps.chooseWinningOptionFromVotes(state, threadId) ?? null;
  if (!winningOptionKey) {
    return null;
  }
  const option = state.mastermind_options.find(
    (item) => item.thread_id === threadId && item.option_key === winningOptionKey
  );
  if (!option) {
    throw new Error("option_key was not found in this thread");
  }
  return winningOptionKey;
}

function applyDecisionToThread(
  deps: SlackMastermindStateDeps,
  thread: StoreState["mastermind_threads"][number],
  user: UserRecord,
  decision: "approve" | "reject" | "needs_change",
  note: string | null,
  winningOptionKey: string | null,
  settings: StoreState["governance_settings"][number],
  now: Date,
  nowIso: string
): void {
  thread.status = "decided";
  thread.decision = decision;
  thread.decision_option_key = winningOptionKey;
  thread.decision_note = note;
  thread.decided_by_user_id = user.id;
  thread.decided_by_email = user.email;
  thread.decided_at = nowIso;
  thread.last_activity_at = nowIso;
  thread.updated_at = nowIso;
  thread.expires_at = deps.addDays(now, settings.retention_days).toISOString();
}

function buildMastermindOutcomeRecord(
  thread: StoreState["mastermind_threads"][number],
  decidedByEmail: string,
  decision: "approve" | "reject" | "needs_change",
  note: string | null,
  winningOptionKey: string | null,
  nowIso: string
): StoreState["mastermind_outcomes"][number] {
  return {
    id: randomUUID(),
    thread_id: thread.id,
    team_id: thread.team_id,
    title: thread.title,
    decision,
    winning_option_key: winningOptionKey,
    decision_note: note,
    decided_by_email: decidedByEmail,
    decided_at: nowIso,
    created_at: nowIso
  };
}
