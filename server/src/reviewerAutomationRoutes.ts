/** Reviewer Automation Routes — M10A Enterprise reviewer automation policy. */

import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import type { RegisterGovernanceRoutesDeps } from "./governanceRoutes.shared";
import {
  applyPolicyUpdate,
  assignReviewersForThread,
  buildAssignmentNotificationText,
  buildDefaultPolicy,
  buildEscalationNotificationText,
  buildPolicyStatusReport,
  checkApprovalGate,
  checkThreadSla,
  findPolicyForScope,
  resolveEscalationTargets,
  validateReviewerPolicyInput,
} from "./reviewerAutomationEvaluator";
import type { ReviewerPolicyInput } from "./reviewerAutomationEvaluator";

// ── Registration ────────────────────────────────────────────────────────

export function registerReviewerAutomationRoutes(
  app: FastifyInstance,
  deps: RegisterGovernanceRoutesDeps
): void {
  const {
    requireAuth,
    store,
    resolveGovernanceContextForUser,
    resolveEffectivePlan,
    canAccessGovernanceThread,
    dispatchSlackGovernanceNotification,
    getGovernanceSettingsForScope,
    buildDefaultGovernanceSettings,
    normalizeEmail,
    safeLogWarn,
    toErrorMessage,
  } = deps;

  // ── Helpers ─────────────────────────────────────────────────────────

  function requireEnterprisePlan(
    userId: string,
    now: Date
  ): { allowed: true } | { allowed: false; error: string } {
    const snapshot = store.snapshot();
    const { plan } = resolveEffectivePlan(snapshot, userId, now);
    if (plan !== "enterprise") {
      return { allowed: false, error: "Reviewer automation policy requires Enterprise plan" };
    }
    return { allowed: true };
  }

  type ScopeResult = { scopeType: "user" | "team"; scopeId: string };

  function resolveScope(
    auth: { user: { id: string } },
    teamKey: string | undefined,
    requireManage: boolean,
    reply: any
  ): ScopeResult | null {
    const snapshot = store.snapshot();
    const ctx = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, requireManage);
    if (teamKey && !ctx) {
      reply.code(403).send({ error: requireManage ? "team manage access required" : "team governance access required" });
      return null;
    }
    return { scopeType: (ctx?.scopeType ?? "user") as "user" | "team", scopeId: ctx?.scopeId ?? auth.user.id };
  }

  async function notifySlackForScope(
    scopeType: "user" | "team", scopeId: string, text: string | null
  ): Promise<void> {
    if (!text) return;
    try {
      const snapshot = store.snapshot();
      const settings = getGovernanceSettingsForScope(snapshot, scopeType, scopeId)
        ?? buildDefaultGovernanceSettings(scopeType, scopeId, new Date().toISOString());
      await dispatchSlackGovernanceNotification(settings, text);
    } catch (err) {
      safeLogWarn("Reviewer automation Slack notification failed", { error: toErrorMessage(err) });
    }
  }

  // ── GET /account/governance/reviewer-policy ─────────────────────────

  app.get<{ Querystring: { team_key?: string } }>(
    "/account/governance/reviewer-policy",
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      if (!auth) return;
      const scope = resolveScope(auth, request.query?.team_key?.trim().toUpperCase() || undefined, false, reply);
      if (!scope) return;
      const policy = findPolicyForScope(store.snapshot(), scope.scopeType, scope.scopeId);
      if (!policy) return reply.send({ ok: true, policy: null, message: "No reviewer automation policy configured" });
      return reply.send({ ok: true, policy });
    }
  );

  // ── PUT /account/governance/reviewer-policy ─────────────────────────

  app.put<{
    Body: ReviewerPolicyInput & { team_key?: string };
  }>("/account/governance/reviewer-policy", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return;
    const planCheck = requireEnterprisePlan(auth.user.id, new Date());
    if (!planCheck.allowed) return reply.code(403).send({ error: planCheck.error });
    const teamKey = (request.body as Record<string, unknown>)?.team_key?.toString().trim().toUpperCase() || undefined;
    const scope = resolveScope(auth, teamKey, true, reply);
    if (!scope) return;
    const input = request.body as ReviewerPolicyInput;
    const validation = validateReviewerPolicyInput(input);
    if (!validation.valid) return reply.code(400).send({ error: validation.error });
    await upsertReviewerPolicy(scope, input);
    const policy = findPolicyForScope(store.snapshot(), scope.scopeType, scope.scopeId);
    return reply.send({ ok: true, policy });
  });

  async function upsertReviewerPolicy(scope: ScopeResult, input: ReviewerPolicyInput): Promise<void> {
    const nowIso = new Date().toISOString();
    await store.update((state) => {
      let record = state.reviewer_automation_policies.find(
        (p) => p.scope_type === scope.scopeType && p.scope_id === scope.scopeId
      );
      if (!record) {
        record = buildDefaultPolicy(scope.scopeType, scope.scopeId, randomUUID(), nowIso);
        state.reviewer_automation_policies.push(record);
      }
      applyPolicyUpdate(record, input, normalizeEmail as (e: string | undefined) => string | undefined, nowIso);
    });
  }

  // ── DELETE /account/governance/reviewer-policy ──────────────────────

  app.delete<{ Querystring: { team_key?: string } }>(
    "/account/governance/reviewer-policy",
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      if (!auth) return;
      const planCheck = requireEnterprisePlan(auth.user.id, new Date());
      if (!planCheck.allowed) return reply.code(403).send({ error: planCheck.error });
      const scope = resolveScope(auth, request.query?.team_key?.trim().toUpperCase() || undefined, true, reply);
      if (!scope) return;
      await store.update((state) => {
        state.reviewer_automation_policies = state.reviewer_automation_policies.filter(
          (p) => !(p.scope_type === scope.scopeType && p.scope_id === scope.scopeId)
        );
      });
      return reply.send({ ok: true, deleted: true });
    }
  );

  // ── POST /account/governance/reviewer-assign/:threadId ─────────────

  app.post<{ Params: { threadId: string }; Body: { team_key?: string } }>(
    "/account/governance/reviewer-assign/:threadId",
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      if (!auth) return;

      const planCheck = requireEnterprisePlan(auth.user.id, new Date());
      if (!planCheck.allowed) return reply.code(403).send({ error: planCheck.error });

      const threadId = request.params.threadId?.trim();
      if (!threadId) return reply.code(400).send({ error: "threadId is required" });

      const teamKey = (request.body as Record<string, unknown>)?.team_key?.toString().trim().toUpperCase() || undefined;
      const scope = resolveScope(auth, teamKey, true, reply);
      if (!scope) return;

      const snapshot = store.snapshot();
      const policy = findPolicyForScope(snapshot, scope.scopeType, scope.scopeId);
      if (!policy || !policy.enabled) return reply.code(404).send({ error: "reviewer automation policy not found or not enabled" });

      const thread = snapshot.mastermind_threads.find((t) => t.id === threadId);
      if (!thread) return reply.code(404).send({ error: "thread not found" });
      if (!canAccessGovernanceThread(snapshot, thread, auth.user.id)) return reply.code(403).send({ error: "not authorized for this thread" });

      const nowIso = new Date().toISOString();
      const { assignment, nextIndex } = assignReviewersForThread(policy, threadId, nowIso);

      await store.update((state) => { const rec = state.reviewer_automation_policies.find((p) => p.scope_type === scope.scopeType && p.scope_id === scope.scopeId); if (rec) { rec.last_assigned_index = nextIndex; rec.updated_at = nowIso; } });

      await notifySlackForScope(scope.scopeType, scope.scopeId, buildAssignmentNotificationText(assignment, thread.title));
      return reply.send({ ok: true, assignment });
    }
  );

  // ── GET /account/governance/reviewer-sla ────────────────────────────

  app.get<{ Querystring: { team_key?: string } }>(
    "/account/governance/reviewer-sla",
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      if (!auth) return;
      const scope = resolveScope(auth, request.query?.team_key?.trim().toUpperCase() || undefined, false, reply);
      if (!scope) return;
      const policy = findPolicyForScope(store.snapshot(), scope.scopeType, scope.scopeId);
      if (!policy || !policy.enabled) return reply.send({ ok: true, threads: [], message: "No active reviewer automation policy" });
      const accessibleThreads = store.snapshot().mastermind_threads.filter((t) => canAccessGovernanceThread(store.snapshot(), t, auth.user.id));
      const statuses = checkThreadSla(policy, accessibleThreads, Date.now());
      return reply.send({ ok: true, threads: statuses });
    }
  );

  // ── POST /account/governance/reviewer-escalate ──────────────────────

  app.post<{ Body: { team_key?: string } }>(
    "/account/governance/reviewer-escalate",
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      if (!auth) return;

      const planCheck = requireEnterprisePlan(auth.user.id, new Date());
      if (!planCheck.allowed) return reply.code(403).send({ error: planCheck.error });

      const teamKey = (request.body as Record<string, unknown>)?.team_key?.toString().trim().toUpperCase() || undefined;
      const scope = resolveScope(auth, teamKey, true, reply);
      if (!scope) return;

      const snapshot = store.snapshot();
      const policy = findPolicyForScope(snapshot, scope.scopeType, scope.scopeId);
      if (!policy || !policy.enabled) return reply.code(404).send({ error: "reviewer automation policy not found or not enabled" });

      const accessibleThreads = snapshot.mastermind_threads.filter((t) => canAccessGovernanceThread(snapshot, t, auth.user.id));
      const targets = resolveEscalationTargets(policy, accessibleThreads, Date.now());

      if (targets.length > 0) {
        await notifySlackForScope(scope.scopeType, scope.scopeId, buildEscalationNotificationText(targets));
      }

      return reply.send({ ok: true, escalation_count: targets.length, targets });
    }
  );

  // ── GET /account/governance/reviewer-approval/:threadId ────────────

  app.get<{ Params: { threadId: string }; Querystring: { team_key?: string } }>(
    "/account/governance/reviewer-approval/:threadId",
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      if (!auth) return;
      const threadId = request.params.threadId?.trim();
      if (!threadId) return reply.code(400).send({ error: "threadId is required" });
      const scope = resolveScope(auth, request.query?.team_key?.trim().toUpperCase() || undefined, false, reply);
      if (!scope) return;
      const snapshot = store.snapshot();
      const thread = snapshot.mastermind_threads.find((t) => t.id === threadId);
      if (!thread) return reply.code(404).send({ error: "thread not found" });
      if (!canAccessGovernanceThread(snapshot, thread, auth.user.id)) return reply.code(403).send({ error: "not authorized for this thread" });
      const policy = findPolicyForScope(snapshot, scope.scopeType, scope.scopeId);
      if (!policy || !policy.enabled) {
        return reply.send({ ok: true, gate: { met: true, current: 0, required: 0, voter_emails: [] }, message: "No active reviewer automation policy — approval gate is open" });
      }
      return reply.send({ ok: true, gate: checkApprovalGate(policy, snapshot, threadId) });
    }
  );

  // ── GET /account/governance/reviewer-status ─────────────────────────

  app.get<{ Querystring: { team_key?: string } }>(
    "/account/governance/reviewer-status",
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      if (!auth) return;
      const scope = resolveScope(auth, request.query?.team_key?.trim().toUpperCase() || undefined, false, reply);
      if (!scope) return;
      const snapshot = store.snapshot();
      const policy = findPolicyForScope(snapshot, scope.scopeType, scope.scopeId);
      if (!policy) return reply.send({ ok: true, status: null, message: "No reviewer automation policy configured" });
      const accessibleThreads = snapshot.mastermind_threads.filter((t) => canAccessGovernanceThread(snapshot, t, auth.user.id));
      return reply.send({ ok: true, status: buildPolicyStatusReport(policy, accessibleThreads, Date.now()) });
    }
  );
}
