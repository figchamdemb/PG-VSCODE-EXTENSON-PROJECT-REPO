import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import { RegisterGovernanceRoutesDeps } from "./governanceRoutes.shared";
import { StoreState } from "./types";

export function registerGovernanceSettingsRoutes(
  app: FastifyInstance,
  deps: RegisterGovernanceRoutesDeps
): void {
  const {
    requireAuth,
    store,
    resolveGovernanceContextForUser,
    getGovernanceSettingsForScope,
    buildDefaultGovernanceSettings,
    governanceSlackAddonSeatPriceCents,
    upsertGovernanceSettings,
    normalizeGovernanceVoteMode,
    pruneGovernanceState,
    dispatchSlackGovernanceNotification,
    normalizeStringList,
    normalizeIsoDateOrNull,
    parseMastermindOptionsInput,
    applyMastermindThreadCreateStateUpdate,
    clampInt,
    toErrorMessage,
    safeLogWarn
  } = deps;

  app.get<{
    Querystring: { team_key?: string };
  }>("/account/governance/settings", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const teamKey = request.query?.team_key?.trim().toUpperCase() || undefined;
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (!context) {
      return reply.code(403).send({
        error:
          "governance settings are available for team/enterprise plans (or pro when enabled), and team access is required"
      });
    }

    const settings =
      getGovernanceSettingsForScope(snapshot, context.scopeType, context.scopeId) ??
      buildDefaultGovernanceSettings(context.scopeType, context.scopeId, new Date().toISOString());
    return {
      ok: true,
      scope_type: context.scopeType,
      scope_id: context.scopeId,
      team_key: context.team?.team_key ?? null,
      plan: context.plan,
      can_manage: context.canManage,
      settings,
      add_on_catalog: {
        slack_bridge: {
          available: true,
          addon_active: settings.slack_addon_active,
          seat_price_cents_per_month: governanceSlackAddonSeatPriceCents
        }
      }
    };
  });

  app.post<{
    Body: {
      team_key?: string;
      slack_enabled?: boolean;
      slack_channel?: string | null;
      vote_mode?: "majority" | "single_reviewer";
      retention_days?: number;
      max_debate_chars?: number;
    };
  }>("/account/governance/settings/update", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase() || undefined;
    const currentSnapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(
      currentSnapshot,
      auth.user.id,
      teamKey,
      Boolean(teamKey)
    );
    if (!context) {
      return reply.code(403).send({
        error:
          "you do not have access to governance settings for this scope, or the plan does not include governance"
      });
    }

    let settingsResult: StoreState["governance_settings"][number] | null = null;
    try {
      await store.update((state) => {
        const liveContext = resolveGovernanceContextForUser(
          state,
          auth.user.id,
          teamKey,
          Boolean(teamKey)
        );
        if (!liveContext || !liveContext.canManage) {
          throw new Error("governance settings require owner/manager access");
        }
        settingsResult = upsertGovernanceSettings(
          state,
          liveContext.scopeType,
          liveContext.scopeId,
          {
            slack_enabled: request.body?.slack_enabled,
            slack_channel: request.body?.slack_channel,
            vote_mode: normalizeGovernanceVoteMode(request.body?.vote_mode),
            retention_days: request.body?.retention_days,
            max_debate_chars: request.body?.max_debate_chars
          }
        );
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    return {
      ok: true,
      scope_type: context.scopeType,
      scope_id: context.scopeId,
      team_key: context.team?.team_key ?? null,
      settings: settingsResult
    };
  });

  app.post<{
    Body: { team_key?: string; message?: string };
  }>("/account/governance/slack/test", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const message = request.body?.message?.trim();
    if (!message) {
      return reply.code(400).send({ error: "message is required" });
    }
    if (message.length > 1000) {
      return reply.code(400).send({ error: "message is too long" });
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase() || undefined;
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (!context) {
      return reply.code(403).send({ error: "governance context not found for this account/scope" });
    }
    const settings =
      getGovernanceSettingsForScope(snapshot, context.scopeType, context.scopeId) ??
      buildDefaultGovernanceSettings(context.scopeType, context.scopeId, new Date().toISOString());
    if (!settings.slack_enabled || !settings.slack_addon_active) {
      return reply.code(400).send({
        error: "Slack dispatch is disabled for this scope. Enable slack and add-on first."
      });
    }
    try {
      await dispatchSlackGovernanceNotification(
        settings,
        `*PG Slack test message*\nFrom: ${auth.user.email}\nScope: ${
          context.team?.team_key ?? "personal"
        }\nMessage: ${message}`
      );
    } catch (error) {
      return reply.code(502).send({ error: `Slack dispatch failed: ${toErrorMessage(error)}` });
    }
    return { ok: true, dispatched: true, team_key: context.team?.team_key ?? null };
  });

  app.post<{
    Body: {
      team_key?: string;
      title?: string;
      summary?: string;
      work_started_at?: string | null;
      work_ended_at?: string | null;
      changed_files?: string[];
      blockers?: string[];
      source?: "agent" | "human";
      agent_name?: string | null;
    };
  }>("/account/governance/eod/report", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const title = request.body?.title?.trim();
    const summary = request.body?.summary?.trim();
    if (!title || !summary) {
      return reply.code(400).send({ error: "title and summary are required" });
    }
    if (title.length > 180 || summary.length > 12000) {
      return reply.code(400).send({ error: "title or summary is too long" });
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase() || undefined;
    const changedFiles = normalizeStringList(request.body?.changed_files, 120, 260);
    const blockers = normalizeStringList(request.body?.blockers, 40, 300);
    const source = request.body?.source === "agent" ? "agent" : "human";
    const agentName = request.body?.agent_name?.trim() || null;
    if (agentName && agentName.length > 80) {
      return reply.code(400).send({ error: "agent_name is too long" });
    }

    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (!context) {
      return reply.code(403).send({
        error:
          "EOD governance reports are available for team/enterprise plans (or pro when enabled), and team access is required"
      });
    }

    const reportId = randomUUID();
    try {
      await store.update((state) => {
        const liveContext = resolveGovernanceContextForUser(state, auth.user.id, teamKey, false);
        if (!liveContext) {
          throw new Error("governance context was not found");
        }
        const nowIso = new Date().toISOString();
        state.governance_eod_reports.push({
          id: reportId,
          user_id: auth.user.id,
          email: auth.user.email,
          team_id: liveContext.scopeType === "team" ? liveContext.scopeId : null,
          title,
          summary,
          work_started_at: normalizeIsoDateOrNull(request.body?.work_started_at),
          work_ended_at: normalizeIsoDateOrNull(request.body?.work_ended_at),
          changed_files: changedFiles,
          blockers,
          source,
          agent_name: agentName,
          created_at: nowIso,
          updated_at: nowIso
        });
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    const effectiveSettings =
      getGovernanceSettingsForScope(snapshot, context.scopeType, context.scopeId) ??
      buildDefaultGovernanceSettings(context.scopeType, context.scopeId, new Date().toISOString());
    if (effectiveSettings.slack_enabled && effectiveSettings.slack_addon_active) {
      void dispatchSlackGovernanceNotification(
        effectiveSettings,
        [
          "*PG EOD submitted*",
          `Team: ${context.team?.team_key ?? "personal"}`,
          `By: ${auth.user.email}`,
          `Title: ${title}`,
          `Source: ${source}${agentName ? ` (${agentName})` : ""}`
        ].join("\n")
      ).catch((error) => {
        safeLogWarn("Slack EOD dispatch failed", {
          error: toErrorMessage(error),
          report_id: reportId
        });
      });
    }
    return {
      ok: true,
      report_id: reportId,
      team_key: context.team?.team_key ?? null,
      dispatch: {
        slack: effectiveSettings.slack_enabled && effectiveSettings.slack_addon_active
      }
    };
  });

  app.get<{
    Querystring: { team_key?: string; limit?: number };
  }>("/account/governance/eod/list", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const teamKey = request.query?.team_key?.trim().toUpperCase() || undefined;
    const limit = clampInt(Number(request.query?.limit ?? 50), 1, 200);
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (!context) {
      return reply.code(403).send({
        error:
          "EOD governance reports are available for team/enterprise plans (or pro when enabled), and team access is required"
      });
    }

    const reports = snapshot.governance_eod_reports
      .filter((item) => {
        if (context.scopeType === "team") {
          return item.team_id === context.scopeId;
        }
        return item.user_id === auth.user.id && item.team_id === null;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);

    return { ok: true, reports };
  });

  app.post<{
    Body: {
      team_key?: string;
      title?: string;
      question?: string;
      vote_mode?: "majority" | "single_reviewer";
      options?: Array<{ option_key?: string; title?: string; rationale?: string | null }>;
    };
  }>("/account/governance/mastermind/thread/create", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase() || undefined;
    const title = request.body?.title?.trim();
    const question = request.body?.question?.trim();
    if (!title || !question) {
      return reply.code(400).send({ error: "title and question are required" });
    }
    if (title.length > 180) {
      return reply.code(400).send({ error: "title is too long" });
    }

    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (!context) {
      return reply.code(403).send({
        error:
          "mastermind is available for team/enterprise plans (or pro when enabled), and team access is required"
      });
    }
    const contextSettings =
      getGovernanceSettingsForScope(snapshot, context.scopeType, context.scopeId) ??
      buildDefaultGovernanceSettings(context.scopeType, context.scopeId, new Date().toISOString());
    if (question.length > contextSettings.max_debate_chars) {
      return reply.code(400).send({
        error: `question exceeds max_debate_chars (${contextSettings.max_debate_chars})`
      });
    }
    const options = parseMastermindOptionsInput(
      request.body?.options,
      contextSettings.max_debate_chars
    );
    if (options.length < 2) {
      return reply.code(400).send({ error: "at least two options are required for vote" });
    }

    let threadId = "";
    let voteMode: "majority" | "single_reviewer" = contextSettings.vote_mode;
    try {
      await store.update((state) => {
        const result = applyMastermindThreadCreateStateUpdate({
          state,
          user: auth.user,
          teamKey,
          title,
          question,
          parsedOptions: options,
          requestedVoteMode: request.body?.vote_mode
        });
        threadId = result.threadId;
        voteMode = result.voteMode;
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    if (contextSettings.slack_enabled && contextSettings.slack_addon_active) {
      void dispatchSlackGovernanceNotification(
        contextSettings,
        [
          "*PG Mastermind thread opened*",
          `Team: ${context.team?.team_key ?? "personal"}`,
          `By: ${auth.user.email}`,
          `Title: ${title}`,
          `Question: ${question}`,
          `Vote mode: ${voteMode}`,
          `Thread ID: ${threadId}`
        ].join("\n")
      ).catch((error) => {
        safeLogWarn("Slack thread dispatch failed", {
          error: toErrorMessage(error),
          thread_id: threadId
        });
      });
    }

    return {
      ok: true,
      thread_id: threadId,
      vote_mode: voteMode,
      options
    };
  });

}
