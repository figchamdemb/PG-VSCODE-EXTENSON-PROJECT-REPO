import { createHmac, timingSafeEqual } from "crypto";
import { FastifyRequest } from "fastify";
import { StateStore } from "./store";
import { PlanTier, StoreState, UserRecord } from "./types";
import { createSlackMastermindHelpers } from "./slackMastermindState";
import { createSlackBlockBuilders, getStringLikeValue as getStringLikeValueImpl } from "./slackBlockBuilders";
import { createSlackCommandHandlers } from "./slackCommandHandlers";
import { createSlackActionHandlers } from "./slackActionHandlers";

export type SlackCommandAction = "help" | "summary" | "eod" | "thread" | "vote" | "decide";

export type SlackEphemeralResponse = {
  response_type: "ephemeral";
  text: string;
  blocks?: Array<Record<string, unknown>>;
  replace_original?: boolean;
};

/** Re-export for backward compat (used by slackRoutes) */
export const getStringLikeValue = getStringLikeValueImpl;

export interface SlackIntegrationDeps {
  SLACK_BOT_TOKEN: string;
  SLACK_WEBHOOK_URL: string;
  SLACK_ALLOWED_TEAM_IDS: Set<string>;
  SLACK_ALLOWED_EMAILS: Set<string>;
  SLACK_REQUEST_MAX_AGE_SECONDS: number;
  store: StateStore;
  normalizeEmail: (value: string | undefined) => string | undefined;
  safeLogWarn: (message: string, context?: Record<string, unknown>) => void;
  safeLogError: (message: string, context?: Record<string, unknown>) => void;
  toErrorMessage: (error: unknown) => string;
  findUserByEmail: (email: string) => UserRecord | undefined;
  getOrCreateUserByEmail: (
    email: string,
    options?: { touchLastLogin?: boolean; createIfMissing?: boolean }
  ) => Promise<UserRecord>;
  buildEntitlementClaims: (
    state: StoreState,
    userId: string,
    installId: string
  ) => { plan: PlanTier; modules: Array<"narrate" | "memorybank" | "bundle"> };
  resolveGovernanceContextForUser: (
    state: StoreState,
    userId: string,
    teamKey: string | undefined,
    requireManage: boolean
  ) => {
    scopeType: "user" | "team";
    scopeId: string;
    plan: PlanTier;
    canManage: boolean;
    team: StoreState["teams"][number] | null;
  } | undefined;
  getGovernanceSettingsForScope: (
    state: StoreState,
    scopeType: "user" | "team",
    scopeId: string
  ) => StoreState["governance_settings"][number] | undefined;
  buildDefaultGovernanceSettings: (
    scopeType: "user" | "team",
    scopeId: string,
    nowIso: string
  ) => StoreState["governance_settings"][number];
  upsertGovernanceSettings: (
    state: StoreState,
    scopeType: "user" | "team",
    scopeId: string,
    patch: Record<string, unknown>
  ) => StoreState["governance_settings"][number];
  normalizeGovernanceVoteMode: (
    value: string | undefined
  ) => "majority" | "single_reviewer" | undefined;
  normalizeMastermindDecision: (
    value: string | undefined
  ) => "approve" | "reject" | "needs_change" | undefined;
  canAccessGovernanceThread: (
    state: StoreState,
    thread: StoreState["mastermind_threads"][number],
    userId: string
  ) => boolean;
  canFinalizeGovernanceThread: (
    state: StoreState,
    thread: StoreState["mastermind_threads"][number],
    userId: string
  ) => boolean;
  resolveGovernanceSettingsForThread: (
    state: StoreState,
    thread: StoreState["mastermind_threads"][number],
    fallbackUserId: string
  ) => StoreState["governance_settings"][number];
  buildMastermindVoteTally: (
    state: StoreState,
    threadId: string
  ) => Array<{ option_key: string; title: string; votes: number; weight: number }>;
  chooseWinningOptionFromVotes: (state: StoreState, threadId: string) => string | undefined;
  createGovernanceDecisionEvent: (
    state: StoreState,
    thread: StoreState["mastermind_threads"][number],
    outcome: StoreState["mastermind_outcomes"][number],
    retentionDays: number
  ) => void;
  pruneGovernanceState: (state: StoreState) => void;
  addDays: (date: Date, days: number) => Date;
  getString: (source: Record<string, unknown>, key: string) => string | undefined;
  getObject: (
    source: Record<string, unknown>,
    pathSegments: string[]
  ) => Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Factory – composes sub-factories and returns all Slack entry-points.
// ---------------------------------------------------------------------------
export function createSlackIntegration(deps: SlackIntegrationDeps) {
  // ------- sub-factory composition -------

  const { applyMastermindThreadCreateStateUpdate, applySlackDecisionStateUpdate } =
    createSlackMastermindHelpers(deps);

  const {
    buildSlackThreadInteractionBlocks, parseSlackActionPayload, isUuidLike,
  } = createSlackBlockBuilders(deps);

  const dispatchFn = (
    settings: StoreState["governance_settings"][number], text: string
  ) => dispatchSlackGovernanceNotification(deps, settings, text);

  const {
    buildSlackHelpText, isSlackHelpCommand, getSlackCommandAction,
    executeSlackGovernanceCommand,
  } = createSlackCommandHandlers({
    ...deps,
    applyMastermindThreadCreateStateUpdate,
    applySlackDecisionStateUpdate,
    buildSlackThreadInteractionBlocks,
    isUuidLike,
    dispatchSlackGovernanceNotification: dispatchFn,
  });

  const resolveEmailFn = (slackUserId: string) =>
    resolveSlackUserEmail(deps, slackUserId);

  const { resolveSlackPayloadUser, executeSlackGovernanceAction } =
    createSlackActionHandlers({
      ...deps,
      resolveSlackUserEmail: resolveEmailFn,
      parseSlackActionPayload,
      buildSlackThreadInteractionBlocks,
      applySlackDecisionStateUpdate,
      executeSlackGovernanceCommand,
      dispatchSlackGovernanceNotification: dispatchFn,
    });

  // ------- public surface -------

  return {
    verifySlackRequestSignature: (
      request: FastifyRequest, rawBody: string, signingSecret: string
    ) => verifySlackRequestSignature(deps, request, rawBody, signingSecret),
    resolveSlackUserEmail: resolveEmailFn,
    dispatchSlackGovernanceNotification: dispatchFn,
    buildSlackHelpText,
    isSlackHelpCommand,
    getSlackCommandAction,
    processSlackCommandAsync: (
      responseUrl: string, slackUserId: string, text: string
    ) => processSlackCommandAsync(
      deps, responseUrl, slackUserId, text,
      resolveEmailFn, getSlackCommandAction, executeSlackGovernanceCommand,
      (url: string, response: SlackEphemeralResponse) => postSlackResponse(deps, url, response)
    ),
    processSlackActionAsync: (
      responseUrl: string | null, payload: Record<string, unknown>,
      actionId: string, action: Record<string, unknown>
    ) => processSlackActionAsync(
      deps, responseUrl, payload, actionId, action,
      resolveSlackPayloadUser, executeSlackGovernanceAction,
      (url: string | null, p: Record<string, unknown>, r: SlackEphemeralResponse) =>
        postSlackActionFollowup(deps, url, p, r)
    ),
    executeSlackGovernanceCommand,
    buildSlackThreadInteractionBlocks,
    applyMastermindThreadCreateStateUpdate,
    applySlackDecisionStateUpdate,
  };
}

// ---------------------------------------------------------------------------
// Implementation functions (module-level).
// ---------------------------------------------------------------------------

function verifySlackRequestSignature(
  deps: SlackIntegrationDeps,
  request: FastifyRequest,
  rawBody: string,
  signingSecret: string
): boolean {
  if (!rawBody) {
    return false;
  }
  const timestampHeader = request.headers["x-slack-request-timestamp"];
  const signatureHeader = request.headers["x-slack-signature"];
  const timestampRaw = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
  const signatureRaw = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!timestampRaw || !signatureRaw || !signatureRaw.startsWith("v0=")) {
    return false;
  }
  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > deps.SLACK_REQUEST_MAX_AGE_SECONDS) {
    return false;
  }
  const basestring = `v0:${timestampRaw}:${rawBody}`;
  const expected = createHmac("sha256", signingSecret).update(basestring).digest("hex");
  const provided = signatureRaw.slice(3);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

async function resolveSlackUserEmail(
  deps: SlackIntegrationDeps,
  slackUserId: string
): Promise<string | null> {
  if (!deps.SLACK_BOT_TOKEN || !slackUserId) {
    return null;
  }
  try {
    const response = await fetch(
      `https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${deps.SLACK_BOT_TOKEN}`
        }
      }
    );
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok || payload.ok !== true) {
      return null;
    }
    const user = payload.user && typeof payload.user === "object" ? payload.user : null;
    const profile =
      user && "profile" in (user as Record<string, unknown>)
        ? (user as Record<string, unknown>).profile
        : null;
    const email =
      profile && typeof profile === "object"
        ? deps.normalizeEmail((profile as Record<string, unknown>).email as string | undefined)
        : undefined;
    return email ?? null;
  } catch (error) {
    deps.safeLogWarn("Slack user lookup failed", {
      error: deps.toErrorMessage(error),
      slack_user_id: slackUserId
    });
    return null;
  }
}

async function dispatchSlackGovernanceNotification(
  deps: SlackIntegrationDeps,
  settings: StoreState["governance_settings"][number],
  text: string
): Promise<void> {
  if (!settings.slack_enabled || !settings.slack_addon_active) {
    return;
  }
  const channel = settings.slack_channel?.trim() || undefined;
  if (deps.SLACK_BOT_TOKEN && channel) {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ channel, text })
    });
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok || payload.ok !== true) {
      throw new Error("Slack chat.postMessage failed");
    }
    return;
  }
  if (deps.SLACK_WEBHOOK_URL) {
    const response = await fetch(deps.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(channel ? { text, channel } : { text })
    });
    if (!response.ok) {
      throw new Error(`Slack webhook failed (${response.status})`);
    }
  }
}

async function postSlackResponse(
  deps: SlackIntegrationDeps,
  responseUrl: string,
  response: SlackEphemeralResponse
): Promise<void> {
  const postOnce = async (
    payload: SlackEphemeralResponse
  ): Promise<{ ok: boolean; status: number; body: string }> => {
    const result = await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return {
      ok: result.ok,
      status: result.status,
      body: await result.text()
    };
  };

  const initial = await postOnce(response);
  if (initial.ok) {
    return;
  }

  if (response.blocks && response.blocks.length > 0) {
    const fallbackPayload: SlackEphemeralResponse = {
      response_type: "ephemeral",
      text: response.text,
      replace_original: response.replace_original
    };
    const fallback = await postOnce(fallbackPayload);
    if (fallback.ok) {
      deps.safeLogWarn("Slack response_url rejected rich payload; delivered plain-text fallback", {
        status: initial.status,
        response_body: initial.body.slice(0, 400)
      });
      return;
    }
    throw new Error(
      `Slack response_url post failed (${fallback.status})`
    );
  }

  throw new Error(`Slack response_url post failed (${initial.status})`);
}

async function postSlackActionFollowup(
  deps: SlackIntegrationDeps,
  responseUrl: string | null,
  payload: Record<string, unknown>,
  response: SlackEphemeralResponse
): Promise<void> {
  if (responseUrl) {
    await postSlackResponse(deps, responseUrl, response);
    return;
  }

  if (!deps.SLACK_BOT_TOKEN) {
    throw new Error("SLACK_BOT_TOKEN is required to post action follow-up without response_url.");
  }

  const channelId =
    deps.getString(deps.getObject(payload, ["channel"]), "id") ??
    deps.getString(payload, "channel");
  if (!channelId) {
    throw new Error("No channel found in Slack action payload and no response_url provided.");
  }

  const userId = deps.getString(deps.getObject(payload, ["user"]), "id");
  const postPayload: Record<string, unknown> = {
    channel: channelId,
    text: response.text
  };
  if (userId) {
    postPayload.user = userId;
  }
  if (response.blocks) {
    postPayload.blocks = response.blocks;
  }

  const endpoint = userId
    ? "https://slack.com/api/chat.postEphemeral"
    : "https://slack.com/api/chat.postMessage";
  const result = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deps.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(postPayload)
  });
  const parsed = (await result.json()) as Record<string, unknown>;
  if (!result.ok || !parsed?.ok) {
    throw new Error(`Slack chat.postEphemeral failed: ${parsed?.error ?? result.status}`);
  }
}

async function processSlackCommandAsync(
  deps: SlackIntegrationDeps,
  responseUrl: string,
  slackUserId: string,
  text: string,
  resolveSlackUserEmailFn: (slackUserId: string) => Promise<string | null>,
  getSlackCommandActionFn: (text: string) => string,
  executeSlackGovernanceCommandFn: (user: UserRecord, text: string) => Promise<SlackEphemeralResponse>,
  postSlackResponseFn: (url: string, response: SlackEphemeralResponse) => Promise<void>
): Promise<void> {
  try {
    const action = getSlackCommandActionFn(text);
    const userEmail = await resolveSlackUserEmailFn(slackUserId);
    if (!userEmail) {
      await postSlackResponseFn(responseUrl, {
        response_type: "ephemeral",
        text: "Could not resolve your Slack email. Ensure Slack bot scope includes `users:read.email`."
      });
      return;
    }

    if (deps.SLACK_ALLOWED_EMAILS.size > 0 && !deps.SLACK_ALLOWED_EMAILS.has(userEmail)) {
      await postSlackResponseFn(responseUrl, {
        response_type: "ephemeral",
        text: `Email ${userEmail} is not authorized for Slack governance commands.`
      });
      return;
    }

    const existingUser = deps.findUserByEmail(userEmail);
    const createIfMissing = action === "eod" || action === "thread" || action === "vote";
    if (!existingUser && !createIfMissing) {
      await postSlackResponseFn(responseUrl, {
        response_type: "ephemeral",
        text: "No linked account found for your Slack email. Sign in once at the web portal, then retry."
      });
      return;
    }
    const user =
      existingUser ??
      (await deps.getOrCreateUserByEmail(userEmail, { touchLastLogin: false, createIfMissing }));
    const payload = await executeSlackGovernanceCommandFn(user, text);
    await postSlackResponseFn(responseUrl, payload);
  } catch (error) {
    deps.safeLogError("Async Slack command execution failed", { error: deps.toErrorMessage(error) });
    try {
      await postSlackResponseFn(responseUrl, {
        response_type: "ephemeral",
        text: `Slack command failed: ${deps.toErrorMessage(error)}`
      });
    } catch (postError) {
      deps.safeLogError("Failed posting async Slack error response", {
        error: deps.toErrorMessage(postError)
      });
    }
  }
}

async function processSlackActionAsync(
  deps: SlackIntegrationDeps,
  responseUrl: string | null,
  payload: Record<string, unknown>,
  actionId: string,
  action: Record<string, unknown>,
  resolveSlackPayloadUserFn: (payload: Record<string, unknown>) => Promise<UserRecord | null>,
  executeSlackGovernanceActionFn: (
    user: UserRecord, actionId: string, action: Record<string, unknown>
  ) => Promise<SlackEphemeralResponse>,
  postSlackActionFollowupFn: (
    url: string | null, payload: Record<string, unknown>, response: SlackEphemeralResponse
  ) => Promise<void>
): Promise<void> {
  try {
    const user = await resolveSlackPayloadUserFn(payload);
    if (!user) {
      await postSlackActionFollowupFn(responseUrl, payload, {
        response_type: "ephemeral",
        text: "Slack user is not authorized."
      });
      return;
    }
    const result = await executeSlackGovernanceActionFn(user, actionId, action);
    await postSlackActionFollowupFn(responseUrl, payload, result);
  } catch (error) {
    deps.safeLogError("Async Slack action execution failed", { error: deps.toErrorMessage(error) });
    try {
      await postSlackActionFollowupFn(responseUrl, payload, {
        response_type: "ephemeral",
        text: `Slack action failed: ${deps.toErrorMessage(error)}`
      });
    } catch (postError) {
      deps.safeLogError("Failed posting async Slack action error response", {
        error: deps.toErrorMessage(postError)
      });
    }
  }
}
