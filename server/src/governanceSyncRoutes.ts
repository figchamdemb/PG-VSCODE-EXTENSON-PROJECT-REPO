import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import { RegisterGovernanceRoutesDeps } from "./governanceRoutes.shared";

export function registerGovernanceSyncRoutes(
  app: FastifyInstance,
  deps: RegisterGovernanceRoutesDeps
): void {
  const {
    requireAuth,
    store,
    clampInt,
    hasActiveTeamSeat,
    pruneGovernanceState,
    toErrorMessage,
    getGovernanceSettingsForScope,
    dispatchSlackGovernanceNotification,
    safeLogWarn
  } = deps;

  app.get<{
    Querystring: { since_sequence?: number; limit?: number };
  }>("/account/governance/sync/pull", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const sinceSequence = Math.max(0, Number(request.query?.since_sequence ?? 0));
    const limit = clampInt(Number(request.query?.limit ?? 100), 1, 500);
    const snapshot = store.snapshot();
    const nowMs = Date.now();

    const ackByEventId = new Map(
      snapshot.governance_decision_acks
        .filter((ack) => ack.user_id === auth.user.id)
        .map((ack) => [ack.event_id, ack] as const)
    );
    const events = snapshot.governance_decision_events
      .filter((event) => {
        if (event.sequence <= sinceSequence) {
          return false;
        }
        if (new Date(event.expires_at).getTime() <= nowMs) {
          return false;
        }
        if (ackByEventId.has(event.id)) {
          return true;
        }
        if (!event.team_id) {
          return false;
        }
        return hasActiveTeamSeat(snapshot, event.team_id, auth.user.id);
      })
      .sort((a, b) => a.sequence - b.sequence)
      .slice(0, limit)
      .map((event) => ({
        ...event,
        ack: ackByEventId.get(event.id) ?? null
      }));

    return {
      ok: true,
      events,
      cursor: events.length > 0 ? events[events.length - 1].sequence : sinceSequence
    };
  });

  app.post<{
    Body: {
      event_id?: string;
      status?: "applied" | "conflict" | "skipped";
      note?: string | null;
    };
  }>("/account/governance/sync/ack", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const eventId = request.body?.event_id?.trim();
    const status = request.body?.status;
    const note = request.body?.note?.trim() || null;
    if (!eventId || !status) {
      return reply.code(400).send({ error: "event_id and status are required" });
    }
    if (status !== "applied" && status !== "conflict" && status !== "skipped") {
      return reply.code(400).send({ error: "invalid ack status" });
    }
    if (note && note.length > 12000) {
      return reply.code(400).send({ error: "note is too long" });
    }

    try {
      await store.update((state) => {
        const event = state.governance_decision_events.find((item) => item.id === eventId);
        if (!event) {
          throw new Error("event not found");
        }
        if (new Date(event.expires_at).getTime() <= Date.now()) {
          throw new Error("event expired");
        }
        if (event.team_id && !hasActiveTeamSeat(state, event.team_id, auth.user.id)) {
          const existingAck = state.governance_decision_acks.find(
            (item) => item.event_id === event.id && item.user_id === auth.user.id
          );
          if (!existingAck) {
            throw new Error("you are not eligible to acknowledge this event");
          }
        }
        const nowIso = new Date().toISOString();
        const existing = state.governance_decision_acks.find(
          (item) => item.event_id === event.id && item.user_id === auth.user.id
        );
        if (existing) {
          existing.status = status;
          existing.note = note;
          existing.updated_at = nowIso;
          existing.acked_at = nowIso;
        } else {
          state.governance_decision_acks.push({
            id: randomUUID(),
            event_id: event.id,
            user_id: auth.user.id,
            status,
            note,
            updated_at: nowIso,
            acked_at: nowIso
          });
        }
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    const snapshot = store.snapshot();
    const ackEvent = snapshot.governance_decision_events.find((item) => item.id === eventId) ?? null;
    if (ackEvent) {
      const settings =
        ackEvent.team_id !== null
          ? getGovernanceSettingsForScope(snapshot, "team", ackEvent.team_id)
          : getGovernanceSettingsForScope(snapshot, "user", auth.user.id);
      if (settings?.slack_enabled && settings.slack_addon_active) {
        void dispatchSlackGovernanceNotification(
          settings,
          [
            "*PG decision ack received*",
            `By: ${auth.user.email}`,
            `Status: ${status}`,
            `Summary: ${ackEvent.summary}`,
            `Thread ID: ${ackEvent.thread_id}`,
            note ? `Note: ${note}` : null
          ]
            .filter((item): item is string => Boolean(item))
            .join("\n")
        ).catch((error) => {
          safeLogWarn("Slack decision ack dispatch failed", {
            error: toErrorMessage(error),
            event_id: ackEvent?.id,
            status
          });
        });
      }
    }
    return { ok: true, event_id: eventId, status };
  });

}
