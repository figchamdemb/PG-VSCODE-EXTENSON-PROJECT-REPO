import { randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {
  EnforcementAuditRecord,
  EnforcementPhase,
  EnforcementStatus,
  StoreState
} from "./types";

/* ── Types ──────────────────────────────────────────────── */

type AuthResult = { user: { id: string } };

type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

export type RegisterEnforcementAuditRoutesDeps = {
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => AuthResult | undefined;
  safeLogInfo: (message: string, context?: Record<string, unknown>) => void;
  store: {
    snapshot: () => StoreState;
    update: (mutator: (state: StoreState) => void) => Promise<void>;
  };
  requireAdminPermission: (
    request: FastifyRequest,
    reply: FastifyReply,
    permissionKey: string
  ) => Promise<AdminAccessContext | undefined>;
  adminPermissionKeys: { BOARD_READ: string };
  adminRoutePrefix: string;
};

/* ── Validation helpers ─────────────────────────────────── */

const VALID_PHASES = new Set<EnforcementPhase>([
  "start-session",
  "post-write",
  "pre-push",
  "prompt-guard"
]);

const VALID_STATUSES = new Set<EnforcementStatus>([
  "pass",
  "warn",
  "blocked",
  "error"
]);

function isValidPhase(value: unknown): value is EnforcementPhase {
  return typeof value === "string" && VALID_PHASES.has(value as EnforcementPhase);
}

function isValidStatus(value: unknown): value is EnforcementStatus {
  return typeof value === "string" && VALID_STATUSES.has(value as EnforcementStatus);
}

function clampNumber(opts: { value: unknown; min: number; max: number; fallback: number }): number {
  if (typeof opts.value !== "number" || !Number.isFinite(opts.value)) {
    return opts.fallback;
  }
  return Math.max(opts.min, Math.min(opts.max, Math.round(opts.value)));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
}

/* ── Query helpers ──────────────────────────────────────── */

interface AuditQueryParams {
  phase?: string;
  status?: string;
  since?: string;
  until?: string;
  limit?: string;
  offset?: string;
}

interface AuditFilter {
  phase: EnforcementPhase | undefined;
  status: EnforcementStatus | undefined;
  since: string | undefined;
  until: string | undefined;
  limit: number;
  offset: number;
}

function parseAuditQuery(query: AuditQueryParams): AuditFilter {
  return {
    phase: isValidPhase(query.phase) ? query.phase : undefined,
    status: isValidStatus(query.status) ? query.status : undefined,
    since: query.since || undefined,
    until: query.until || undefined,
    limit: clampNumber({ value: Number(query.limit), min: 1, max: 200, fallback: 50 }),
    offset: clampNumber({ value: Number(query.offset), min: 0, max: 100_000, fallback: 0 })
  };
}

function applyAuditFilter(
  records: EnforcementAuditRecord[],
  filter: AuditFilter,
  userId?: string
): EnforcementAuditRecord[] {
  let filtered = userId ? records.filter((r) => r.user_id === userId) : records;
  if (filter.phase) filtered = filtered.filter((r) => r.phase === filter.phase);
  if (filter.status) filtered = filtered.filter((r) => r.status === filter.status);
  if (filter.since) filtered = filtered.filter((r) => r.created_at >= filter.since!);
  if (filter.until) filtered = filtered.filter((r) => r.created_at <= filter.until!);
  filtered.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
  return filtered.slice(filter.offset, filter.offset + filter.limit);
}

/* ── Telemetry aggregation ──────────────────────────────── */

interface TelemetrySummary {
  total_events: number;
  by_phase: Record<string, number>;
  by_status: Record<string, number>;
  blocker_rate: number;
  avg_risk_score: number;
  top_checks: Array<{ check: string; count: number }>;
  period: { since: string; until: string };
}

function aggregateRecords(inRange: EnforcementAuditRecord[]) {
  const byPhase: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const checkCounts: Record<string, number> = {};
  let riskSum = 0;
  let blockerCount = 0;
  for (const record of inRange) {
    byPhase[record.phase] = (byPhase[record.phase] ?? 0) + 1;
    byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
    riskSum += record.risk_score;
    if (record.status === "blocked") blockerCount += 1;
    for (const check of record.checks_run) checkCounts[check] = (checkCounts[check] ?? 0) + 1;
  }
  return { byPhase, byStatus, checkCounts, riskSum, blockerCount };
}

function buildTelemetrySummary(
  records: EnforcementAuditRecord[], since: string, until: string
): TelemetrySummary {
  const inRange = records.filter((r) => r.created_at >= since && r.created_at <= until);
  const total = inRange.length;
  const { byPhase, byStatus, checkCounts, riskSum, blockerCount } = aggregateRecords(inRange);
  const topChecks = Object.entries(checkCounts)
    .sort(([, a], [, b]) => b - a).slice(0, 10)
    .map(([check, count]) => ({ check, count }));
  return {
    total_events: total, by_phase: byPhase, by_status: byStatus,
    blocker_rate: total > 0 ? Math.round((blockerCount / total) * 10000) / 100 : 0,
    avg_risk_score: total > 0 ? Math.round((riskSum / total) * 100) / 100 : 0,
    top_checks: topChecks, period: { since, until }
  };
}

/* ── Max log size + trim ────────────────────────────────── */

const MAX_AUDIT_LOG_SIZE = 5000;

function trimAuditLog(log: EnforcementAuditRecord[]): void {
  if (log.length > MAX_AUDIT_LOG_SIZE) {
    log.splice(0, log.length - MAX_AUDIT_LOG_SIZE);
  }
}

/* ── Route registration ─────────────────────────────────── */

function validateEventBody(body: Record<string, unknown>, reply: any): unknown | null {
  if (!isValidPhase(body.phase)) {
    return reply.status(400).send({
      error: "invalid_phase",
      message: `phase must be one of: ${[...VALID_PHASES].join(", ")}`
    });
  }
  if (!isValidStatus(body.status)) {
    return reply.status(400).send({
      error: "invalid_status",
      message: `status must be one of: ${[...VALID_STATUSES].join(", ")}`
    });
  }
  return null;
}

function buildAuditRecord(body: Record<string, unknown>, userId: string): EnforcementAuditRecord {
  return {
    id: randomUUID(),
    user_id: userId,
    phase: body.phase as EnforcementPhase,
    status: body.status as EnforcementStatus,
    risk_score: clampNumber({ value: body.risk_score, min: 0, max: 10000, fallback: 0 }),
    blocker_count: clampNumber({ value: body.blocker_count, min: 0, max: 1000, fallback: 0 }),
    warning_count: clampNumber({ value: body.warning_count, min: 0, max: 1000, fallback: 0 }),
    checks_run: normalizeStringArray(body.checks_run),
    findings_summary: typeof body.findings_summary === "string"
      ? body.findings_summary.slice(0, 2000) : "",
    source: typeof body.source === "string"
      ? body.source.trim().slice(0, 100) || "unknown" : "unknown",
    created_at: new Date().toISOString()
  };
}

export function registerEnforcementAuditRoutes(
  app: FastifyInstance,
  deps: RegisterEnforcementAuditRoutesDeps
): void {
  const { adminRoutePrefix } = deps;
  registerPostEventRoute(app, deps);
  registerGetUserAuditRoute(app, deps);
  registerAdminAuditRoute(app, deps, adminRoutePrefix);
  registerAdminTelemetryRoute(app, deps, adminRoutePrefix);
}

function registerPostEventRoute(app: FastifyInstance, deps: RegisterEnforcementAuditRoutesDeps): void {
  app.post("/account/policy/enforcement/event", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) return;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const validationError = validateEventBody(body, reply);
    if (validationError) return validationError;
    const record = buildAuditRecord(body, auth.user.id);
    await deps.store.update((state) => {
      state.enforcement_audit_log.push(record);
      trimAuditLog(state.enforcement_audit_log);
    });
    deps.safeLogInfo("Enforcement audit event recorded", {
      user_id: auth.user.id, phase: record.phase,
      status: record.status, risk_score: record.risk_score, source: record.source
    });
    return { ok: true, event_id: record.id };
  });
}

function registerGetUserAuditRoute(app: FastifyInstance, deps: RegisterEnforcementAuditRoutesDeps): void {
  app.get<{ Querystring: AuditQueryParams }>("/account/policy/enforcement/audit", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) return;
    const filter = parseAuditQuery(request.query);
    const state = deps.store.snapshot();
    const results = applyAuditFilter(state.enforcement_audit_log, filter, auth.user.id);
    return { ok: true, total: results.length, events: results };
  });
}

function registerAdminAuditRoute(app: FastifyInstance, deps: RegisterEnforcementAuditRoutesDeps, prefix: string): void {
  app.get<{ Querystring: AuditQueryParams }>(`${prefix}/board/enforcement/audit`, async (request, reply) => {
    const admin = await deps.requireAdminPermission(request, reply, deps.adminPermissionKeys.BOARD_READ);
    if (!admin) return;
    const filter = parseAuditQuery(request.query);
    const state = deps.store.snapshot();
    const results = applyAuditFilter(state.enforcement_audit_log, filter);
    return { ok: true, total: results.length, events: results };
  });
}

function registerAdminTelemetryRoute(app: FastifyInstance, deps: RegisterEnforcementAuditRoutesDeps, prefix: string): void {
  app.get<{ Querystring: { since?: string; until?: string } }>(`${prefix}/board/enforcement/telemetry`, async (request, reply) => {
    const admin = await deps.requireAdminPermission(request, reply, deps.adminPermissionKeys.BOARD_READ);
    if (!admin) return;
    const state = deps.store.snapshot();
    const now = new Date();
    const since = request.query.since || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const until = request.query.until || now.toISOString();
    const summary = buildTelemetrySummary(state.enforcement_audit_log, since, until);
    return { ok: true, ...summary };
  });
}

/**
 * Helper for auto-logging prompt guard evaluations into the audit trail.
 * Call after `evaluatePromptGuard` in policyRoutes to persist the result.
 */
export async function logPromptGuardAuditEvent(
  store: RegisterEnforcementAuditRoutesDeps["store"],
  userId: string,
  guardStatus: string,
  riskScore: number,
  matchedRules: number,
  source: string
): Promise<void> {
  const status: EnforcementStatus =
    guardStatus === "blocked"
      ? "blocked"
      : guardStatus === "warn"
        ? "warn"
        : "pass";

  const record: EnforcementAuditRecord = {
    id: randomUUID(),
    user_id: userId,
    phase: "prompt-guard",
    status,
    risk_score: riskScore,
    blocker_count: guardStatus === "blocked" ? 1 : 0,
    warning_count: matchedRules,
    checks_run: ["prompt-guard"],
    findings_summary: `Prompt guard ${guardStatus}: risk=${riskScore}, rules=${matchedRules}`,
    source: source || "api",
    created_at: new Date().toISOString()
  };

  await store.update((state) => {
    state.enforcement_audit_log.push(record);
    trimAuditLog(state.enforcement_audit_log);
  });
}
