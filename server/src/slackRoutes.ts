import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getStringLikeValue } from "./slackIntegration";
import { UserRecord } from "./types";

interface SlackObject {
  verifySlackRequestSignature: (
    request: FastifyRequest,
    rawBody: string,
    signingSecret: string
  ) => boolean;
  isSlackHelpCommand: (text: string) => boolean;
  buildSlackHelpText: () => string;
  processSlackCommandAsync: (
    responseUrl: string,
    slackUserId: string,
    text: string
  ) => void;
  processSlackActionAsync: (
    responseUrl: string | null,
    payload: Record<string, unknown>,
    actionId: string,
    action: Record<string, unknown>
  ) => void;
  resolveSlackUserEmail: (slackUserId: string) => Promise<string | null>;
  executeSlackGovernanceCommand: (
    user: UserRecord,
    text: string
  ) => Promise<{ response_type: string; text: string }>;
}

export interface RegisterSlackRoutesDeps {
  slackCommandsEnabled: boolean;
  slackSigningSecret: string;
  slackBotToken: string;
  slackWebhookUrl: string;
  slackAllowedTeamIds: Set<string>;
  slackAllowedEmails: Set<string>;
  slack: SlackObject;
  getOrCreateUserByEmail: (
    email: string,
    options?: { touchLastLogin?: boolean; createIfMissing?: boolean }
  ) => Promise<UserRecord>;
  getString: (
    source: Record<string, unknown>,
    key: string
  ) => string | undefined;
}

export function registerSlackRoutes(
  app: FastifyInstance,
  deps: RegisterSlackRoutesDeps
): void {
  const {
    slackCommandsEnabled,
    slackSigningSecret,
    slackBotToken,
    slackWebhookUrl,
    slackAllowedTeamIds,
    slackAllowedEmails,
    slack,
    getOrCreateUserByEmail,
    getString
  } = deps;

  app.get("/integrations/slack/health", async () => ({
    ok: true,
    commands_enabled: slackCommandsEnabled,
    has_signing_secret: Boolean(slackSigningSecret),
    has_bot_token: Boolean(slackBotToken),
    has_webhook_url: Boolean(slackWebhookUrl),
    team_allowlist_enabled: slackAllowedTeamIds.size > 0,
    email_allowlist_enabled: slackAllowedEmails.size > 0
  }));

  app.post<{
    Body: Record<string, unknown> & { __raw_form_body?: string };
  }>("/integrations/slack/commands", async (request, reply) => {
    if (!slackCommandsEnabled) {
      return reply.code(503).send({
        response_type: "ephemeral",
        text: "Slack commands are disabled on this server."
      });
    }
    if (!slackSigningSecret) {
      return reply.code(503).send({
        response_type: "ephemeral",
        text: "Slack signing secret is not configured."
      });
    }
    const rawBody =
      typeof request.body?.__raw_form_body === "string"
        ? request.body.__raw_form_body
        : "";
    if (
      !slack.verifySlackRequestSignature(request, rawBody, slackSigningSecret)
    ) {
      return reply.code(401).send({
        response_type: "ephemeral",
        text: "Invalid Slack signature."
      });
    }

    const teamId = getStringLikeValue(request.body, "team_id");
    if (
      slackAllowedTeamIds.size > 0 &&
      (!teamId || !slackAllowedTeamIds.has(teamId))
    ) {
      return reply.code(403).send({
        response_type: "ephemeral",
        text: "Slack workspace is not allowed."
      });
    }

    const text = getStringLikeValue(request.body, "text") ?? "";
    if (slack.isSlackHelpCommand(text)) {
      return reply.send({
        response_type: "ephemeral",
        text: slack.buildSlackHelpText()
      });
    }

    const responseUrl = getStringLikeValue(request.body, "response_url");
    const slackUserId = getStringLikeValue(request.body, "user_id");
    if (!slackUserId) {
      return reply.code(400).send({
        response_type: "ephemeral",
        text: "Slack user id is missing."
      });
    }

    if (responseUrl) {
      reply.send({ response_type: "ephemeral", text: "Processing command..." });
      void slack.processSlackCommandAsync(responseUrl, slackUserId, text);
      return;
    }

    const userEmail = await slack.resolveSlackUserEmail(slackUserId);
    if (!userEmail) {
      return reply.send({
        response_type: "ephemeral",
        text: "Could not resolve your Slack email. Ensure Slack bot scope includes `users:read.email`."
      });
    }
    if (slackAllowedEmails.size > 0 && !slackAllowedEmails.has(userEmail)) {
      return reply.code(403).send({
        response_type: "ephemeral",
        text: `Email ${userEmail} is not authorized for Slack governance commands.`
      });
    }

    const user = await getOrCreateUserByEmail(userEmail);
    const result = await slack.executeSlackGovernanceCommand(user, text);
    return reply.send(result);
  });

  app.post<{
    Body: Record<string, unknown> & { __raw_form_body?: string };
  }>("/integrations/slack/actions", async (request, reply) => {
    if (!slackCommandsEnabled) {
      return reply
        .code(503)
        .send({ text: "Slack actions are disabled on this server." });
    }
    if (!slackSigningSecret) {
      return reply
        .code(503)
        .send({ text: "Slack signing secret is not configured." });
    }
    const rawBody =
      typeof request.body?.__raw_form_body === "string"
        ? request.body.__raw_form_body
        : "";
    if (
      !slack.verifySlackRequestSignature(request, rawBody, slackSigningSecret)
    ) {
      return reply.code(401).send({ text: "Invalid Slack signature." });
    }

    const payloadRaw = getStringLikeValue(request.body, "payload");
    if (!payloadRaw) {
      return reply.code(400).send({ text: "Missing Slack action payload." });
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(payloadRaw) as Record<string, unknown>;
    } catch {
      return reply
        .code(400)
        .send({ text: "Invalid Slack action payload JSON." });
    }

    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    if (
      actions.length === 0 ||
      typeof actions[0] !== "object" ||
      !actions[0]
    ) {
      return reply.code(400).send({ text: "No Slack action found." });
    }
    const action = actions[0] as Record<string, unknown>;
    const actionId =
      typeof action.action_id === "string" ? action.action_id.trim() : "";
    if (!actionId) {
      return reply.code(400).send({ text: "Invalid Slack action id." });
    }

    const responseUrl = getString(payload, "response_url") ?? null;
    reply.send({ response_type: "ephemeral", text: "Processing action..." });
    void slack.processSlackActionAsync(responseUrl, payload, actionId, action);
    return;
  });
}
