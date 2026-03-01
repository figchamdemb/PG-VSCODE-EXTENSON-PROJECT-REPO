/**
 * Governance Digest Helpers
 * Milestone 11 – Enterprise reviewer digest and governance dashboard.
 *
 * Pure computation over StoreState snapshots.  No side effects.
 * Produces KPI payloads consumed by digest routes.
 */

import { StoreState, PlanTier } from "./types";

// ── Public types ──────────────────────────────────────────────────────────

export interface GovernanceDigestPeriod {
  /** ISO date-time inclusive start */
  from: string;
  /** ISO date-time inclusive end */
  to: string;
}

export interface ThreadKpi {
  id: string;
  title: string;
  status: "open" | "decided" | "closed";
  vote_mode: "majority" | "single_reviewer";
  created_by_email: string;
  created_at: string;
  decided_at: string | null;
  decision: "approve" | "reject" | "needs_change" | null;
  option_count: number;
  vote_count: number;
  entry_count: number;
  /** milliseconds from creation to decision (null if undecided) */
  approval_latency_ms: number | null;
}

export interface EodReportKpi {
  id: string;
  email: string;
  title: string;
  blocker_count: number;
  source: "agent" | "human";
  created_at: string;
}

export interface ReviewerDigestPayload {
  period: GovernanceDigestPeriod;
  scope_type: "user" | "team";
  scope_id: string;
  team_key: string | null;
  kpis: {
    total_threads: number;
    open_threads: number;
    decided_threads: number;
    closed_threads: number;
    blocked_threads: number;
    avg_approval_latency_ms: number | null;
    median_approval_latency_ms: number | null;
    total_votes: number;
    total_entries: number;
    total_eod_reports: number;
    eod_reports_with_blockers: number;
    unique_participants: number;
    pending_acks: number;
    decisions_by_type: {
      approve: number;
      reject: number;
      needs_change: number;
    };
  };
  threads: ThreadKpi[];
  eod_reports: EodReportKpi[];
}

export interface GovernanceDigestDeps {
  canAccessGovernanceThread: (
    state: StoreState,
    thread: StoreState["mastermind_threads"][number],
    userId: string
  ) => boolean;
  hasActiveTeamSeat: (
    state: StoreState,
    teamId: string,
    userId: string
  ) => boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function inPeriod(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}

// ── Core digest builder ───────────────────────────────────────────────────

export function buildReviewerDigest(
  deps: GovernanceDigestDeps,
  state: StoreState,
  scopeType: "user" | "team",
  scopeId: string,
  teamKey: string | null,
  period: GovernanceDigestPeriod
): ReviewerDigestPayload {
  const { from, to } = period;

  // ── Filter threads by scope ──
  const scopeThreads = state.mastermind_threads.filter((t) => {
    if (scopeType === "team") return t.team_id === scopeId;
    return t.team_id === null && t.created_by_user_id === scopeId;
  });

  // ── Filter to period (created OR last-activity inside window) ──
  const periodThreads = scopeThreads.filter(
    (t) => inPeriod(t.created_at, from, to) || inPeriod(t.last_activity_at, from, to)
  );

  // ── Build per-thread KPIs ──
  const threads: ThreadKpi[] = periodThreads.map((t) => {
    const options = state.mastermind_options.filter((o) => o.thread_id === t.id);
    const votes = state.mastermind_votes.filter((v) => v.thread_id === t.id);
    const entries = state.mastermind_entries.filter((e) => e.thread_id === t.id);
    const latencyMs = t.decided_at ? new Date(t.decided_at).getTime() - new Date(t.created_at).getTime() : null;
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      vote_mode: t.vote_mode,
      created_by_email: t.created_by_email,
      created_at: t.created_at,
      decided_at: t.decided_at,
      decision: t.decision,
      option_count: options.length,
      vote_count: votes.length,
      entry_count: entries.length,
      approval_latency_ms: latencyMs,
    };
  });

  // ── Aggregate KPIs ──
  const openThreads = threads.filter((t) => t.status === "open");
  const decidedThreads = threads.filter((t) => t.status === "decided");
  const closedThreads = threads.filter((t) => t.status === "closed");

  // Blocked = open + expired (past expires_at)
  const nowMs = Date.now();
  const blockedThreads = scopeThreads.filter(
    (t) => t.status === "open" && new Date(t.expires_at).getTime() <= nowMs
  );

  const latencies = threads
    .map((t) => t.approval_latency_ms)
    .filter((v): v is number => v !== null);

  const avgLatency = latencies.length > 0
    ? latencies.reduce((sum, v) => sum + v, 0) / latencies.length
    : null;

  const totalVotes = threads.reduce((sum, t) => sum + t.vote_count, 0);
  const totalEntries = threads.reduce((sum, t) => sum + t.entry_count, 0);

  // Unique participants across votes + entries
  const participantIds = new Set<string>();
  for (const t of periodThreads) {
    state.mastermind_votes
      .filter((v) => v.thread_id === t.id)
      .forEach((v) => participantIds.add(v.user_id));
    state.mastermind_entries
      .filter((e) => e.thread_id === t.id)
      .forEach((e) => participantIds.add(e.user_id));
  }

  // EOD reports in period for this scope
  const eodReports = state.governance_eod_reports.filter((r) => {
    if (!inPeriod(r.created_at, from, to)) return false;
    if (scopeType === "team") return r.team_id === scopeId;
    return r.user_id === scopeId;
  });

  const eodKpis: EodReportKpi[] = eodReports.map((r) => ({
    id: r.id,
    email: r.email,
    title: r.title,
    blocker_count: r.blockers.length,
    source: r.source,
    created_at: r.created_at,
  }));

  // Pending acks in scope
  const scopeEventIds = new Set(
    state.governance_decision_events
      .filter((e) => {
        if (scopeType === "team") return e.team_id === scopeId;
        return e.team_id === null;
      })
      .map((e) => e.id)
  );
  const pendingAcks = state.governance_decision_acks.filter(
    (a) => a.status === "pending" && scopeEventIds.has(a.event_id)
  ).length;

  // Decisions by type
  const decisionsByType = { approve: 0, reject: 0, needs_change: 0 };
  for (const t of decidedThreads) {
    if (t.decision && t.decision in decisionsByType) {
      decisionsByType[t.decision]++;
    }
  }

  return {
    period,
    scope_type: scopeType,
    scope_id: scopeId,
    team_key: teamKey,
    kpis: {
      total_threads: threads.length,
      open_threads: openThreads.length,
      decided_threads: decidedThreads.length,
      closed_threads: closedThreads.length,
      blocked_threads: blockedThreads.length,
      avg_approval_latency_ms: avgLatency,
      median_approval_latency_ms: median(latencies),
      total_votes: totalVotes,
      total_entries: totalEntries,
      total_eod_reports: eodKpis.length,
      eod_reports_with_blockers: eodKpis.filter((r) => r.blocker_count > 0).length,
      unique_participants: participantIds.size,
      pending_acks: pendingAcks,
      decisions_by_type: decisionsByType,
    },
    threads,
    eod_reports: eodKpis,
  };
}

// ── Weekly activity summary (cross-scope, admin-only) ─────────────────────

export interface WeeklyActivitySummary {
  period: GovernanceDigestPeriod;
  totals: {
    threads_created: number;
    threads_decided: number;
    votes_cast: number;
    entries_submitted: number;
    eod_reports_submitted: number;
    unique_active_users: number;
    avg_approval_latency_ms: number | null;
  };
  top_contributors: Array<{
    email: string;
    votes: number;
    entries: number;
    eod_reports: number;
  }>;
  blocked_threads: Array<{
    id: string;
    title: string;
    created_by_email: string;
    created_at: string;
    expires_at: string;
  }>;
}

export function buildWeeklyActivitySummary(
  state: StoreState,
  period: GovernanceDigestPeriod
): WeeklyActivitySummary {
  const { from, to } = period;

  const createdThreads = state.mastermind_threads.filter((t) =>
    inPeriod(t.created_at, from, to)
  );

  const decidedThreads = state.mastermind_threads.filter(
    (t) => t.decided_at && inPeriod(t.decided_at, from, to)
  );

  const periodVotes = state.mastermind_votes.filter((v) =>
    inPeriod(v.created_at, from, to)
  );

  const periodEntries = state.mastermind_entries.filter((e) =>
    inPeriod(e.created_at, from, to)
  );

  const periodEod = state.governance_eod_reports.filter((r) =>
    inPeriod(r.created_at, from, to)
  );

  // Active users = anyone who voted, submitted entry, or filed EOD
  const activeUserIds = new Set<string>();
  periodVotes.forEach((v) => activeUserIds.add(v.user_id));
  periodEntries.forEach((e) => activeUserIds.add(e.user_id));
  periodEod.forEach((r) => activeUserIds.add(r.user_id));

  // Approval latency for threads decided in the period
  const latencies = decidedThreads
    .filter((t) => t.decided_at)
    .map((t) => new Date(t.decided_at!).getTime() - new Date(t.created_at).getTime());

  const avgLatency = latencies.length > 0
    ? latencies.reduce((s, v) => s + v, 0) / latencies.length
    : null;

  // Top contributors by combined activity
  const contributorMap = new Map<string, { email: string; votes: number; entries: number; eod_reports: number }>();
  for (const v of periodVotes) {
    const c = contributorMap.get(v.user_id) ?? { email: v.email, votes: 0, entries: 0, eod_reports: 0 };
    c.votes++;
    contributorMap.set(v.user_id, c);
  }
  for (const e of periodEntries) {
    const c = contributorMap.get(e.user_id) ?? { email: e.email, votes: 0, entries: 0, eod_reports: 0 };
    c.entries++;
    contributorMap.set(e.user_id, c);
  }
  for (const r of periodEod) {
    const c = contributorMap.get(r.user_id) ?? { email: r.email, votes: 0, entries: 0, eod_reports: 0 };
    c.eod_reports++;
    contributorMap.set(r.user_id, c);
  }

  const topContributors = [...contributorMap.values()]
    .sort((a, b) => (b.votes + b.entries + b.eod_reports) - (a.votes + a.entries + a.eod_reports))
    .slice(0, 20);

  // Blocked threads = open + past expiry
  const nowMs = Date.now();
  const blocked = state.mastermind_threads
    .filter((t) => t.status === "open" && new Date(t.expires_at).getTime() <= nowMs)
    .map((t) => ({
      id: t.id,
      title: t.title,
      created_by_email: t.created_by_email,
      created_at: t.created_at,
      expires_at: t.expires_at,
    }));

  return {
    period,
    totals: {
      threads_created: createdThreads.length,
      threads_decided: decidedThreads.length,
      votes_cast: periodVotes.length,
      entries_submitted: periodEntries.length,
      eod_reports_submitted: periodEod.length,
      unique_active_users: activeUserIds.size,
      avg_approval_latency_ms: avgLatency,
    },
    top_contributors: topContributors,
    blocked_threads: blocked,
  };
}

// ── Period helpers ─────────────────────────────────────────────────────────

export function buildDefaultWeekPeriod(): GovernanceDigestPeriod {
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

export function buildDayPeriod(daysBack: number = 1): GovernanceDigestPeriod {
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

export function parsePeriodParams(
  fromRaw: string | undefined,
  toRaw: string | undefined
): GovernanceDigestPeriod {
  if (fromRaw && toRaw) {
    return { from: fromRaw, to: toRaw };
  }
  return buildDefaultWeekPeriod();
}
