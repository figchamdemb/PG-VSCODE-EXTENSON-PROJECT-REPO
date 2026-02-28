import { randomUUID } from "crypto";
import type { SlackIntegrationDeps, SlackEphemeralResponse } from "./slackIntegration";
import type { StoreState, UserRecord } from "./types";
import type { MastermindThreadCreateStateUpdateInput, SlackDecisionStateUpdateInput } from "./slackMastermindState";

// ---------------------------------------------------------------------------
// Deps interface – base deps plus injected sub-factory outputs
// ---------------------------------------------------------------------------

export type SlackCommandHandlerDeps = Pick<
  SlackIntegrationDeps,
  | "store"
  | "buildEntitlementClaims"
  | "resolveGovernanceContextForUser"
  | "getGovernanceSettingsForScope"
  | "upsertGovernanceSettings"
  | "pruneGovernanceState"
  | "normalizeMastermindDecision"
  | "canAccessGovernanceThread"
  | "addDays"
  | "buildDefaultGovernanceSettings"
  | "safeLogWarn"
  | "toErrorMessage"
> & {
  applyMastermindThreadCreateStateUpdate: (
    input: MastermindThreadCreateStateUpdateInput
  ) => { threadId: string; voteMode: "majority" | "single_reviewer"; settings: StoreState["governance_settings"][number] };
  applySlackDecisionStateUpdate: (
    input: SlackDecisionStateUpdateInput
  ) => StoreState["mastermind_outcomes"][number];
  buildSlackThreadInteractionBlocks: (
    state: StoreState, threadId: string, viewerUserId?: string
  ) => Array<Record<string, unknown>>;
  isUuidLike: (value: string) => boolean;
  dispatchSlackGovernanceNotification: (
    settings: StoreState["governance_settings"][number], text: string
  ) => Promise<void>;
};

export type SlackCommandAction = "help" | "summary" | "eod" | "thread" | "vote" | "decide";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Factory – thin delegation layer.
// ---------------------------------------------------------------------------
export function createSlackCommandHandlers(deps: SlackCommandHandlerDeps) {
  return {
    buildSlackHelpText,
    isSlackHelpCommand,
    getSlackCommandAction,
    executeSlackGovernanceCommand: (user: UserRecord, text: string) =>
      executeSlackGovernanceCommand(deps, user, text),
  };
}

// ---------------------------------------------------------------------------
// Implementation functions (module-level).
// ---------------------------------------------------------------------------

function buildSlackHelpText(): string {
  return [
    "PG commands:",
    "- `summary`",
    "- `eod <title> :: <summary>`",
    "- `thread <title> :: <question> :: <option1|option2|...>`",
    "- `vote <thread_id> <option_key> [rationale]` (team vote step)",
    "- `decide <thread_id> <approve|reject|needs_change> [option_key] [note]` (owner/manager final step)"
  ].join("\n");
}

function isSlackHelpCommand(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  const [actionRaw] = trimmed.split(/\s+/);
  return (actionRaw || "").toLowerCase() === "help";
}

function getSlackCommandAction(text: string): SlackCommandAction | "unknown" {
  const trimmed = text.trim();
  if (!trimmed) {
    return "help";
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "help";
  }
  const normalized =
    parts[0].toLowerCase() === "pg" ? (parts[1] || "help").toLowerCase() : parts[0].toLowerCase();
  if (
    normalized === "help" ||
    normalized === "summary" ||
    normalized === "eod" ||
    normalized === "thread" ||
    normalized === "vote" ||
    normalized === "decide"
  ) {
    return normalized;
  }
  return "unknown";
}

async function executeSlackGovernanceCommand(
  deps: SlackCommandHandlerDeps,
  user: UserRecord,
  text: string
): Promise<SlackEphemeralResponse> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { response_type: "ephemeral", text: buildSlackHelpText() };
  }

  const commandParts = trimmed.split(/\s+/).filter(Boolean);
  if (commandParts[0]?.toLowerCase() === "pg") {
    commandParts.shift();
  }
  const [actionRaw, ...restParts] = commandParts;
  const action = (actionRaw || "").toLowerCase() as SlackCommandAction;
  const rest = restParts.join(" ").trim();

  if (action === "help") {
    return { response_type: "ephemeral", text: buildSlackHelpText() };
  }

  if (action === "summary") {
    return handleSlackSummary(deps, user);
  }

  if (action === "eod") {
    return handleSlackEod(deps, user, rest);
  }

  if (action === "thread") {
    return handleSlackThread(deps, user, rest);
  }

  if (action === "vote") {
    return handleSlackVote(deps, user, rest);
  }

  if (action === "decide") {
    return handleSlackDecide(deps, user, rest);
  }

  return { response_type: "ephemeral", text: `Unknown command: ${action}. Use \`help\`.` };
}

function handleSlackSummary(
  deps: SlackCommandHandlerDeps,
  user: UserRecord
): SlackEphemeralResponse {
  const snapshot = deps.store.snapshot();
  const claims = deps.buildEntitlementClaims(snapshot, user.id, "slack-summary");
  const teamMemberships = snapshot.team_memberships.filter(
    (item) => item.user_id === user.id && item.status === "active" && item.revoked_at === null
  );
  const teamRoleLabels = teamMemberships
    .map((membership) => {
      const team = snapshot.teams.find((item) => item.id === membership.team_id);
      if (!team) {
        return null;
      }
      return `${team.team_key} (${membership.role})`;
    })
    .filter((item): item is string => Boolean(item));
  return {
    response_type: "ephemeral",
    text: `Email: ${user.email}\nPlan: ${claims.plan}\nModules: ${claims.modules.join(", ")}\nTeams: ${
      teamRoleLabels.length > 0 ? teamRoleLabels.join(", ") : "none"
    }`
  };
}

async function handleSlackEod(
  deps: SlackCommandHandlerDeps,
  user: UserRecord,
  rest: string
): Promise<SlackEphemeralResponse> {
  const [title, summary] = rest.split("::").map((part) => part.trim());
  if (!title || !summary) {
    return { response_type: "ephemeral", text: "Usage: `eod <title> :: <summary>`" };
  }
  const snapshot = deps.store.snapshot();
  const context = deps.resolveGovernanceContextForUser(snapshot, user.id, undefined, false);
  if (!context) {
    return {
      response_type: "ephemeral",
      text: "No governance access found for this account (requires Pro+ with governance enabled or Team/Enterprise)."
    };
  }
  const reportId = randomUUID();
  let settings: StoreState["governance_settings"][number];
  await deps.store.update((state) => {
    const liveContext = deps.resolveGovernanceContextForUser(state, user.id, undefined, false);
    if (!liveContext) {
      throw new Error("governance context not found");
    }
    const nowIso = new Date().toISOString();
    state.governance_eod_reports.push({
      id: reportId,
      user_id: user.id,
      email: user.email,
      team_id: liveContext.scopeType === "team" ? liveContext.scopeId : null,
      title,
      summary,
      work_started_at: null,
      work_ended_at: null,
      changed_files: [],
      blockers: [],
      source: "human",
      agent_name: "slack",
      created_at: nowIso,
      updated_at: nowIso
    });
    settings =
      deps.getGovernanceSettingsForScope(state, liveContext.scopeType, liveContext.scopeId) ??
      deps.upsertGovernanceSettings(state, liveContext.scopeType, liveContext.scopeId, {});
    deps.pruneGovernanceState(state);
  });
  if (settings!.slack_enabled && settings!.slack_addon_active) {
    await deps.dispatchSlackGovernanceNotification(
      settings!,
      `*PG EOD submitted from Slack*\nBy: ${user.email}\nTitle: ${title}\nReport ID: ${reportId}`
    );
  }
  return { response_type: "ephemeral", text: `EOD saved. Report ID: ${reportId}` };
}

async function handleSlackThread(
  deps: SlackCommandHandlerDeps,
  user: UserRecord,
  rest: string
): Promise<SlackEphemeralResponse> {
  const segments = rest.split("::").map((part) => part.trim());
  if (segments.length < 3) {
    return {
      response_type: "ephemeral",
      text: "Usage: `thread <title> :: <question> :: <option1|option2|...>`"
    };
  }
  const [title, question, rawOptions] = segments;
  const optionList = rawOptions
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  if (optionList.length < 2) {
    return { response_type: "ephemeral", text: "At least two options are required." };
  }
  const snapshot = deps.store.snapshot();
  const context = deps.resolveGovernanceContextForUser(snapshot, user.id, undefined, false);
  if (!context) {
    return { response_type: "ephemeral", text: "No governance access found for this account." };
  }

  const parsedOptions = optionList.map((label, index) => ({
    option_key: `opt${index + 1}`,
    title: label,
    rationale: null
  }));

  let threadId = "";
  let settings: StoreState["governance_settings"][number];
  await deps.store.update((state) => {
    const result = deps.applyMastermindThreadCreateStateUpdate({
      state,
      user,
      title,
      question,
      parsedOptions
    });
    threadId = result.threadId;
    settings = result.settings;
  });
  if (settings!.slack_enabled && settings!.slack_addon_active) {
    await deps.dispatchSlackGovernanceNotification(
      settings!,
      `*PG Mastermind thread created from Slack*\nBy: ${user.email}\nThread: ${title}\nThread ID: ${threadId}`
    );
  }
  return {
    response_type: "ephemeral",
    text: `Thread created. ID: ${threadId}`,
    blocks: deps.buildSlackThreadInteractionBlocks(deps.store.snapshot(), threadId, user.id)
  };
}

async function handleSlackVote(
  deps: SlackCommandHandlerDeps,
  user: UserRecord,
  rest: string
): Promise<SlackEphemeralResponse> {
  const [threadId, optionKey, ...rationaleParts] = rest.split(/\s+/).filter(Boolean);
  if (!threadId || !optionKey) {
    return {
      response_type: "ephemeral",
      text: "Usage: `vote <thread_id> <option_key> [rationale]`"
    };
  }
  if (!deps.isUuidLike(threadId)) {
    return {
      response_type: "ephemeral",
      text:
        "Invalid `thread_id`. Use the real ID from `Thread created. ID: ...` then run `vote <thread_id> opt1`."
    };
  }
  const rationale = rationaleParts.join(" ").trim() || null;
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
    const option = state.mastermind_options.find(
      (item) => item.thread_id === threadId && item.option_key === optionKey.toLowerCase()
    );
    if (!option) {
      throw new Error("option_key was not found in this thread");
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const existing = state.mastermind_votes.find(
      (item) => item.thread_id === threadId && item.user_id === user.id
    );
    if (existing) {
      existing.option_key = option.option_key;
      existing.rationale = rationale;
      existing.updated_at = nowIso;
    } else {
      state.mastermind_votes.push({
        id: randomUUID(),
        thread_id: threadId,
        option_key: option.option_key,
        user_id: user.id,
        email: user.email,
        weight: 1,
        rationale,
        created_at: nowIso,
        updated_at: nowIso
      });
    }
    thread.last_activity_at = nowIso;
    thread.updated_at = nowIso;
    deps.pruneGovernanceState(state);
  });
  return {
    response_type: "ephemeral",
    text: `Vote saved for thread ${threadId} -> ${optionKey.toLowerCase()}`
  };
}

async function handleSlackDecide(
  deps: SlackCommandHandlerDeps,
  user: UserRecord,
  rest: string
): Promise<SlackEphemeralResponse> {
  const tokens = rest.split(/\s+/).filter(Boolean);
  const threadId = tokens[0];
  const decisionInput = tokens[1];
  if (!threadId || !decisionInput) {
    return {
      response_type: "ephemeral",
      text: "Usage: `decide <thread_id> <approve|reject|needs_change> [option_key] [note]`"
    };
  }
  if (!deps.isUuidLike(threadId)) {
    return {
      response_type: "ephemeral",
      text:
        "Invalid `thread_id`. Use the real ID from `Thread created. ID: ...` then run `decide <thread_id> approve`."
    };
  }
  const decision = deps.normalizeMastermindDecision(decisionInput);
  if (!decision) {
    return {
      response_type: "ephemeral",
      text: "Invalid decision. Use one of: `approve`, `reject`, `needs_change`."
    };
  }

  let requestedOptionKey: string | null = null;
  let noteStartIndex = 2;
  const maybeOption = tokens[2]?.trim().toLowerCase() ?? "";
  if (/^(opt[0-9]+|option-[0-9]+)$/.test(maybeOption)) {
    requestedOptionKey = maybeOption;
    noteStartIndex = 3;
  }
  const note = tokens.slice(noteStartIndex).join(" ").trim() || null;
  if (note && note.length > 12000) {
    return { response_type: "ephemeral", text: "note is too long" };
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
      void deps.dispatchSlackGovernanceNotification(
        settings,
        [
          "*PG Mastermind decision finalized*",
          `Title: ${finalOutcome.title}`,
          `Decision: ${finalOutcome.decision}`,
          `Winning option: ${finalOutcome.winning_option_key ?? "none"}`,
          `By: ${user.email}`,
          `Thread ID: ${finalOutcome.thread_id}`
        ].join("\n")
      ).catch((error) => {
        deps.safeLogWarn("Slack decision dispatch failed (slash decide)", {
          error: deps.toErrorMessage(error),
          thread_id: finalOutcome.thread_id
        });
      });
    }
  }

  return {
    response_type: "ephemeral",
    text: `Decision saved for thread ${threadId}: ${decision}.`,
    blocks: deps.buildSlackThreadInteractionBlocks(deps.store.snapshot(), threadId, user.id)
  };
}
