/**
 * Mobile Reviewer Routes
 * Milestone 12 – Lightweight mobile reviewer web panel.
 *
 * Provides consolidated API endpoints optimised for mobile round-trip
 * efficiency: one call returns pending threads, recent decisions and
 * KPIs.  Quick-action endpoint wraps the existing mastermind decision
 * flow so the reviewer can approve/reject with a single POST.
 */

import { FastifyInstance } from "fastify";
import { RegisterGovernanceRoutesDeps } from "./governanceRoutes.shared";
import { StoreState } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────

interface PendingThread {
  thread_id: string;
  title: string;
  question: string;
  vote_mode: "majority" | "single_reviewer";
  created_at: string;
  vote_count: number;
  entry_count: number;
  options: { option_key: string; title: string }[];
}

interface RecentDecision {
  thread_id: string;
  title: string;
  decision: "approve" | "reject" | "needs_change";
  decided_at: string;
}

interface DashboardPayload {
  ok: true;
  scope: { type: "user" | "team"; id: string; team_key: string | null };
  kpis: {
    pending_threads: number;
    decided_today: number;
    avg_latency_hours: number | null;
  };
  pending: PendingThread[];
  recent_decisions: RecentDecision[];
  evaluated_at: string;
}

// ── Dashboard Helpers ─────────────────────────────────────────────────────────

function buildPendingList(
  snapshot: any, accessibleThreads: any[], canAccessGovernanceThread: any, limit: number
): PendingThread[] {
  const pendingThreads = accessibleThreads
    .filter((t: any) => t.status === "open")
    .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
  return pendingThreads.map((t: any) => ({
    thread_id: t.id, title: t.title, question: t.question,
    vote_mode: t.vote_mode, created_at: t.created_at,
    vote_count: snapshot.mastermind_votes.filter((v: any) => v.thread_id === t.id).length,
    entry_count: snapshot.mastermind_entries.filter((e: any) => e.thread_id === t.id).length,
    options: snapshot.mastermind_options
      .filter((o: any) => o.thread_id === t.id)
      .map((o: any) => ({ option_key: o.option_key, title: o.title }))
  }));
}

function buildRecentDecisionsList(
  snapshot: any, accessibleThreads: any[], limit: number
): RecentDecision[] {
  const decidedThreads = accessibleThreads
    .filter((t: any) => t.status === "decided" || t.status === "closed")
    .sort((a: any, b: any) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at) || 0)
    .slice(0, limit);
  return decidedThreads.map((t: any) => ({
    thread_id: t.id, title: t.title,
    decision: (snapshot.mastermind_outcomes.find((o: any) => o.thread_id === t.id)?.decision as "approve" | "reject" | "needs_change") ?? "approve",
    decided_at: t.decided_at ?? t.created_at
  }));
}

function computeDashboardKpis(
  decided: RecentDecision[], accessibleThreads: any[], pending: PendingThread[]
): DashboardPayload["kpis"] {
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const decidedToday = decided.filter((d) => d.decided_at >= todayIso).length;
  const latencies = accessibleThreads
    .filter((t: any) => (t.status === "decided" || t.status === "closed") && t.decided_at)
    .map((t: any) => new Date(t.decided_at!).getTime() - new Date(t.created_at).getTime())
    .filter((ms: number) => ms > 0);
  const avgLatencyHours = latencies.length > 0
    ? Math.round((latencies.reduce((s: number, v: number) => s + v, 0) / latencies.length / 3600000) * 10) / 10
    : null;
  return { pending_threads: pending.length, decided_today: decidedToday, avg_latency_hours: avgLatencyHours };
}

// ── Registration ──────────────────────────────────────────────────────────

export function registerMobileReviewerRoutes(
  app: FastifyInstance,
  deps: RegisterGovernanceRoutesDeps
): void {
  const { requireAuth, store, resolveGovernanceContextForUser,
    canAccessGovernanceThread, buildMastermindVoteTally, clampInt,
    normalizeMastermindDecision, applySlackDecisionStateUpdate,
    toErrorMessage, safeLogWarn, pruneGovernanceState,
    dispatchSlackGovernanceNotification, resolveGovernanceSettingsForThread } = deps;

  // ── Dashboard ─────────────────────────────────────────────────────────

  app.get<{ Querystring: { team_key?: string; limit?: number } }>(
    "/account/governance/reviewer/dashboard",
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      if (!auth) return;
      const teamKey = request.query?.team_key?.trim().toUpperCase() || undefined;
      const limit = clampInt(Number(request.query?.limit ?? 20), 1, 100);
      const snapshot = store.snapshot();
      const ctx = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
      if (teamKey && !ctx) {
        return reply.code(403).send({ error: "team governance access required" });
      }

      const accessibleThreads = snapshot.mastermind_threads.filter((t) => canAccessGovernanceThread(snapshot, t, auth.user.id));
      const pending = buildPendingList(snapshot, accessibleThreads, canAccessGovernanceThread, limit);
      const recentDecisions = buildRecentDecisionsList(snapshot, accessibleThreads, limit);
      const kpis = computeDashboardKpis(recentDecisions, accessibleThreads, pending);

      const payload: DashboardPayload = {
        ok: true,
        scope: { type: ctx?.scopeType ?? "user", id: ctx?.scopeId ?? auth.user.id, team_key: teamKey ?? null },
        kpis, pending, recent_decisions: recentDecisions,
        evaluated_at: new Date().toISOString()
      };
      return payload;
    }
  );

  // ── Quick Action ──────────────────────────────────────────────────────

  app.post<{
    Body: { thread_id?: string; action?: string; option_key?: string; note?: string };
  }>(
    "/account/governance/reviewer/quick-action",
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      if (!auth) return;

      const threadId = (request.body?.thread_id ?? "").trim();
      const decision = normalizeMastermindDecision(request.body?.action);
      const optionKey = (request.body?.option_key ?? "").trim() || null;
      const note = (request.body?.note ?? "").trim() || null;

      if (!threadId) return reply.code(400).send({ error: "thread_id is required" });
      if (!decision) return reply.code(400).send({ error: "action must be approve, reject, or needs_change" });

      const snapshot = store.snapshot();
      const thread = snapshot.mastermind_threads.find((t) => t.id === threadId);
      if (!thread) return reply.code(404).send({ error: "thread not found" });
      if (!canAccessGovernanceThread(snapshot, thread, auth.user.id)) return reply.code(403).send({ error: "access denied" });
      if (thread.status !== "open") return reply.code(409).send({ error: `thread is already ${thread.status}` });

      try {
        const outcome = applySlackDecisionStateUpdate({ state: snapshot, user: auth.user, threadId, decision, requestedOptionKey: optionKey, note });
        pruneGovernanceState(snapshot);
        await notifySlackBestEffort(snapshot, thread, auth.user, decision, deps);
        return { ok: true, thread_id: threadId, decision, outcome_id: outcome?.id ?? null };
      } catch (err) {
        return reply.code(500).send({ error: toErrorMessage(err) });
      }
    }
  );
}

async function notifySlackBestEffort(
  snapshot: any, thread: any, user: any, decision: string,
  deps: RegisterGovernanceRoutesDeps
): Promise<void> {
  try {
    const settings = deps.resolveGovernanceSettingsForThread(snapshot, thread, user.id);
    const label = decision.replace(/_/g, " ");
    await deps.dispatchSlackGovernanceNotification(
      settings,
      `Mobile reviewer ${user.email ?? user.id} decided *${label}* on thread "${thread.title}"`
    );
  } catch (err) {
    deps.safeLogWarn("Mobile reviewer Slack notification failed", { error: deps.toErrorMessage(err) });
  }
}
