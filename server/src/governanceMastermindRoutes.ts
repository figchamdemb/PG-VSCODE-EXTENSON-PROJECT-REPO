import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import { RegisterGovernanceRoutesDeps } from "./governanceRoutes.shared";
import { StoreState } from "./types";

export function registerGovernanceMastermindRoutes(
  app: FastifyInstance,
  deps: RegisterGovernanceRoutesDeps
): void {
  const {
    requireAuth,
    store,
    resolveGovernanceContextForUser,
    getGovernanceSettingsForScope,
    buildDefaultGovernanceSettings,
    parseMastermindOptionsInput,
    applyMastermindThreadCreateStateUpdate,
    canAccessGovernanceThread,
    buildMastermindThreadDetail,
    normalizeMastermindEntryType,
    resolveGovernanceSettingsForThread,
    addDays,
    normalizeMastermindDecision,
    applySlackDecisionStateUpdate,
    pruneGovernanceState,
    toErrorMessage,
    buildMastermindVoteTally,
    dispatchSlackGovernanceNotification,
    safeLogWarn,
    clampInt
  } = deps;

  app.get<{
    Querystring: {
      team_key?: string;
      status?: "open" | "decided" | "closed";
      limit?: number;
    };
  }>("/account/governance/mastermind/threads", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const teamKey = request.query?.team_key?.trim().toUpperCase() || undefined;
    const statusFilter = request.query?.status;
    const limit = clampInt(Number(request.query?.limit ?? 50), 1, 300);
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (teamKey && !context) {
      return reply.code(403).send({ error: "team governance access is required for this team_key" });
    }

    const nowMs = Date.now();
    const threads = snapshot.mastermind_threads
      .filter((thread) => {
        if (context) {
          if (context.scopeType === "team") {
            if (thread.team_id !== context.scopeId) {
              return false;
            }
          } else if (thread.team_id !== null || !canAccessGovernanceThread(snapshot, thread, auth.user.id)) {
            return false;
          }
        } else if (!canAccessGovernanceThread(snapshot, thread, auth.user.id)) {
          return false;
        }
        if (new Date(thread.expires_at).getTime() <= nowMs) {
          return false;
        }
        if (statusFilter && thread.status !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
      .slice(0, limit)
      .map((thread) => {
        const optionCount = snapshot.mastermind_options.filter((item) => item.thread_id === thread.id).length;
        const voteCount = snapshot.mastermind_votes.filter((item) => item.thread_id === thread.id).length;
        const entryCount = snapshot.mastermind_entries.filter((item) => item.thread_id === thread.id).length;
        return {
          ...thread,
          option_count: optionCount,
          vote_count: voteCount,
          entry_count: entryCount
        };
      });

    return { ok: true, threads };
  });

  app.get<{
    Params: { thread_id?: string };
  }>("/account/governance/mastermind/thread/:thread_id", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const threadId = request.params?.thread_id?.trim();
    if (!threadId) {
      return reply.code(400).send({ error: "thread_id is required" });
    }

    const snapshot = store.snapshot();
    const thread = snapshot.mastermind_threads.find((item) => item.id === threadId);
    if (!thread || !canAccessGovernanceThread(snapshot, thread, auth.user.id)) {
      return reply.code(404).send({ error: "thread not found" });
    }

    return { ok: true, thread: buildMastermindThreadDetail(snapshot, thread) };
  });

  app.post<{
    Body: {
      thread_id?: string;
      entry_type?: "argument" | "suggestion" | "review";
      message?: string;
    };
  }>("/account/governance/mastermind/entry", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const threadId = request.body?.thread_id?.trim();
    const message = request.body?.message?.trim();
    const entryType = normalizeMastermindEntryType(request.body?.entry_type) ?? "suggestion";
    if (!threadId || !message) {
      return reply.code(400).send({ error: "thread_id and message are required" });
    }

    let entryId = "";
    try {
      await store.update((state) => {
        const thread = state.mastermind_threads.find((item) => item.id === threadId);
        if (!thread) {
          throw new Error("thread not found");
        }
        if (!canAccessGovernanceThread(state, thread, auth.user.id)) {
          throw new Error("not authorized for this thread");
        }
        if (thread.status !== "open") {
          throw new Error("thread is not open");
        }
        const settings = resolveGovernanceSettingsForThread(state, thread, auth.user.id);
        if (message.length > settings.max_debate_chars) {
          throw new Error(`message exceeds max_debate_chars (${settings.max_debate_chars})`);
        }
        const now = new Date();
        const nowIso = now.toISOString();
        thread.last_activity_at = nowIso;
        thread.updated_at = nowIso;
        thread.expires_at = addDays(now, settings.retention_days).toISOString();
        entryId = randomUUID();
        state.mastermind_entries.push({
          id: entryId,
          thread_id: thread.id,
          user_id: auth.user.id,
          email: auth.user.email,
          entry_type: entryType,
          message,
          created_at: nowIso
        });
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    return { ok: true, entry_id: entryId };
  });

  app.post<{
    Body: {
      thread_id?: string;
      option_key?: string;
      rationale?: string;
    };
  }>("/account/governance/mastermind/vote", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const threadId = request.body?.thread_id?.trim();
    const optionKey = request.body?.option_key?.trim().toLowerCase();
    const rationale = request.body?.rationale?.trim() || null;
    if (!threadId || !optionKey) {
      return reply.code(400).send({ error: "thread_id and option_key are required" });
    }

    try {
      await store.update((state) => {
        const thread = state.mastermind_threads.find((item) => item.id === threadId);
        if (!thread) {
          throw new Error("thread not found");
        }
        if (!canAccessGovernanceThread(state, thread, auth.user.id)) {
          throw new Error("not authorized for this thread");
        }
        if (thread.status !== "open") {
          throw new Error("thread is not open");
        }
        const settings = resolveGovernanceSettingsForThread(state, thread, auth.user.id);
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
        thread.expires_at = addDays(now, settings.retention_days).toISOString();
        const existingVote = state.mastermind_votes.find(
          (item) => item.thread_id === thread.id && item.user_id === auth.user.id
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
            user_id: auth.user.id,
            email: auth.user.email,
            weight: 1,
            rationale,
            created_at: nowIso,
            updated_at: nowIso
          });
        }
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    const updated = store.snapshot();
    const thread = updated.mastermind_threads.find((item) => item.id === threadId);
    if (!thread) {
      return reply.code(404).send({ error: "thread not found after update" });
    }
    return {
      ok: true,
      tally: buildMastermindVoteTally(updated, thread.id)
    };
  });

  app.post<{
    Body: {
      thread_id?: string;
      decision?: "approve" | "reject" | "needs_change";
      option_key?: string | null;
      note?: string | null;
    };
  }>("/account/governance/mastermind/decide", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const threadId = request.body?.thread_id?.trim();
    const decision = normalizeMastermindDecision(request.body?.decision) ?? "approve";
    const requestedOptionKey = request.body?.option_key?.trim().toLowerCase() || null;
    const note = request.body?.note?.trim() || null;
    if (!threadId) {
      return reply.code(400).send({ error: "thread_id is required" });
    }
    if (note && note.length > 12000) {
      return reply.code(400).send({ error: "note is too long" });
    }

    let outcomeResult: StoreState["mastermind_outcomes"][number] | null = null;
    try {
      await store.update((state) => {
        outcomeResult = applySlackDecisionStateUpdate({
          state,
          user: auth.user,
          threadId,
          decision,
          requestedOptionKey,
          note
        });
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    const snapshotAfter = store.snapshot();
    const finalOutcome =
      snapshotAfter.mastermind_outcomes
        .filter((item) => item.thread_id === threadId)
        .sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0] ?? outcomeResult;
    if (finalOutcome) {
      const settings =
        finalOutcome.team_id !== null
          ? getGovernanceSettingsForScope(snapshotAfter, "team", finalOutcome.team_id) ??
            buildDefaultGovernanceSettings("team", finalOutcome.team_id, new Date().toISOString())
          : getGovernanceSettingsForScope(snapshotAfter, "user", auth.user.id) ??
            buildDefaultGovernanceSettings("user", auth.user.id, new Date().toISOString());
      if (settings.slack_enabled && settings.slack_addon_active) {
        void dispatchSlackGovernanceNotification(
          settings,
          [
            "*PG Mastermind decision finalized*",
            `Title: ${finalOutcome.title}`,
            `Decision: ${finalOutcome.decision}`,
            `Winning option: ${finalOutcome.winning_option_key ?? "none"}`,
            `By: ${auth.user.email}`,
            `Thread ID: ${finalOutcome.thread_id}`
          ].join("\n")
        ).catch((error) => {
          safeLogWarn("Slack decision dispatch failed", {
            error: toErrorMessage(error),
            thread_id: finalOutcome.thread_id
          });
        });
      }
    }

    return { ok: true, outcome: finalOutcome };
  });

}
