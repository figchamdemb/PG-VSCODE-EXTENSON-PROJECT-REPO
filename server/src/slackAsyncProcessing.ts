import { UserRecord } from "./types";
import type { SlackEphemeralResponse, SlackIntegrationDeps } from "./slackIntegration";

export async function processSlackCommandAsync(
  deps: SlackIntegrationDeps,
  responseUrl: string,
  slackUserId: string,
  text: string,
  resolveSlackUserEmailFn: (slackUserId: string) => Promise<string | null>,
  getSlackCommandActionFn: (text: string) => string,
  executeSlackGovernanceCommandFn: (
    user: UserRecord,
    text: string
  ) => Promise<SlackEphemeralResponse>,
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

export async function processSlackActionAsync(
  deps: SlackIntegrationDeps,
  responseUrl: string | null,
  payload: Record<string, unknown>,
  actionId: string,
  action: Record<string, unknown>,
  resolveSlackPayloadUserFn: (payload: Record<string, unknown>) => Promise<UserRecord | null>,
  executeSlackGovernanceActionFn: (
    user: UserRecord,
    actionId: string,
    action: Record<string, unknown>
  ) => Promise<SlackEphemeralResponse>,
  postSlackActionFollowupFn: (
    url: string | null,
    payload: Record<string, unknown>,
    response: SlackEphemeralResponse
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
