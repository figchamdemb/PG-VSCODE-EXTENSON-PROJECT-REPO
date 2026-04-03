import { createHmac, timingSafeEqual } from "crypto";
import { FastifyRequest } from "fastify";
import { StateStore } from "./store";
import { PlanTier, StoreState, UserRecord } from "./types";
import { createSlackMastermindHelpers } from "./slackMastermindState";
import { createSlackBlockBuilders, getStringLikeValue as getStringLikeValueImpl } from "./slackBlockBuilders";
import { createSlackCommandHandlers } from "./slackCommandHandlers";
import { createSlackActionHandlers } from "./slackActionHandlers";
import { processSlackActionAsync, processSlackCommandAsync } from "./slackAsyncProcessing";

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

export function createSlackIntegration(deps: SlackIntegrationDeps) {
  const runtime = createSlackIntegrationRuntime(deps);
  return {
    verifySlackRequestSignature: (
      request: FastifyRequest,
      rawBody: string,
      signingSecret: string
    ) => verifySlackRequestSignature(deps, request, rawBody, signingSecret),
    resolveSlackUserEmail: runtime.resolveEmailFn,
    dispatchSlackGovernanceNotification: runtime.dispatchFn,
    buildSlackHelpText: runtime.buildSlackHelpText,
    isSlackHelpCommand: runtime.isSlackHelpCommand,
    getSlackCommandAction: runtime.getSlackCommandAction,
    processSlackCommandAsync: runtime.processSlackCommandAsync,
    processSlackActionAsync: runtime.processSlackActionAsync,
    executeSlackGovernanceCommand: runtime.executeSlackGovernanceCommand,
    buildSlackThreadInteractionBlocks: runtime.buildSlackThreadInteractionBlocks,
    applyMastermindThreadCreateStateUpdate: runtime.applyMastermindThreadCreateStateUpdate,
    applySlackDecisionStateUpdate: runtime.applySlackDecisionStateUpdate
  };
}

function createSlackIntegrationRuntime(deps: SlackIntegrationDeps) {
  const shared = createSlackSharedRuntime(deps);
  const handlers = createSlackHandlersRuntime(deps, shared);
  const asyncOps = createSlackAsyncRuntime(deps, shared, handlers);
  return { ...shared, ...handlers, ...asyncOps };
}

function createSlackSharedRuntime(deps: SlackIntegrationDeps) {
  const { applyMastermindThreadCreateStateUpdate, applySlackDecisionStateUpdate } = createSlackMastermindHelpers(deps);
  const { buildSlackThreadInteractionBlocks, parseSlackActionPayload, isUuidLike } = createSlackBlockBuilders(deps);
  const resolveEmailFn = (slackUserId: string) => resolveSlackUserEmail(deps, slackUserId);
  const dispatchFn = (settings: StoreState["governance_settings"][number], text: string) =>
    dispatchSlackGovernanceNotification(deps, settings, text);
  return {
    applyMastermindThreadCreateStateUpdate,
    applySlackDecisionStateUpdate,
    buildSlackThreadInteractionBlocks,
    parseSlackActionPayload,
    isUuidLike,
    resolveEmailFn,
    dispatchFn
  };
}

function createSlackHandlersRuntime(
  deps: SlackIntegrationDeps,
  shared: ReturnType<typeof createSlackSharedRuntime>
) {
  const commandHandlers = createSlackCommandHandlers({
    ...deps,
    applyMastermindThreadCreateStateUpdate: shared.applyMastermindThreadCreateStateUpdate,
    applySlackDecisionStateUpdate: shared.applySlackDecisionStateUpdate,
    buildSlackThreadInteractionBlocks: shared.buildSlackThreadInteractionBlocks,
    isUuidLike: shared.isUuidLike,
    dispatchSlackGovernanceNotification: shared.dispatchFn
  });
  const actionHandlers = createSlackActionHandlers({
    ...deps,
    resolveSlackUserEmail: shared.resolveEmailFn,
    parseSlackActionPayload: shared.parseSlackActionPayload,
    buildSlackThreadInteractionBlocks: shared.buildSlackThreadInteractionBlocks,
    applySlackDecisionStateUpdate: shared.applySlackDecisionStateUpdate,
    executeSlackGovernanceCommand: commandHandlers.executeSlackGovernanceCommand,
    dispatchSlackGovernanceNotification: shared.dispatchFn
  });
  return { ...commandHandlers, ...actionHandlers };
}

function createSlackAsyncRuntime(
  deps: SlackIntegrationDeps,
  shared: Pick<ReturnType<typeof createSlackSharedRuntime>, "resolveEmailFn">,
  handlers: Pick<
    ReturnType<typeof createSlackHandlersRuntime>,
    "getSlackCommandAction" | "executeSlackGovernanceCommand" | "resolveSlackPayloadUser" | "executeSlackGovernanceAction"
  >
) {
  const postResponseFn = (url: string, response: SlackEphemeralResponse) =>
    postSlackResponse(deps, url, response);
  const postActionFollowupFn = (
    responseUrl: string | null,
    payload: Record<string, unknown>,
    response: SlackEphemeralResponse
  ) => postSlackActionFollowup(deps, responseUrl, payload, response);
  return {
    processSlackCommandAsync: (responseUrl: string, slackUserId: string, text: string) =>
      processSlackCommandAsync(
        deps,
        responseUrl,
        slackUserId,
        text,
        shared.resolveEmailFn,
        handlers.getSlackCommandAction,
        handlers.executeSlackGovernanceCommand,
        postResponseFn
      ),
    processSlackActionAsync: (
      responseUrl: string | null,
      payload: Record<string, unknown>,
      actionId: string,
      action: Record<string, unknown>
    ) =>
      processSlackActionAsync(
        deps,
        responseUrl,
        payload,
        actionId,
        action,
        handlers.resolveSlackPayloadUser,
        handlers.executeSlackGovernanceAction,
        postActionFollowupFn
      )
  };
}

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

