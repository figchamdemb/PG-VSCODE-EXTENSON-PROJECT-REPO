import { randomUUID } from "crypto";
import type { SlackIntegrationDeps, SlackEphemeralResponse } from "./slackIntegration";
import type { StoreState, UserRecord } from "./types";
import type { SlackDecisionStateUpdateInput } from "./slackMastermindState";

// ---------------------------------------------------------------------------
// Deps interface – base deps plus injected sub-factory outputs
// ---------------------------------------------------------------------------

export type SlackActionHandlerDeps = Pick<
  SlackIntegrationDeps,
  | "store"
  | "normalizeEmail"
  | "getString"
  | "getObject"
  | "getOrCreateUserByEmail"
  | "canAccessGovernanceThread"
  | "resolveGovernanceSettingsForThread"
  | "addDays"
  | "pruneGovernanceState"
  | "normalizeMastermindDecision"
  | "getGovernanceSettingsForScope"
  | "buildDefaultGovernanceSettings"
  | "SLACK_ALLOWED_TEAM_IDS"
  | "SLACK_ALLOWED_EMAILS"
> & {
  resolveSlackUserEmail: (slackUserId: string) => Promise<string | null>;
  parseSlackActionPayload: (action: Record<string, unknown>) => Record<string, unknown>;
  buildSlackThreadInteractionBlocks: (
    state: StoreState, threadId: string, viewerUserId?: string
  ) => Array<Record<string, unknown>>;
  applySlackDecisionStateUpdate: (
    input: SlackDecisionStateUpdateInput
  ) => StoreState["mastermind_outcomes"][number];
  executeSlackGovernanceCommand: (
    user: UserRecord, text: string
  ) => Promise<SlackEphemeralResponse>;
  dispatchSlackGovernanceNotification: (
    settings: StoreState["governance_settings"][number], text: string
  ) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Factory – thin delegation layer.
// ---------------------------------------------------------------------------
export function createSlackActionHandlers(deps: SlackActionHandlerDeps) {
  return {
    resolveSlackPayloadUser: (payload: Record<string, unknown>) =>
      resolveSlackPayloadUser(deps, payload),
    executeSlackGovernanceAction: (
      user: UserRecord, actionId: string, action: Record<string, unknown>
    ) => executeSlackGovernanceAction(deps, user, actionId, action),
  };
}

// ---------------------------------------------------------------------------
// Implementation functions (module-level).
// ---------------------------------------------------------------------------

async function resolveSlackPayloadUser(
  deps: SlackActionHandlerDeps,
  payload: Record<string, unknown>
): Promise<UserRecord | null> {
  const teamId =
    deps.getString(deps.getObject(payload, ["team"]), "id") ??
    deps.getString(payload, "team_id");
  if (deps.SLACK_ALLOWED_TEAM_IDS.size > 0 && (!teamId || !deps.SLACK_ALLOWED_TEAM_IDS.has(teamId))) {
    return null;
  }

  const userObject = deps.getObject(payload, ["user"]);
  const slackUserId = deps.getString(userObject, "id");
  if (!slackUserId) {
    return null;
  }
  const payloadEmail = deps.normalizeEmail(deps.getString(userObject, "email"));
  const userEmail = payloadEmail ?? (await deps.resolveSlackUserEmail(slackUserId));
  if (!userEmail) {
    return null;
  }
  if (deps.SLACK_ALLOWED_EMAILS.size > 0 && !deps.SLACK_ALLOWED_EMAILS.has(userEmail)) {
    return null;
  }
  return deps.getOrCreateUserByEmail(userEmail);
}

async function executeSlackGovernanceAction(
  deps: SlackActionHandlerDeps,
  user: UserRecord,
  actionId: string,
  action: Record<string, unknown>
): Promise<SlackEphemeralResponse> {
  const normalizedActionId = actionId.trim().toLowerCase();
  if (!normalizedActionId) {
    throw new Error("Slack action id is missing.");
  }

  if (normalizedActionId === "pg_help" || normalizedActionId === "pg_cmd_help") {
    return deps.executeSlackGovernanceCommand(user, "help");
  }

  if (normalizedActionId === "pg_summary" || normalizedActionId === "pg_cmd_summary") {
    return deps.executeSlackGovernanceCommand(user, "summary");
  }

  const actionPayload = deps.parseSlackActionPayload(action);
  const threadId = deps.getString(actionPayload, "thread_id")?.trim();

  if (normalizedActionId === "pg_thread_summary") {
    if (!threadId) {
      throw new Error("thread_id is required for thread summary action.");
    }
    return {
      response_type: "ephemeral",
      text: `Thread ${threadId}`,
      blocks: deps.buildSlackThreadInteractionBlocks(deps.store.snapshot(), threadId, user.id),
      replace_original: false
    };
  }

  if (normalizedActionId === "pg_vote_option" || normalizedActionId.startsWith("pg_vote_option_")) {
    return handleSlackActionVote(deps, user, threadId, actionPayload);
  }

  if (
    normalizedActionId === "pg_decide_thread" ||
    normalizedActionId.startsWith("pg_decide_thread_")
  ) {
    return handleSlackActionDecide(deps, user, threadId, actionPayload);
  }

  throw new Error(`Unsupported Slack action: ${normalizedActionId}`);
}

async function handleSlackActionVote(
  deps: SlackActionHandlerDeps,
  user: UserRecord,
  threadId: string | undefined,
  actionPayload: Record<string, unknown>
): Promise<SlackEphemeralResponse> {
  const optionKey = deps.getString(actionPayload, "option_key")?.trim().toLowerCase();
  const rationale = deps.getString(actionPayload, "rationale")?.trim() || null;
  if (!threadId || !optionKey) {
    throw new Error("thread_id and option_key are required for vote action.");
  }
  await deps.store.update((state) => {
    const thread = state.mastermind_threads.find((item) => item.id === threadId);
    if (!thread) {
      throw new Error("thread not found");
    }
    if (!deps.canAccessGovernanceThread(state, thread, user.id)) {
      throw new Error("not authorized for this thread");
    }
    if (thread.status !== "open") {
      throw new Error("thread is not open");
    }
    const settings = deps.resolveGovernanceSettingsForThread(state, thread, user.id);
    if (rationale && rationale.length > settings.max_debate_chars) {
      throw new Error(`rationale exceeds max_debate_chars (${settings.max_debate_chars})`);
    }
    const option = state.mastermind_options.find(
      (item) => item.thread_id === thread.id && item.option_key === optionKey
    );
    if (!option) {
      throw new Error("option_key was not found in this thread");
    }
    const now = new Date();
    const nowIso = now.toISOString();
    thread.last_activity_at = nowIso;
    thread.updated_at = nowIso;
    thread.expires_at = deps.addDays(now, settings.retention_days).toISOString();
    const existingVote = state.mastermind_votes.find(
      (item) => item.thread_id === thread.id && item.user_id === user.id
    );
    if (existingVote) {
      existingVote.option_key = optionKey;
      existingVote.rationale = rationale;
      existingVote.updated_at = nowIso;
    } else {
      state.mastermind_votes.push({
        id: randomUUID(),
        thread_id: thread.id,
        option_key: optionKey,
        user_id: user.id,
        email: user.email,
        weight: 1,
        rationale,
        created_at: nowIso,
        updated_at: nowIso
      });
    }
    deps.pruneGovernanceState(state);
  });
  return {
    response_type: "ephemeral",
    text: `Vote saved for thread ${threadId} -> ${optionKey}`,
    blocks: deps.buildSlackThreadInteractionBlocks(deps.store.snapshot(), threadId, user.id),
    replace_original: false
  };
}

async function handleSlackActionDecide(
  deps: SlackActionHandlerDeps,
  user: UserRecord,
  threadId: string | undefined,
  actionPayload: Record<string, unknown>
): Promise<SlackEphemeralResponse> {
  const decision = deps.normalizeMastermindDecision(deps.getString(actionPayload, "decision")) ?? "approve";
  const requestedOptionKey = deps.getString(actionPayload, "option_key")?.trim().toLowerCase() || null;
  const note = deps.getString(actionPayload, "note")?.trim() || null;
  if (!threadId) {
    throw new Error("thread_id is required for decision action.");
  }
  if (note && note.length > 12000) {
    throw new Error("note is too long");
  }

  let outcomeResult: StoreState["mastermind_outcomes"][number] | null = null;
  await deps.store.update((state) => {
    outcomeResult = deps.applySlackDecisionStateUpdate({
      state,
      user,
      threadId,
      decision,
      requestedOptionKey,
      note
    });
  });

  const snapshotAfter = deps.store.snapshot();
  const finalOutcome =
    snapshotAfter.mastermind_outcomes
      .filter((item) => item.thread_id === threadId)
      .sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0] ?? outcomeResult;
  if (finalOutcome) {
    const settings =
      finalOutcome.team_id !== null
        ? deps.getGovernanceSettingsForScope(snapshotAfter, "team", finalOutcome.team_id) ??
          deps.buildDefaultGovernanceSettings("team", finalOutcome.team_id, new Date().toISOString())
        : deps.getGovernanceSettingsForScope(snapshotAfter, "user", user.id) ??
          deps.buildDefaultGovernanceSettings("user", user.id, new Date().toISOString());
    if (settings.slack_enabled && settings.slack_addon_active) {
      await deps.dispatchSlackGovernanceNotification(
        settings,
        [
          "*PG Mastermind decision finalized*",
          `Title: ${finalOutcome.title}`,
          `Decision: ${finalOutcome.decision}`,
          `Winning option: ${finalOutcome.winning_option_key ?? "none"}`,
          `By: ${user.email}`,
          `Thread ID: ${finalOutcome.thread_id}`
        ].join("\n")
      );
    }
  }

  return {
    response_type: "ephemeral",
    text: `Decision saved for thread ${threadId}.`,
    blocks: deps.buildSlackThreadInteractionBlocks(deps.store.snapshot(), threadId, user.id),
    replace_original: false
  };
}
