import type { SlackIntegrationDeps } from "./slackIntegration";
import type { StoreState } from "./types";

// ---------------------------------------------------------------------------
// Sub-factory deps
// ---------------------------------------------------------------------------

export type SlackBlockBuilderDeps = Pick<
  SlackIntegrationDeps,
  | "buildMastermindVoteTally"
  | "canAccessGovernanceThread"
  | "canFinalizeGovernanceThread"
  | "getString"
  | "getObject"
>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Factory – thin delegation layer.
// ---------------------------------------------------------------------------
export function createSlackBlockBuilders(deps: SlackBlockBuilderDeps) {
  return {
    parseSlackActionPayload: (action: Record<string, unknown>) =>
      parseSlackActionPayload(deps, action),
    buildSlackThreadInteractionBlocks: (
      state: StoreState, threadId: string, viewerUserId?: string
    ) => buildSlackThreadInteractionBlocks(deps, state, threadId, viewerUserId),
    chunkSlackButtons,
    isUuidLike,
    normalizeSlackActionSuffix,
  };
}

// ---------------------------------------------------------------------------
// Implementation functions (module-level).
// ---------------------------------------------------------------------------

function parseSlackActionPayload(
  deps: SlackBlockBuilderDeps,
  action: Record<string, unknown>
): Record<string, unknown> {
  const value =
    deps.getString(action, "value") ?? deps.getString(deps.getObject(action, ["selected_option"]), "value");
  if (!value) {
    return {};
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function buildSlackThreadInteractionBlocks(
  deps: SlackBlockBuilderDeps,
  state: StoreState,
  threadId: string,
  viewerUserId?: string
): Array<Record<string, unknown>> {
  const thread = state.mastermind_threads.find((item) => item.id === threadId);
  if (!thread) {
    return [{ type: "section", text: { type: "mrkdwn", text: `Thread \`${threadId}\` was not found.` } }];
  }
  const options = state.mastermind_options
    .filter((item) => item.thread_id === thread.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const tally = deps.buildMastermindVoteTally(state, thread.id);
  const outcome =
    state.mastermind_outcomes
      .filter((item) => item.thread_id === thread.id)
      .sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0] ?? null;
  const tallyText =
    tally.length > 0
      ? tally.map((item) => `- *${item.option_key}* (${item.title}): ${item.votes} vote(s)`).join("\n")
      : "- no votes yet";
  const decisionText = outcome
    ? `\n*Decision:* ${outcome.decision} (${outcome.winning_option_key ?? "none"}) by ${
        outcome.decided_by_email ?? "unknown"
      }`
    : "";

  return buildThreadBlocks(
    deps, state, thread, options, tally, outcome, tallyText, decisionText, viewerUserId
  );
}

function buildThreadBlocks(
  deps: SlackBlockBuilderDeps,
  state: StoreState,
  thread: StoreState["mastermind_threads"][number],
  options: StoreState["mastermind_options"],
  _tally: Array<{ option_key: string; title: string; votes: number; weight: number }>,
  _outcome: StoreState["mastermind_outcomes"][number] | null,
  tallyText: string,
  decisionText: string,
  viewerUserId?: string
): Array<Record<string, unknown>> {
  const viewerCanVote = viewerUserId ? deps.canAccessGovernanceThread(state, thread, viewerUserId) : true;
  const viewerCanFinalize = viewerUserId
    ? deps.canFinalizeGovernanceThread(state, thread, viewerUserId)
    : false;
  const viewerMembership =
    viewerUserId && thread.team_id
      ? state.team_memberships.find(
          (item) =>
            item.team_id === thread.team_id &&
            item.user_id === viewerUserId &&
            item.status === "active" &&
            item.revoked_at === null
        )
      : undefined;
  const team = thread.team_id ? state.teams.find((item) => item.id === thread.team_id) : undefined;
  const viewerTeamRole = viewerMembership?.role;
  const viewerRoleLabel = viewerUserId
    ? viewerTeamRole
      ? viewerCanFinalize
        ? `${viewerTeamRole} (can vote + finalize)`
        : viewerCanVote
          ? `${viewerTeamRole} (vote only)`
          : `${viewerTeamRole} (read-only)`
      : viewerCanFinalize
        ? "personal scope creator (can finalize)"
        : viewerCanVote
          ? "voter (vote only)"
          : "read-only"
    : "unspecified";

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          thread.team_id ? `*Scope:* team${team ? ` (${team.team_key})` : ""}` : "*Scope:* personal",
          `*Thread:* ${thread.title}`,
          `*Question:* ${thread.question.slice(0, 800)}`,
          `*Status:* ${thread.status}`,
          "*Vote Tally:*",
          tallyText,
          decisionText
        ]
          .filter(Boolean)
          .join("\n")
      }
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: [
            "*Workflow:* 1) Team votes on options. 2) Owner/manager finalizes.",
            viewerUserId ? `*Your access:* ${viewerRoleLabel}` : ""
          ]
            .filter(Boolean)
            .join("\n")
        }
      ]
    }
  ];

  if (thread.status === "open") {
    appendOpenThreadActions(blocks, options, thread, viewerCanVote, viewerCanFinalize);
  } else {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: "*Thread finalized:* voting and decision actions are closed." }]
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Refresh Thread" },
        action_id: "pg_thread_summary",
        value: JSON.stringify({ thread_id: thread.id })
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Account Summary" },
        action_id: "pg_cmd_summary",
        value: JSON.stringify({})
      }
    ]
  });

  return blocks;
}

function appendOpenThreadActions(
  blocks: Array<Record<string, unknown>>,
  options: StoreState["mastermind_options"],
  thread: StoreState["mastermind_threads"][number],
  viewerCanVote: boolean,
  viewerCanFinalize: boolean
): void {
  if (viewerCanVote) {
    const optionButtonChunks = chunkSlackButtons(
      options.map((option) => ({
        type: "button",
        text: { type: "plain_text", text: `Vote ${option.option_key}` },
        action_id: `pg_vote_option_${normalizeSlackActionSuffix(option.option_key)}`,
        value: JSON.stringify({ thread_id: thread.id, option_key: option.option_key })
      }))
    );
    for (const chunk of optionButtonChunks) {
      blocks.push({ type: "actions", elements: chunk });
    }
  } else {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: "*Voting:* you can view this thread, but you cannot vote on it." }]
    });
  }

  if (viewerCanFinalize) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          action_id: "pg_decide_thread_approve",
          value: JSON.stringify({ thread_id: thread.id, decision: "approve" })
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Needs Change" },
          action_id: "pg_decide_thread_needs_change",
          value: JSON.stringify({ thread_id: thread.id, decision: "needs_change" })
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Reject" },
          style: "danger",
          action_id: "pg_decide_thread_reject",
          value: JSON.stringify({ thread_id: thread.id, decision: "reject" })
        }
      ]
    });
  } else {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: "*Final decision:* only owner/manager can finalize this thread." }]
    });
  }
}

function chunkSlackButtons(
  buttons: Array<Record<string, unknown>>,
  chunkSize = 5
): Array<Array<Record<string, unknown>>> {
  const output: Array<Array<Record<string, unknown>>> = [];
  for (let index = 0; index < buttons.length; index += chunkSize) {
    output.push(buttons.slice(index, index + chunkSize));
  }
  return output;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function normalizeSlackActionSuffix(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Standalone utility – also used by Slack route handlers in index.ts */
export function getStringLikeValue(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}
